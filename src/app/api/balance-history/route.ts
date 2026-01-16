import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getTodayInUTC } from "@/lib/utils/date";
import { NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const duration = url.searchParams.get("days") || "30";
  const startDate = url.searchParams.get("startDate");

  try {
    const whereCondition: any = {
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
    const today = getTodayInUTC();

    const balanceHistory = await prisma.balance_history.upsert({
      where: {
        user_id_balance_date: {
          // Using the unique constraint
          user_id: session.user.id,
          balance_date: today,
        },
      },
      update: {
        bank_balance: body.bankBalance,
        current_period_end_balance: body.currentPeriodEndBalance,
        next_period_end_balance: body.nextPeriodEndBalance,
        period_after_end_balance: body.periodAfterEndBalance,
        updated_at: new Date(),
      },
      create: {
        user_id: session.user.id,
        balance_date: today,
        bank_balance: body.bankBalance,
        current_period_end_balance: body.currentPeriodEndBalance,
        next_period_end_balance: body.nextPeriodEndBalance,
        period_after_end_balance: body.periodAfterEndBalance,
        updated_at: new Date(),
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
