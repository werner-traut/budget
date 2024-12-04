import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { formatDateForAPI } from "@/lib/utils/date";
import { NextResponse } from "next/server";
import { z } from "zod";

// Input validation schema
const dailyBalanceSchema = z.object({
  balance: z.number().min(0, "Balance must be positive"),
});

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const validated = dailyBalanceSchema.parse(body);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyBalance = await prisma.daily_balances.upsert({
      where: {
        user_id_date: {
          // Using the unique constraint
          user_id: session.user.id,
          date: today,
        },
      },
      update: {
        balance: validated.balance,
        updated_at: new Date(),
      },
      create: {
        user_id: session.user.id,
        balance: validated.balance,
        date: today,
      },
      include: {
        users: true, // Include user data if needed
      },
    });

    return NextResponse.json(dailyBalance);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid input", errors: error.errors }),
        { status: 400 }
      );
    }

    console.error("Failed to save balance:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");

  try {
    if (dateParam) {
      // Query for specific date
      const parsedDate = new Date(formatDateForAPI(dateParam));

      const balance = await prisma.daily_balances.findUnique({
        cacheStrategy: {
          ttl: 60,
        },
        where: {
          user_id_date: {
            user_id: session.user.id,
            date: parsedDate,
          },
        },
        include: {
          users: true,
        },
      });

      if (!balance) {
        return NextResponse.json({ balance: null });
      }

      return NextResponse.json(balance);
    } else {
      // Get most recent balance
      const balance = await prisma.daily_balances.findFirst({
        where: {
          user_id: session.user.id,
        },
        orderBy: {
          date: "desc",
        },
        include: {
          users: true,
        },
      });

      if (!balance) {
        return NextResponse.json({ balance: null });
      }

      return NextResponse.json(balance);
    }
  } catch (error) {
    console.error("Failed to fetch balance:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
