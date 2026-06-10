import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
  calculateMonthlyBudgetOverview,
  calculatePeriodSummaries,
  computeAdhocSnapshot,
  getDaysBetween,
  sumMonthToDateAdhocSavings,
} from "./budget-calculations";
import type { BalanceHistory } from "@/types/balanceHistory";
import type { BudgetEntry } from "@/types/budget";
import type { PayPeriod } from "@/types/periods";

function budgetEntry(date: string, amount: number): BudgetEntry {
  return {
    id: `entry-${date}-${amount}`,
    user_id: "user-1",
    name: "Expense",
    amount,
    due_date: date,
    paid_at: null,
    actual_amount: null,
    source_recurring_id: null,
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

function historyRow(
  date: string,
  adhocDelta: number | null
): Pick<BalanceHistory, "balance_date" | "adhoc_delta"> {
  return { balance_date: date, adhoc_delta: adhocDelta };
}

describe("calculateMonthlyBudgetOverview", () => {
  it("counts only entries and pay periods dated in the current month", () => {
    const overview = calculateMonthlyBudgetOverview(
      [
        budgetEntry("2026-01-05", 300),
        budgetEntry("2026-01-20", 500),
        budgetEntry("2026-02-05", 200), // next month — excluded
        budgetEntry("2025-12-28", 150), // previous month — excluded
      ],
      [
        payPeriod("2026-01-02", 100),
        payPeriod("2026-01-20", 900),
        payPeriod("2026-02-03", 999), // next month — excluded
      ],
      20,
      new Date("2026-01-10T00:00:00.000Z")
    );

    expect(overview).toEqual({
      totalExpenses: 800,
      totalIncome: 1000,
      totalAdhoc: 620, // 31 days * 20
      difference: -420,
    });
  });
});

describe("calculateMonthlyBudgetOverview paid entries", () => {
  it("counts paid entries at their actual amount", () => {
    const paid = {
      ...budgetEntry("2026-01-20", 500),
      paid_at: "2026-01-19",
      actual_amount: 450,
    };
    const overview = calculateMonthlyBudgetOverview(
      [paid, budgetEntry("2026-01-05", 200)],
      [],
      0,
      new Date("2026-01-10T00:00:00.000Z")
    );

    expect(overview.totalExpenses).toBe(650);
  });

  it("falls back to the budgeted amount when no actual amount is stored", () => {
    const paid = { ...budgetEntry("2026-01-20", 500), paid_at: "2026-01-19" };
    const overview = calculateMonthlyBudgetOverview(
      [paid],
      [],
      0,
      new Date("2026-01-10T00:00:00.000Z")
    );

    expect(overview.totalExpenses).toBe(500);
  });
});

describe("calculatePeriodSummaries", () => {
  const today = new Date("2026-06-10T00:00:00.000Z");
  const periods = [
    { ...payPeriod("2026-06-01", 3000), period_type: "CURRENT_PERIOD" as const },
    { ...payPeriod("2026-06-20", 3000), period_type: "NEXT_PERIOD" as const },
    { ...payPeriod("2026-07-10", 3000), period_type: "PERIOD_AFTER" as const },
  ];

  it("buckets entries into [start, nextStart) windows and chains balances", () => {
    const summaries = calculatePeriodSummaries(
      [budgetEntry("2026-06-05", 100), budgetEntry("2026-06-20", 250)],
      periods,
      10,
      1000,
      today
    );

    const current = summaries.CURRENT_PERIOD;
    expect(current.entries).toHaveLength(1);
    expect(current.totalExpenses).toBe(100);
    expect(current.salary_amount).toBe(0);
    // 10 days remaining (06-10 → 06-20) * 10/day = 100 adhoc
    expect(current.daysInPeriod).toBe(10);
    expect(current.remaining).toBe(1000 - 100 - 100);

    const next = summaries.NEXT_PERIOD;
    expect(next.totalExpenses).toBe(250);
    // 20 days (06-20 → 07-10) * 10/day = 200 adhoc
    expect(next.remaining).toBe(current.remaining + 3000 - 250 - 200);
  });

  it("excludes paid entries from expenses but keeps them in the list", () => {
    const paid = {
      ...budgetEntry("2026-06-05", 100),
      paid_at: "2026-06-05",
      actual_amount: 90,
    };
    const summaries = calculatePeriodSummaries(
      [paid, budgetEntry("2026-06-07", 40)],
      periods,
      0,
      1000,
      today
    );

    const current = summaries.CURRENT_PERIOD;
    expect(current.entries).toHaveLength(2);
    expect(current.totalExpenses).toBe(40);
    expect(current.remaining).toBe(1000 - 40);
  });

  it("returns an empty record without pay periods", () => {
    expect(calculatePeriodSummaries([], [], 10, 100, today)).toEqual({});
  });
});

describe("getDaysBetween", () => {
  it("returns the whole-day gap between two UTC date strings", () => {
    expect(getDaysBetween("2026-01-01", "2026-01-04")).toBe(3);
    expect(getDaysBetween("2026-01-31", "2026-02-01")).toBe(1);
    expect(getDaysBetween("2026-01-10", "2026-01-10")).toBe(0);
  });
});

describe("computeAdhocSnapshot", () => {
  it("reports over-budget when actual balance trails expectation", () => {
    const result = computeAdhocSnapshot({
      previousBalance: 1000,
      previousCumulative: 0,
      actualBalance: 1000,
      salaryReceived: 300,
      expensesDue: 200,
      daysGap: 3,
      dailyAmount: 20,
    });

    // expected = 1000 + 300 - 200 - 60 = 1040; delta = 1000 - 1040 = -40
    expect(result).toEqual({
      delta: -40,
      cumulative: -40,
      adhocBudget: 60,
      expectedBalance: 1040,
      status: "over-budget",
    });
  });

  it("chains cumulative onto the previous running total", () => {
    const result = computeAdhocSnapshot({
      previousBalance: 500,
      previousCumulative: 125,
      actualBalance: 600,
      salaryReceived: 0,
      expensesDue: 0,
      daysGap: 1,
      dailyAmount: 40,
    });

    // expected = 500 - 40 = 460; delta = 600 - 460 = 140; cumulative = 125 + 140
    expect(result.delta).toBe(140);
    expect(result.cumulative).toBe(265);
    expect(result.status).toBe("under-budget");
  });

  it("treats a zero delta as on-budget", () => {
    const result = computeAdhocSnapshot({
      previousBalance: 1000,
      previousCumulative: 0,
      actualBalance: 940,
      salaryReceived: 0,
      expensesDue: 0,
      daysGap: 3,
      dailyAmount: 20,
    });

    expect(result.delta).toBe(0);
    expect(result.status).toBe("on-budget");
  });

  it("clamps negative day gaps so adhoc budget never goes negative", () => {
    const result = computeAdhocSnapshot({
      previousBalance: 1000,
      previousCumulative: 0,
      actualBalance: 1000,
      salaryReceived: 0,
      expensesDue: 0,
      daysGap: -5,
      dailyAmount: 20,
    });

    expect(result.adhocBudget).toBe(0);
  });

  it("matches actual-minus-expected over generated inputs", () => {
    fc.assert(
      fc.property(
        fc.record({
          previousBalanceCents: fc.integer({ min: 1_000_000, max: 2_000_000 }),
          previousCumulativeCents: fc.integer({ min: -100_000, max: 100_000 }),
          salaryCents: fc.integer({ min: 0, max: 200_000 }),
          expenseCents: fc.integer({ min: 0, max: 200_000 }),
          dailyAmountCents: fc.integer({ min: 0, max: 5_000 }),
          daysGap: fc.integer({ min: 1, max: 30 }),
          deltaCents: fc.integer({ min: -100_000, max: 100_000 }),
        }),
        ({
          previousBalanceCents,
          previousCumulativeCents,
          salaryCents,
          expenseCents,
          dailyAmountCents,
          daysGap,
          deltaCents,
        }) => {
          const expectedCents =
            previousBalanceCents +
            salaryCents -
            expenseCents -
            daysGap * dailyAmountCents;
          const actualCents = expectedCents + deltaCents;

          const result = computeAdhocSnapshot({
            previousBalance: previousBalanceCents / 100,
            previousCumulative: previousCumulativeCents / 100,
            actualBalance: actualCents / 100,
            salaryReceived: salaryCents / 100,
            expensesDue: expenseCents / 100,
            daysGap,
            dailyAmount: dailyAmountCents / 100,
          });

          expect(result.delta).toBeCloseTo(deltaCents / 100, 2);
          expect(result.cumulative).toBeCloseTo(
            (previousCumulativeCents + deltaCents) / 100,
            2
          );
          expect(result.status).toBe(
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

describe("sumMonthToDateAdhocSavings", () => {
  const today = new Date("2026-06-10T00:00:00.000Z");

  it("returns null when there are no tracked rows this month", () => {
    expect(sumMonthToDateAdhocSavings([], today)).toBeNull();
    expect(
      sumMonthToDateAdhocSavings([historyRow("2026-06-02", null)], today)
    ).toBeNull();
  });

  it("sums stored deltas within the current UTC month only", () => {
    const result = sumMonthToDateAdhocSavings(
      [
        historyRow("2026-05-31", 999), // previous month — ignored
        historyRow("2026-06-01", 0), // baseline
        historyRow("2026-06-04", -25.5),
        historyRow("2026-06-08", 100),
        historyRow("2026-06-20", 50), // future-dated — ignored
      ],
      today
    );

    expect(result).not.toBeNull();
    expect(result?.cumulative).toBe(74.5);
    expect(result?.status).toBe("under-budget");
    // first tracked row 06-01 .. last tracked row 06-08 = 8 days
    expect(result?.trackedDays).toBe(8);
  });

  it("ignores rows without a stored delta", () => {
    const result = sumMonthToDateAdhocSavings(
      [
        historyRow("2026-06-02", null),
        historyRow("2026-06-05", -40),
      ],
      today
    );

    expect(result?.cumulative).toBe(-40);
    expect(result?.status).toBe("over-budget");
    expect(result?.trackedDays).toBe(1);
  });
});
