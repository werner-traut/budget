// src/app/api/budget-entries/route.ts
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import {
  formatDateForAPI,
  getTodayInUTC,
  parseDateStringToUTC,
} from "@/lib/utils/date";
import { NextResponse } from "next/server";
import { CreateBudgetEntryDto } from "@/types/budget";

export const runtime = 'nodejs';

/**
 * Entries older than this cutoff are invisible to every screen: the monthly
 * overview needs the current month and the Summary period cards need the
 * current period forward, so we return everything from the earlier of the
 * two and skip the rest of the history.
 */
async function getHistoryCutoff(userId: string): Promise<Date> {
  const today = getTodayInUTC();
  const monthStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
  );

  const earliestOpenPeriod = await prisma.pay_periods.findFirst({
    where: {
      user_id: userId,
      period_type: { not: "CLOSED_PERIOD" },
    },
    orderBy: { start_date: "asc" },
    select: { start_date: true },
  });

  if (earliestOpenPeriod && earliestOpenPeriod.start_date < monthStart) {
    return earliestOpenPeriod.start_date;
  }
  return monthStart;
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const cutoff = await getHistoryCutoff(session.user.id);
    const budgetItems = await prisma.budget_items.findMany({
      where: {
        user_id: session.user.id,
        due_date: { gte: cutoff },
      },
      orderBy: {
        due_date: "asc",
      },
    });

    return NextResponse.json(budgetItems);
  } catch (error) {
    console.error("Failed to fetch budget entries:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body: CreateBudgetEntryDto = await req.json();

    const normalizedDueDate = parseDateStringToUTC(
      formatDateForAPI(body.due_date)
    );

    const budgetItem = await prisma.budget_items.create({
      data: {
        user_id: session.user.id,
        name: body.name,
        amount: body.amount,
        due_date: normalizedDueDate,
      },
    });

    return NextResponse.json(budgetItem);
  } catch (error) {
    console.error("Failed to create budget entry:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
