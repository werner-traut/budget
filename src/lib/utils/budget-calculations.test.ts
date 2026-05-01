import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
  calculateAdhocSavings,
  calculateAdhocSavingsTimeline,
  calculateMonthToDateAdhocSavings,
  calculateMonthlyBudgetOverview,
  type AdhocSavingsCalculationLog,
} from "./budget-calculations";
import type { BalanceHistory } from "@/types/balanceHistory";
import type { BudgetEntry } from "@/types/budget";
import type { PayPeriod } from "@/types/periods";

function addDays(date: string, days: number): string {
  const dateObj = new Date(`${date}T00:00:00.000Z`);
  dateObj.setUTCDate(dateObj.getUTCDate() + days);
  return dateObj.toISOString().slice(0, 10);
}

function balanceHistory(date: string, bankBalance: number): BalanceHistory {
  return {
    id: `balance-${date}`,
    bank_balance: bankBalance,
    current_period_end_balance: 0,
    next_period_end_balance: 0,
    period_after_end_balance: 0,
    balance_date: date,
    created_at: date,
    updated_at: date,
  };
}

function budgetEntry(date: string, amount: number): BudgetEntry {
  return {
    id: `entry-${date}-${amount}`,
    user_id: "user-1",
    period_id: null,
    name: "Expense",
    amount,
    due_date: date,
    created_at: date,
    updated_at: date,
  };
}

function payPeriod(date: string, salaryAmount: number): PayPeriod {
  return {
    id: `period-${date}-${salaryAmount}`,
    user_id: "user-1",
    period_type: "CLOSED_PERIOD",
    start_date: date,
    salary_amount: salaryAmount,
    created_at: date,
    updated_at: date,
  };
}

describe("budget calculation utilities", () => {
  it("calculates month-to-date savings using budget entry day-of-month", () => {
    const logs: AdhocSavingsCalculationLog[] = [];

    const savings = calculateMonthToDateAdhocSavings(
      [
        balanceHistory("2026-01-01", 1000),
        balanceHistory("2026-01-10", 700),
      ],
      [
        budgetEntry("2026-02-05", 200),
        budgetEntry("2026-02-20", 500),
      ],
      [payPeriod("2026-01-02", 100)],
      20,
      new Date("2026-01-10T00:00:00.000Z"),
      { logger: (details) => logs.push(details) }
    );

    expect(savings).toEqual({ cumulative: 0, trackedDays: 10 });
    expect(logs[0]).toMatchObject({
      salaryReceived: 100,
      expensesDue: 200,
      adhocBudget: 200,
      expectedBalance: 700,
      delta: 0,
      status: "on-budget",
    });
  });

  it("calculates monthly overview for the full month using projected budget days", () => {
    const overview = calculateMonthlyBudgetOverview(
      [
        budgetEntry("2026-02-05", 200),
        budgetEntry("2026-01-20", 500),
      ],
      [
        payPeriod("2026-01-02", 100),
        payPeriod("2026-01-20", 900),
      ],
      20,
      new Date("2026-01-10T00:00:00.000Z")
    );

    expect(overview).toEqual({
      totalExpenses: 700,
      totalIncome: 1000,
      totalAdhoc: 620,
      difference: -320,
    });
  });

  it("calculates over-budget savings and emits interval diagnostics", () => {
    const logs: AdhocSavingsCalculationLog[] = [];

    const timeline = calculateAdhocSavingsTimeline(
      [balanceHistory("2026-01-01", 1000), balanceHistory("2026-01-04", 940)],
      [budgetEntry("2026-01-03", 200)],
      [payPeriod("2026-01-02", 300)],
      20,
      { logger: (details) => logs.push(details) }
    );

    expect(timeline).toEqual([
      { cumulative: 0, trackedDays: 0 },
      { cumulative: -100, trackedDays: 3 },
    ]);
    expect(logs).toEqual([
      {
        previousDate: "2026-01-01",
        currentDate: "2026-01-04",
        daysGap: 3,
        previousBalance: 1000,
        actualBalance: 940,
        salaryReceived: 300,
        expensesDue: 200,
        adhocBudget: 60,
        expectedBalance: 1040,
        delta: -100,
        cumulative: -100,
        trackedDays: 3,
        status: "over-budget",
      },
    ]);
  });

  it("excludes prior-date transactions and includes current-date transactions", () => {
    const logs: AdhocSavingsCalculationLog[] = [];

    const finalSavings = calculateAdhocSavings(
      [balanceHistory("2026-01-01", 1000), balanceHistory("2026-01-04", 1045)],
      [
        budgetEntry("2026-01-01", 999),
        budgetEntry("2026-01-04", 25),
      ],
      [
        payPeriod("2026-01-01", 999),
        payPeriod("2026-01-04", 100),
      ],
      10,
      { logger: (details) => logs.push(details) }
    );

    expect(finalSavings).toEqual({ cumulative: 0, trackedDays: 3 });
    expect(logs[0]).toMatchObject({
      salaryReceived: 100,
      expensesDue: 25,
      adhocBudget: 30,
      expectedBalance: 1045,
      delta: 0,
      status: "on-budget",
    });
  });

  it("does not report savings without two balance checks", () => {
    expect(calculateAdhocSavings([], [], [], 40)).toBeNull();
    expect(
      calculateAdhocSavings([balanceHistory("2026-01-01", 1000)], [], [], 40)
    ).toBeNull();
  });

  it("matches actual-minus-expected over generated single intervals", () => {
    fc.assert(
      fc.property(
        fc.record({
          previousBalanceCents: fc.integer({ min: 1_000_000, max: 2_000_000 }),
          salaryCents: fc.integer({ min: 0, max: 200_000 }),
          expenseCents: fc.integer({ min: 0, max: 200_000 }),
          dailyAmountCents: fc.integer({ min: 0, max: 5_000 }),
          daysGap: fc.integer({ min: 1, max: 30 }),
          deltaCents: fc.integer({ min: -100_000, max: 100_000 }),
        }),
        ({
          previousBalanceCents,
          salaryCents,
          expenseCents,
          dailyAmountCents,
          daysGap,
          deltaCents,
        }) => {
          const startDate = "2026-01-01";
          const endDate = addDays(startDate, daysGap);
          const expectedCents =
            previousBalanceCents +
            salaryCents -
            expenseCents -
            daysGap * dailyAmountCents;
          const actualCents = expectedCents + deltaCents;
          const logs: AdhocSavingsCalculationLog[] = [];

          const timeline = calculateAdhocSavingsTimeline(
            [
              balanceHistory(startDate, previousBalanceCents / 100),
              balanceHistory(endDate, actualCents / 100),
            ],
            [budgetEntry(endDate, expenseCents / 100)],
            [payPeriod(endDate, salaryCents / 100)],
            dailyAmountCents / 100,
            { logger: (details) => logs.push(details) }
          );

          expect(timeline[1].cumulative).toBeCloseTo(deltaCents / 100, 2);
          expect(logs[0].delta).toBeCloseTo(deltaCents / 100, 2);
          expect(logs[0].status).toBe(
            deltaCents > 0
              ? "under-budget"
              : deltaCents < 0
              ? "over-budget"
              : "on-budget"
          );
        }
      )
    );
  });
});
