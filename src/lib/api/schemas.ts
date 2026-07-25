import { z } from "zod";

/**
 * Client-side schemas for API responses.
 *
 * Prisma Decimal columns serialize to JSON as strings (e.g. "1234.56"), while
 * the rest of the app works with numbers. Every fetch that consumes an API
 * response must parse it through one of these schemas so the conversion happens
 * exactly once, at the boundary — and a malformed response fails loudly there
 * instead of surfacing as wrong numbers deep in a calculation.
 *
 * z.object strips unknown keys, so incidental fields (e.g. included `users`
 * relations) never reach client state.
 */

/** A Prisma Decimal on the wire: a numeric string (or a number). */
const decimal = z.coerce.number();

/** Nullable Decimal. Null is matched first so it isn't coerced to 0. */
const nullableDecimal = z.null().or(decimal);

export const budgetEntrySchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  amount: decimal,
  due_date: z.string(),
  paid_at: z.string().nullable(),
  actual_amount: nullableDecimal,
  source_recurring_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const budgetEntryListSchema = z.array(budgetEntrySchema);

export const recurringItemSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  amount: decimal,
  frequency: z.enum(["MONTHLY", "WEEKLY", "PER_PERIOD"]),
  day_of_month: z.number().nullable(),
  interval_weeks: z.number().nullable(),
  anchor_date: z.string(),
  active: z.boolean(),
  materialized_through: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const recurringItemListSchema = z.array(recurringItemSchema);

export const payPeriodSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  period_type: z.enum([
    "CURRENT_PERIOD",
    "NEXT_PERIOD",
    "PERIOD_AFTER",
    "FUTURE_PERIOD",
    "CLOSED_PERIOD",
  ]),
  start_date: z.string(),
  salary_amount: decimal,
  created_at: z.string(),
  updated_at: z.string(),
});

export const payPeriodListSchema = z.array(payPeriodSchema);

export const adhocSettingsSchema = z.object({
  daily_amount: decimal,
});

/** GET returns `{ balance: null }` when no row exists for the date. */
export const dailyBalanceGetSchema = z.object({
  balance: nullableDecimal,
});

/** POST (upsert) always returns a saved row, so balance is present. */
export const dailyBalanceUpsertSchema = z.object({
  balance: decimal,
});

export const balanceHistorySchema = z.object({
  id: z.string(),
  bank_balance: decimal,
  current_period_end_balance: decimal,
  next_period_end_balance: decimal,
  period_after_end_balance: decimal,
  balance_date: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  // Adhoc tracking columns are null on rows recorded before the feature.
  adhoc_delta: nullableDecimal.optional(),
  adhoc_cumulative: nullableDecimal.optional(),
  adhoc_salary_received: nullableDecimal.optional(),
  adhoc_expenses_due: nullableDecimal.optional(),
  adhoc_budget: nullableDecimal.optional(),
  adhoc_baseline: z.boolean().optional(),
});

export const balanceHistoryListSchema = z.array(balanceHistorySchema);

/**
 * Check the response status and parse its JSON body against a schema.
 * Throws with the status code on a non-OK response, and a ZodError when the
 * body doesn't match — either way the failure is loud, never a silently
 * wrong value.
 */
export async function parseApiResponse<Schema extends z.ZodType>(
  response: Response,
  schema: Schema,
  errorMessage: string
): Promise<z.output<Schema>> {
  if (!response.ok) {
    throw new Error(`${errorMessage} (${response.status})`);
  }
  return schema.parse(await response.json());
}
