import type { Prisma } from "@prisma/client";
import { formatDateForAPI, parseDateStringToUTC } from "@/lib/utils/date";
import { planMaterialization } from "@/lib/utils/recurrence";

/**
 * Creates budget_items instances for the user's active recurring items, from
 * `todayStr` through the latest defined pay period start (the horizon).
 *
 * Idempotency is layered: the per-item materialized_through watermark is the
 * semantic cursor (it also keeps individually deleted instances deleted),
 * while createMany + skipDuplicates rides the partial unique index on
 * (source_recurring_id, due_date) as a backstop against concurrent runs.
 *
 * Must be called with a transaction client; with the serverless pool capped
 * at one connection, using the outer prisma client inside a transaction
 * would deadlock.
 */
export async function materializeRecurringItems(
  tx: Prisma.TransactionClient,
  userId: string,
  todayStr: string
): Promise<number> {
  const periods = await tx.pay_periods.findMany({
    where: { user_id: userId, period_type: { not: "CLOSED_PERIOD" } },
    select: { start_date: true },
    orderBy: { start_date: "asc" },
  });
  if (!periods.length) return 0;

  const periodStarts = periods.map((p) => formatDateForAPI(p.start_date));
  const horizon = periodStarts[periodStarts.length - 1];
  if (horizon < todayStr) return 0;

  const items = await tx.recurring_items.findMany({
    where: { user_id: userId, active: true },
  });
  if (!items.length) return 0;

  const rows: Prisma.budget_itemsCreateManyInput[] = [];
  for (const item of items) {
    const dueDates = planMaterialization(
      {
        rule: {
          frequency: item.frequency,
          day_of_month: item.day_of_month,
          interval_weeks: item.interval_weeks,
          anchor_date: formatDateForAPI(item.anchor_date),
        },
        materialized_through: item.materialized_through
          ? formatDateForAPI(item.materialized_through)
          : null,
        active: item.active,
      },
      todayStr,
      horizon,
      periodStarts
    );

    for (const dueDate of dueDates) {
      rows.push({
        user_id: userId,
        name: item.name,
        amount: item.amount,
        due_date: parseDateStringToUTC(dueDate),
        source_recurring_id: item.id,
      });
    }
  }

  let created = 0;
  if (rows.length) {
    const result = await tx.budget_items.createMany({
      data: rows,
      skipDuplicates: true,
    });
    created = result.count;
  }

  await tx.recurring_items.updateMany({
    where: { id: { in: items.map((item) => item.id) } },
    data: {
      materialized_through: parseDateStringToUTC(horizon),
      updated_at: new Date(),
    },
  });

  return created;
}
