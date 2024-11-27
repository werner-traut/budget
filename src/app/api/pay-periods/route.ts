import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

// Validate the period type enum
const PeriodTypeEnum = z.enum([
  "CURRENT_PERIOD",
  "NEXT_PERIOD",
  "PERIOD_AFTER",
  "FUTURE_PERIOD",
  "CLOSED_PERIOD",
]);

// Input validation schema
const payPeriodSchema = z.object({
  period_type: PeriodTypeEnum,
  start_date: z.string().transform((str) => new Date(str)),
  salary_amount: z.number().positive("Salary must be positive"),
});

async function validatePeriodOrder(
  userId: string,
  newPeriod: { period_type: string; start_date: Date }
) {
  // Get all existing periods
  const periods = await prisma.pay_periods.findMany({
    where: {
      user_id: userId,
      period_type: {
        not: "CLOSED_PERIOD",
      },
    },
    orderBy: {
      start_date: "asc",
    },
    select: {
      period_type: true,
      start_date: true,
    },
  });

  // Add new period to the list and sort
  const allPeriods = [...periods, newPeriod].sort(
    (a, b) => a.start_date.getTime() - b.start_date.getTime()
  );

  // Check order matches period types
  const correctOrder = [
    "CURRENT_PERIOD",
    "NEXT_PERIOD",
    "PERIOD_AFTER",
    "FUTURE_PERIOD",
  ];

  const activePeriods = allPeriods.filter(
    (p) => p.period_type !== "CLOSED_PERIOD"
  );

  for (let i = 0; i < activePeriods.length; i++) {
    if (activePeriods[i].period_type !== correctOrder[i]) {
      throw new Error("Periods must be in correct chronological order");
    }
  }
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const payPeriods = await prisma.pay_periods.findMany({
      where: {
        user_id: session.user.id,
        period_type: {
          not: "CLOSED_PERIOD",
        },
      },
      orderBy: {
        start_date: "desc",
      },
      include: {
        users: true,
      },
    });

    return NextResponse.json(payPeriods);
  } catch (error) {
    console.error("Failed to fetch pay periods:", error);
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

    // Validate input
    const validatedData = payPeriodSchema.parse(body);

    // Validate period order
    await validatePeriodOrder(session.user.id, {
      period_type: validatedData.period_type,
      start_date: validatedData.start_date,
    });

    const payPeriod = await prisma.pay_periods.create({
      data: {
        user_id: session.user.id,
        period_type: validatedData.period_type,
        start_date: validatedData.start_date,
        salary_amount: validatedData.salary_amount,
      },
      include: {
        users: true,
      },
    });

    return NextResponse.json(payPeriod);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(
        JSON.stringify({
          message: "Invalid input",
          errors: error.errors,
        }),
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return new NextResponse(error.message, { status: 400 });
    }

    console.error("Failed to create pay period:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
