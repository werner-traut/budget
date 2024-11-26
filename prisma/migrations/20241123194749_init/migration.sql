-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CreateEnum
CREATE TYPE "period_type" AS ENUM ('CURRENT_PERIOD', 'NEXT_PERIOD', 'PERIOD_AFTER', 'FUTURE_PERIOD', 'CLOSED_PERIOD');

-- CreateTable
CREATE TABLE "adhoc_settings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "daily_amount" DECIMAL(10,2) NOT NULL DEFAULT 40.00,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "adhoc_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID,
    "bank_balance" DECIMAL(10,2) NOT NULL,
    "current_period_end_balance" DECIMAL(10,2) NOT NULL,
    "next_period_end_balance" DECIMAL(10,2) NOT NULL,
    "period_after_end_balance" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "balance_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "balance_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "due_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_balances" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_periods" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "period_type" "period_type" NOT NULL,
    "start_date" DATE NOT NULL,
    "salary_amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pay_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "adhoc_settings_user_id_key" ON "adhoc_settings"("user_id");

-- CreateIndex
CREATE INDEX "balance_history_user_id_created_at_idx" ON "balance_history"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "balance_history_user_id_date_idx" ON "balance_history"("user_id", "balance_date");

-- CreateIndex
CREATE UNIQUE INDEX "unique_user_daily_balance" ON "daily_balances"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- AddForeignKey
ALTER TABLE "adhoc_settings" ADD CONSTRAINT "adhoc_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "balance_history" ADD CONSTRAINT "balance_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "daily_balances" ADD CONSTRAINT "daily_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pay_periods" ADD CONSTRAINT "pay_periods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
