import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { formatDateForAPI, getTodayInUTC, parseDateStringToUTC } from "@/lib/utils/date";
import { calculateNextPayPeriod } from "@/lib/utils/pay-period";
import { cascadePeriodTypes, shouldCascadePeriods } from "@/lib/utils/periods";
import { materializeRecurringItems } from "@/lib/services/recurring-materialization";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const cascadeSchema = z.object({
  force: z.boolean().optional(),
  newPeriod: z
    .object({
      start_date: z.string(),
      salary_amount: z.number().positive("Salary must be positive"),
    })
    .optional(),
});

/**
 * Atomically shifts period types forward (CURRENT→CLOSED, NEXT→CURRENT, ...),
 * creates the next FUTURE_PERIOD, and materializes recurring item instances
 * for the newly visible horizon.
 *
 * Without `force` the cascade only runs once the NEXT_PERIOD start date has
 * been reached (shouldCascadePeriods); the manual "Add Period" button sends
 * force: true to preserve its existing behavior.
 */
export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  try {
    const body = cascadeSchema.parse(await req.json().catch(() => ({})));
    const todayStr = formatDateForAPI(getTodayInUTC());

    const result = await prisma.$transaction(async (tx) => {
      // Pool max is 1: every query in here must use tx, never prisma.
      const periods = await tx.pay_periods.findMany({
        where: { user_id: userId },
        orderBy: { start_date: "asc" },
      });

      const activePeriods = periods.filter(
        (p) => p.period_type !== "CLOSED_PERIOD"
      );
      if (!activePeriods.length) {
        throw new CascadeError("No active pay periods to cascade", 409);
      }

      // cascadePeriodTypes operates on the client-side PayPeriod shape
      // (string dates), so map the rows through it by type only.
      const asClientPeriods = activePeriods.map((p) => ({
        id: p.id,
        user_id: p.user_id,
        period_type: p.period_type,
        start_date: formatDateForAPI(p.start_date),
        salary_amount: Number(p.salary_amount),
        created_at: p.created_at.toISOString(),
        updated_at: p.updated_at.toISOString(),
      }));

      if (!body.force && !shouldCascadePeriods(asClientPeriods)) {
        throw new CascadeError(
          "NEXT_PERIOD start date has not been reached",
          409
        );
      }

      const cascaded = cascadePeriodTypes(asClientPeriods);
      for (const period of cascaded) {
        const original = activePeriods.find((p) => p.id === period.id);
        if (original && original.period_type !== period.period_type) {
          await tx.pay_periods.update({
            where: { id: period.id },
            data: { period_type: period.period_type, updated_at: new Date() },
          });
        }
      }

      // Create the new FUTURE_PERIOD: explicit from the client, or derived
      // from the latest existing period like the old handleAddPeriod did.
      const latest = activePeriods[activePeriods.length - 1];
      const startDate = body.newPeriod
        ? parseDateStringToUTC(formatDateForAPI(body.newPeriod.start_date))
        : calculateNextPayPeriod(latest.start_date);
      const salaryAmount =
        body.newPeriod?.salary_amount ?? Number(latest.salary_amount);

      await tx.pay_periods.create({
        data: {
          user_id: userId,
          period_type: "FUTURE_PERIOD",
          start_date: startDate,
          salary_amount: salaryAmount,
        },
      });

      const materializedCount = await materializeRecurringItems(
        tx,
        userId,
        todayStr
      );

      const updatedPeriods = await tx.pay_periods.findMany({
        where: { user_id: userId, period_type: { not: "CLOSED_PERIOD" } },
        orderBy: { start_date: "asc" },
      });

      return { periods: updatedPeriods, materializedCount };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid input", errors: error.issues }),
        { status: 400 }
      );
    }
    if (error instanceof CascadeError) {
      return new NextResponse(error.message, { status: error.status });
    }

    console.error("Failed to cascade pay periods:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

class CascadeError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
