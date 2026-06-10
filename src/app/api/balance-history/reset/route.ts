import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getTodayInUTC } from "@/lib/utils/date";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Resets the cumulative adhoc savings baseline. Marks today's snapshot as a
 * baseline (cumulative anchored at 0) so subsequent snapshots accumulate from
 * zero again. Useful when a known one-off cash movement has skewed the running
 * total. Historical rows are left untouched.
 */
export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const userId = session.user.id;
    const today = getTodayInUTC();

    const existing = await prisma.balance_history.findUnique({
      where: { user_id_balance_date: { user_id: userId, balance_date: today } },
    });

    // If today's snapshot does not exist yet, seed it from the most recent
    // recorded balances so the graph's other series stay continuous.
    const latest = existing
      ? null
      : await prisma.balance_history.findFirst({
          where: { user_id: userId },
          orderBy: { balance_date: "desc" },
        });

    const baseFields = {
      adhoc_baseline: true,
      adhoc_delta: 0,
      adhoc_cumulative: 0,
      adhoc_salary_received: 0,
      adhoc_expenses_due: 0,
      adhoc_budget: 0,
      updated_at: new Date(),
    };

    const balanceHistory = await prisma.balance_history.upsert({
      where: {
        user_id_balance_date: { user_id: userId, balance_date: today },
      },
      update: baseFields,
      create: {
        user_id: userId,
        balance_date: today,
        bank_balance: latest?.bank_balance ?? 0,
        current_period_end_balance: latest?.current_period_end_balance ?? 0,
        next_period_end_balance: latest?.next_period_end_balance ?? 0,
        period_after_end_balance: latest?.period_after_end_balance ?? 0,
        ...baseFields,
      },
    });

    return NextResponse.json(balanceHistory);
  } catch (error) {
    console.error("Failed to reset adhoc savings baseline:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
