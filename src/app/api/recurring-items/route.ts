import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { formatDateForAPI, getTodayInUTC, parseDateStringToUTC } from "@/lib/utils/date";
import { materializeRecurringItems } from "@/lib/services/recurring-materialization";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const recurringItemSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    amount: z.number().positive("Amount must be positive"),
    frequency: z.enum(["MONTHLY", "WEEKLY", "PER_PERIOD"]),
    day_of_month: z.number().int().min(1).max(31).nullish(),
    interval_weeks: z.number().int().min(1).nullish(),
    anchor_date: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.frequency === "MONTHLY" && !data.day_of_month) {
      ctx.addIssue({
        code: "custom",
        path: ["day_of_month"],
        message: "day_of_month is required for MONTHLY items",
      });
    }
    if (data.frequency === "WEEKLY" && !data.interval_weeks) {
      ctx.addIssue({
        code: "custom",
        path: ["interval_weeks"],
        message: "interval_weeks is required for WEEKLY items",
      });
    }
  });

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const items = await prisma.recurring_items.findMany({
      where: { user_id: session.user.id },
      orderBy: { created_at: "asc" },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch recurring items:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  try {
    const data = recurringItemSchema.parse(await req.json());
    const todayStr = formatDateForAPI(getTodayInUTC());

    // Create and immediately backfill instances through the horizon so the
    // new item shows up in the budget right away, not at the next cascade.
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.recurring_items.create({
        data: {
          user_id: userId,
          name: data.name,
          amount: data.amount,
          frequency: data.frequency,
          day_of_month: data.frequency === "MONTHLY" ? data.day_of_month : null,
          interval_weeks:
            data.frequency === "WEEKLY" ? data.interval_weeks : null,
          anchor_date: parseDateStringToUTC(formatDateForAPI(data.anchor_date)),
        },
      });

      const materializedCount = await materializeRecurringItems(
        tx,
        userId,
        todayStr
      );

      const refreshed = await tx.recurring_items.findUnique({
        where: { id: item.id },
      });

      return { item: refreshed ?? item, materializedCount };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid input", errors: error.issues }),
        { status: 400 }
      );
    }

    console.error("Failed to create recurring item:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
