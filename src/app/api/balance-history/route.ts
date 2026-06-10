import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getTodayInUTC } from "@/lib/utils/date";
import {
  computeAdhocSnapshot,
  getDaysBetween,
} from "@/lib/utils/budget-calculations";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export const runtime = 'nodejs';

const DEFAULT_DAILY_AMOUNT = 40;

/** Sum salary/expenses falling in the window (after, through] for a user. */
async function sumInWindow(
  userId: string,
  after: Date,
  through: Date
): Promise<{ salaryReceived: number; expensesDue: number }> {
  const [salary, expenses] = await Promise.all([
    prisma.pay_periods.aggregate({
      _sum: { salary_amount: true },
      where: { user_id: userId, start_date: { gt: after, lte: through } },
    }),
    prisma.budget_items.aggregate({
      _sum: { amount: true },
      where: { user_id: userId, due_date: { gt: after, lte: through } },
    }),
  ]);

  return {
    salaryReceived: Number(salary._sum.salary_amount ?? 0),
    expensesDue: Number(expenses._sum.amount ?? 0),
  };
}

export async function GET(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const duration = url.searchParams.get("days") || "30";
  const startDate = url.searchParams.get("startDate");

  try {
    const whereCondition: Prisma.balance_historyWhereInput = {
      user_id: session.user.id,
    };

    if (startDate) {
      whereCondition.balance_date = {
        gte: new Date(startDate),
      };
    } else {
      whereCondition.balance_date = {
        gte: new Date(Date.now() - parseInt(duration) * 24 * 60 * 60 * 1000),
      };
    }

    const balanceHistory = await prisma.balance_history.findMany({
      where: whereCondition,
      orderBy: {
        balance_date: "asc",
      },
    });

    return NextResponse.json(balanceHistory);
  } catch (error) {
    console.error("Failed to fetch balance history:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const userId = session.user.id;
    const today = getTodayInUTC();
    const bankBalance = Number(body.bankBalance);

    // The most recent snapshot strictly before today anchors the calculation.
    // Re-saving today's row therefore always recomputes against the prior day,
    // never against itself, keeping repeated saves idempotent.
    const [previous, existing, adhocSettings] = await Promise.all([
      prisma.balance_history.findFirst({
        where: { user_id: userId, balance_date: { lt: today } },
        orderBy: { balance_date: "desc" },
      }),
      prisma.balance_history.findUnique({
        where: { user_id_balance_date: { user_id: userId, balance_date: today } },
      }),
      prisma.adhoc_settings.findUnique({ where: { user_id: userId } }),
    ]);

    const dailyAmount = adhocSettings
      ? Number(adhocSettings.daily_amount)
      : DEFAULT_DAILY_AMOUNT;

    // A row is a baseline (cumulative anchored at 0) when it was explicitly
    // reset, or when there is no prior tracked snapshot to chain from. Rows
    // recorded before this feature have a null cumulative and so cannot anchor.
    const isBaseline =
      existing?.adhoc_baseline === true ||
      previous === null ||
      previous.adhoc_cumulative === null;

    let adhocFields: {
      adhoc_delta: number;
      adhoc_cumulative: number;
      adhoc_salary_received: number;
      adhoc_expenses_due: number;
      adhoc_budget: number;
      adhoc_baseline: boolean;
    };

    if (isBaseline) {
      adhocFields = {
        adhoc_delta: 0,
        adhoc_cumulative: 0,
        adhoc_salary_received: 0,
        adhoc_expenses_due: 0,
        adhoc_budget: 0,
        adhoc_baseline: existing?.adhoc_baseline ?? false,
      };
    } else {
      const previousDate = previous.balance_date;
      const daysGap = getDaysBetween(previousDate, today);
      const { salaryReceived, expensesDue } = await sumInWindow(
        userId,
        previousDate,
        today
      );

      const snapshot = computeAdhocSnapshot({
        previousBalance: Number(previous.bank_balance),
        previousCumulative: Number(previous.adhoc_cumulative),
        actualBalance: bankBalance,
        salaryReceived,
        expensesDue,
        daysGap,
        dailyAmount,
      });

      adhocFields = {
        adhoc_delta: snapshot.delta,
        adhoc_cumulative: snapshot.cumulative,
        adhoc_salary_received: salaryReceived,
        adhoc_expenses_due: expensesDue,
        adhoc_budget: snapshot.adhocBudget,
        adhoc_baseline: false,
      };
    }

    const balanceHistory = await prisma.balance_history.upsert({
      where: {
        user_id_balance_date: {
          // Using the unique constraint
          user_id: userId,
          balance_date: today,
        },
      },
      update: {
        bank_balance: body.bankBalance,
        current_period_end_balance: body.currentPeriodEndBalance,
        next_period_end_balance: body.nextPeriodEndBalance,
        period_after_end_balance: body.periodAfterEndBalance,
        updated_at: new Date(),
        ...adhocFields,
      },
      create: {
        user_id: userId,
        balance_date: today,
        bank_balance: body.bankBalance,
        current_period_end_balance: body.currentPeriodEndBalance,
        next_period_end_balance: body.nextPeriodEndBalance,
        period_after_end_balance: body.periodAfterEndBalance,
        updated_at: new Date(),
        ...adhocFields,
      },
      include: {
        users: true, // Include user data if needed
      },
    });

    return NextResponse.json(balanceHistory);
  } catch (error) {
    console.error("Failed to update balance history:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
