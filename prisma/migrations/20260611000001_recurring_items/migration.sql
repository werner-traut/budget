CREATE TYPE "recurrence_frequency" AS ENUM ('MONTHLY', 'WEEKLY', 'PER_PERIOD');

CREATE TABLE "recurring_items" (
  "id"                   UUID NOT NULL DEFAULT uuid_generate_v4(),
  "user_id"              UUID NOT NULL,
  "name"                 TEXT NOT NULL,
  "amount"               DECIMAL(10,2) NOT NULL,
  "frequency"            "recurrence_frequency" NOT NULL,
  -- MONTHLY: 1-31, clamped to short months at generation time.
  "day_of_month"         INTEGER,
  -- WEEKLY: every N weeks counted from anchor_date.
  "interval_weeks"       INTEGER,
  -- First/reference occurrence date (UTC date-only). For WEEKLY this is the
  -- anchor of the N-week grid; for MONTHLY and PER_PERIOD it is the start
  -- boundary (no instances are generated before it).
  "anchor_date"          DATE NOT NULL,
  "active"               BOOLEAN NOT NULL DEFAULT true,
  -- Generation watermark: budget_items instances exist for all occurrences
  -- with due_date <= materialized_through. NULL = nothing generated yet.
  -- This (not the unique index) is what keeps a user-deleted single instance
  -- from being resurrected by the next cascade.
  "materialized_through" DATE,
  "created_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "recurring_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recurring_items_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "recurring_items_monthly_shape" CHECK (
    "frequency" <> 'MONTHLY' OR ("day_of_month" BETWEEN 1 AND 31)
  ),
  CONSTRAINT "recurring_items_weekly_shape" CHECK (
    "frequency" <> 'WEEKLY' OR ("interval_weeks" >= 1)
  ),
  CONSTRAINT "recurring_items_per_period_shape" CHECK (
    "frequency" <> 'PER_PERIOD'
      OR ("day_of_month" IS NULL AND "interval_weeks" IS NULL)
  )
);

CREATE INDEX "recurring_items_user_id_idx" ON "recurring_items"("user_id");

-- Link materialized instances back to their template. SET NULL so deleting a
-- recurring item detaches (preserves) already-created instances by default.
ALTER TABLE "budget_items"
  ADD COLUMN IF NOT EXISTS "source_recurring_id" UUID
    REFERENCES "recurring_items"("id") ON DELETE SET NULL;

-- Idempotency guard against concurrent/double cascade runs: at most one
-- materialized instance per (template, due date). Partial unique indexes are
-- not representable in schema.prisma, so this index is SQL-only — do not add
-- an @@unique for it, and expect prisma migrate diffs to be unaware of it.
CREATE UNIQUE INDEX "budget_items_recurring_due_unique"
  ON "budget_items" ("source_recurring_id", "due_date")
  WHERE "source_recurring_id" IS NOT NULL;
