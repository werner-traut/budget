import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const duration = url.searchParams.get("days") || "30";

  try {
    
    const balanceHistory = await prisma.balance_history.findMany({
      cacheStrategy: {
        swr: 60,
      },
      where: {
        user_id: session.user.id,
        balance_date: {
          gte: new Date(Date.now() - parseInt(duration) * 24 * 60 * 60 * 1000)
        }
      },
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
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Ensure midnight UTC

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
