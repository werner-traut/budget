-- Paid tracking on budget items. Nullable: rows recorded before this feature
-- are simply "unpaid". paid_at is a UTC date-only value like due_date;
-- actual_amount records what was really paid when it differs from the budget.
ALTER TABLE "budget_items"
  ADD COLUMN IF NOT EXISTS "paid_at" DATE,
  ADD COLUMN IF NOT EXISTS "actual_amount" DECIMAL(10,2);
