import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { formatDateForAPI, getTodayInUTC, parseDateStringToUTC } from "@/lib/utils/date";
import { materializeRecurringItems } from "@/lib/services/recurring-materialization";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const updateSchema = z
  .object({
    name: z.string().min(1).optional(),
    amount: z.number().positive().optional(),
    frequency: z.enum(["MONTHLY", "WEEKLY", "PER_PERIOD"]).optional(),
    day_of_month: z.number().int().min(1).max(31).nullish(),
    interval_weeks: z.number().int().min(1).nullish(),
    anchor_date: z.string().optional(),
    active: z.boolean().optional(),
    applyToFutureInstances: z.boolean().optional(),
  })
  .strict();

export async function PUT(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;
  const id = req.nextUrl.pathname.split("/").pop();

  try {
    const body = updateSchema.parse(await req.json());
    const applyToFuture = body.applyToFutureInstances ?? true;
    const todayStr = formatDateForAPI(getTodayInUTC());
    const today = parseDateStringToUTC(todayStr);

    const existing = await prisma.recurring_items.findUnique({ where: { id } });
    if (!existing) {
      return new NextResponse("Not found", { status: 404 });
    }
    if (existing.user_id !== userId) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    const scheduleChanged =
      (body.frequency !== undefined && body.frequency !== existing.frequency) ||
      (body.day_of_month !== undefined &&
        body.day_of_month !== existing.day_of_month) ||
      (body.interval_weeks !== undefined &&
        body.interval_weeks !== existing.interval_weeks) ||
      (body.anchor_date !== undefined &&
        formatDateForAPI(body.anchor_date) !==
          formatDateForAPI(existing.anchor_date));

    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.recurring_items.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.amount !== undefined ? { amount: body.amount } : {}),
          ...(body.frequency !== undefined ? { frequency: body.frequency } : {}),
          ...(body.day_of_month !== undefined
            ? { day_of_month: body.day_of_month }
            : {}),
          ...(body.interval_weeks !== undefined
            ? { interval_weeks: body.interval_weeks }
            : {}),
          ...(body.anchor_date !== undefined
            ? {
                anchor_date: parseDateStringToUTC(
                  formatDateForAPI(body.anchor_date)
                ),
              }
            : {}),
          ...(body.active !== undefined ? { active: body.active } : {}),
          updated_at: new Date(),
        },
      });

      if (applyToFuture && scheduleChanged) {
        // Regenerate the future: drop unpaid instances after today (today's
        // own instance is kept so a bill due today isn't yanked), rewind the
        // watermark, and re-materialize on the new schedule.
        await tx.budget_items.deleteMany({
          where: {
            source_recurring_id: id,
            paid_at: null,
            due_date: { gt: today },
          },
        });
        await tx.recurring_items.update({
          where: { id },
          data: { materialized_through: today },
        });
        await materializeRecurringItems(tx, userId, todayStr);
        return tx.recurring_items.findUnique({ where: { id } });
      }

      if (
        applyToFuture &&
        (body.name !== undefined || body.amount !== undefined)
      ) {
        // Rename/reprice future unpaid instances; paid and past rows are
        // history and stay as they were.
        await tx.budget_items.updateMany({
          where: {
            source_recurring_id: id,
            paid_at: null,
            due_date: { gte: today },
          },
          data: {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.amount !== undefined ? { amount: body.amount } : {}),
            updated_at: new Date(),
          },
        });
      }

      return updated;
    });

    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid input", errors: error.issues }),
        { status: 400 }
      );
    }

    console.error("Failed to update recurring item:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;
  const id = req.nextUrl.pathname.split("/").pop();
  const deleteFutureInstances =
    req.nextUrl.searchParams.get("deleteFutureInstances") !== "false";

  try {
    const existing = await prisma.recurring_items.findUnique({ where: { id } });
    if (!existing) {
      return new NextResponse("Not found", { status: 404 });
    }
    if (existing.user_id !== userId) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    const today = parseDateStringToUTC(formatDateForAPI(getTodayInUTC()));

    await prisma.$transaction(async (tx) => {
      if (deleteFutureInstances) {
        await tx.budget_items.deleteMany({
          where: {
            source_recurring_id: id,
            paid_at: null,
            due_date: { gt: today },
          },
        });
      }
      // Remaining instances (past, paid, or kept) are detached into plain
      // budget items by the FK's ON DELETE SET NULL.
      await tx.recurring_items.delete({ where: { id } });
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete recurring item:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
