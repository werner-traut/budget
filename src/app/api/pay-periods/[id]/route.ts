import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";

// Validation schema for pay period updates
const updatePayPeriodSchema = z.object({
  period_type: z
    .enum([
      "CURRENT_PERIOD",
      "NEXT_PERIOD",
      "PERIOD_AFTER",
      "FUTURE_PERIOD",
      "CLOSED_PERIOD",
    ])
    .optional(),
  start_date: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  salary_amount: z.number().positive("Salary must be positive").optional(),
});

export async function PUT(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const id = req.nextUrl.pathname.split("/").pop(); // Get ID from URL path

  // Validate UUID format
  if (
    !id ||
    !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      id
    )
  ) {
    return new NextResponse("Invalid ID format", { status: 400 });
  }

  try {
    const existingPeriod = await prisma.pay_periods.findUnique({
      where: { id },
      select: { user_id: true },
    });

    if (!existingPeriod) {
      return new NextResponse("Pay period not found", { status: 404 });
    }

    if (existingPeriod.user_id !== session.user.id) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    // Validate request body
    const body = await req.json();
    const validatedData = updatePayPeriodSchema.parse(body);

    // Update the pay period
    const period = await prisma.pay_periods.update({
      where: { id },
      data: {
        ...validatedData,
        updated_at: new Date(),
      },
      include: {
        users: true, // Include user data if needed
      },
    });

    return NextResponse.json(period);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(
        JSON.stringify({
          message: "Invalid input",
          errors: error.issues,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.error("Failed to update pay period:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
