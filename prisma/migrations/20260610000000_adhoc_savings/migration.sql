-- Adhoc savings tracking columns on balance_history.
-- All value columns are nullable so rows recorded before this feature carry no
-- savings data; tracking simply begins from the first snapshot saved afterwards.
ALTER TABLE "balance_history"
  ADD COLUMN IF NOT EXISTS "adhoc_delta" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "adhoc_cumulative" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "adhoc_salary_received" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "adhoc_expenses_due" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "adhoc_budget" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "adhoc_baseline" BOOLEAN NOT NULL DEFAULT false;
