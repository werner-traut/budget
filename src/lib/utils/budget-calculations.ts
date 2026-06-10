import type { BalanceHistory } from "@/types/balanceHistory";
import type { BudgetEntry } from "@/types/budget";
import type { PayPeriod } from "@/types/periods";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type AdhocBudgetStatus = "under-budget" | "over-budget" | "on-budget";

export interface MonthlyBudgetOverview {
  totalExpenses: number;
  totalIncome: number;
  totalAdhoc: number;
  difference: number;
}

export interface MonthToDateAdhocSavings {
  cumulative: number;
  trackedDays: number;
  status: AdhocBudgetStatus;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function getBudgetStatus(delta: number): AdhocBudgetStatus {
  if (delta > 0) return "under-budget";
  if (delta < 0) return "over-budget";
  return "on-budget";
}

function isSameUtcMonth(date: Date, monthDate: Date): boolean {
  return (
    date.getUTCFullYear() === monthDate.getUTCFullYear() &&
    date.getUTCMonth() === monthDate.getUTCMonth()
  );
}

function getDaysInUtcMonth(date: Date): number {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  ).getUTCDate();
}

function getProjectedMonthlyDueDay(entry: BudgetEntry, monthDate: Date): number {
  const dueDate = new Date(entry.due_date);
  return Math.min(dueDate.getUTCDate(), getDaysInUtcMonth(monthDate));
}

function sumBudgetEntriesByProjectedDay(
  entries: BudgetEntry[],
  monthDate: Date,
  startDay: number,
  endDay: number
): number {
  return entries
    .filter((entry) => {
      const projectedDueDay = getProjectedMonthlyDueDay(entry, monthDate);
      return projectedDueDay >= startDay && projectedDueDay <= endDay;
    })
    // Paid entries count at what was actually paid so the month's plan stays
    // comparable to income; they are not excluded here (this is a full-month
    // plan view, not a remaining-balance projection).
    .reduce(
      (sum, entry) => sum + Number(entry.actual_amount ?? entry.amount),
      0
    );
}

function sumPayPeriodsInUtcMonth(payPeriods: PayPeriod[], monthDate: Date): number {
  return payPeriods
    .filter((period) => {
      const periodStart = new Date(period.start_date);
      return isSameUtcMonth(periodStart, monthDate);
    })
    .reduce((sum, period) => sum + Number(period.salary_amount), 0);
}

/**
 * Static "plan" view of the current calendar month: what the full month is
 * expected to cost (expenses + adhoc allowance) against expected income. This
 * is intentionally a projection from the current budget configuration and is
 * unrelated to recorded balance history.
 */
export function calculateMonthlyBudgetOverview(
  entries: BudgetEntry[],
  payPeriods: PayPeriod[],
  dailyAmount: number,
  today: Date
): MonthlyBudgetOverview {
  const daysInMonth = getDaysInUtcMonth(today);

  const totalExpenses = sumBudgetEntriesByProjectedDay(
    entries,
    today,
    1,
    daysInMonth
  );
  const totalIncome = sumPayPeriodsInUtcMonth(payPeriods, today);
  const totalAdhoc = daysInMonth * Number(dailyAmount);

  return {
    totalExpenses: roundCurrency(totalExpenses),
    totalIncome: roundCurrency(totalIncome),
    totalAdhoc: roundCurrency(totalAdhoc),
    difference: roundCurrency(totalIncome - totalExpenses - totalAdhoc),
  };
}

export interface PeriodSummary {
  entries: BudgetEntry[];
  totalExpenses: number;
  periodStart: string;
  periodEnd: string | null;
  salary_amount: number;
  adhocTotal: number;
  daysInPeriod: number;
  remaining: number;
}

/**
 * Running end-of-period balance projection across the user's pay periods.
 *
 * The chain seeds from the live bank balance, so paid entries are excluded
 * from each period's expenses — the bank balance already reflects that money
 * leaving. The current period contributes no salary (already received) and
 * its adhoc allowance only covers the days still ahead.
 */
export function calculatePeriodSummaries(
  entries: BudgetEntry[],
  payPeriods: PayPeriod[],
  dailyAmount: number,
  dailyBalance: number | null,
  today: Date
): Record<string, PeriodSummary> {
  if (!payPeriods.length) return {};

  let previousRemaining = Number(dailyBalance) ? Number(dailyBalance) : 0;

  return payPeriods.reduce((acc, period, index) => {
    const nextPeriod = payPeriods[index + 1];
    const periodStart = new Date(period.start_date);
    const periodEnd = nextPeriod ? new Date(nextPeriod.start_date) : null;

    const periodEntries = entries.filter((entry) => {
      const entryDate = new Date(entry.due_date);
      if (!periodEnd) return entryDate >= periodStart;
      return entryDate >= periodStart && entryDate < periodEnd;
    });

    const totalExpenses = periodEntries
      .filter((entry) => !entry.paid_at)
      .reduce((sum, entry) => sum + Number(entry.amount), 0);

    let daysInPeriod;
    if (period.period_type === "CURRENT_PERIOD") {
      daysInPeriod = periodEnd
        ? Math.max(
            0,
            Math.ceil((periodEnd.getTime() - today.getTime()) / MS_PER_DAY)
          )
        : 0;
    } else {
      daysInPeriod = periodEnd
        ? Math.ceil((periodEnd.getTime() - periodStart.getTime()) / MS_PER_DAY)
        : 0;
    }

    const adhocTotal = daysInPeriod * Number(dailyAmount);

    const payAmount =
      period.period_type === "CURRENT_PERIOD" ? 0 : Number(period.salary_amount);
    const remaining = previousRemaining + payAmount - totalExpenses - adhocTotal;
    previousRemaining = remaining;

    acc[period.period_type] = {
      entries: periodEntries,
      totalExpenses,
      periodStart: period.start_date,
      periodEnd: nextPeriod?.start_date || null,
      salary_amount: payAmount,
      adhocTotal,
      daysInPeriod,
      remaining,
    };

    return acc;
  }, {} as Record<string, PeriodSummary>);
}

export interface AdhocSnapshotInput {
  /** Bank balance recorded on the previous tracked snapshot. */
  previousBalance: number;
  /** Cumulative savings carried forward from the previous tracked snapshot. */
  previousCumulative: number;
  /** Bank balance recorded on the snapshot being computed. */
  actualBalance: number;
  /** Salary received in the window (previousDate, currentDate]. */
  salaryReceived: number;
  /** Budgeted expenses due in the window (previousDate, currentDate]. */
  expensesDue: number;
  /** Whole days between the previous snapshot and this one. */
  daysGap: number;
  /** Daily adhoc allowance in effect for this window. */
  dailyAmount: number;
}

export interface AdhocSnapshotResult {
  delta: number;
  cumulative: number;
  adhocBudget: number;
  expectedBalance: number;
  status: AdhocBudgetStatus;
}

/**
 * Pure computation of a single balance snapshot's adhoc variance.
 *
 * The snapshot's "expected" balance is the previous balance plus salary, minus
 * budgeted expenses and the adhoc allowance accrued over the gap. The delta is
 * how the actual balance compares (positive = under budget / saved money), and
 * cumulative chains that onto the previous running total.
 *
 * This is computed once at write time and frozen, so later edits to entries,
 * pay periods, or the daily amount cannot rewrite historical variance.
 */
export function computeAdhocSnapshot(
  input: AdhocSnapshotInput
): AdhocSnapshotResult {
  const adhocBudget = Math.max(0, input.daysGap) * Number(input.dailyAmount);
  const expectedBalance =
    input.previousBalance +
    input.salaryReceived -
    input.expensesDue -
    adhocBudget;
  const delta = input.actualBalance - expectedBalance;
  const cumulative = input.previousCumulative + delta;

  return {
    delta: roundCurrency(delta),
    cumulative: roundCurrency(cumulative),
    adhocBudget: roundCurrency(adhocBudget),
    expectedBalance: roundCurrency(expectedBalance),
    status: getBudgetStatus(roundCurrency(delta)),
  };
}

/** Whole-day gap between two UTC date-only values. */
export function getDaysBetween(previous: string | Date, current: string | Date): number {
  const previousTime = new Date(previous).getTime();
  const currentTime = new Date(current).getTime();
  return Math.round((currentTime - previousTime) / MS_PER_DAY);
}

/**
 * Month-to-date adhoc savings derived from stored, immutable snapshot deltas.
 * Sums the persisted `adhoc_delta` of every snapshot recorded in the current
 * UTC month. Rows without a stored delta (recorded before tracking began, or
 * baselines) contribute nothing. Returns null when the month has no data yet.
 */
export function sumMonthToDateAdhocSavings(
  history: Pick<BalanceHistory, "balance_date" | "adhoc_delta">[],
  today: Date
): MonthToDateAdhocSavings | null {
  const monthRows = history.filter((row) => {
    const balanceDate = new Date(row.balance_date);
    return (
      row.adhoc_delta !== null &&
      row.adhoc_delta !== undefined &&
      balanceDate <= today &&
      isSameUtcMonth(balanceDate, today)
    );
  });

  if (!monthRows.length) return null;

  const cumulative = monthRows.reduce(
    (sum, row) => sum + Number(row.adhoc_delta),
    0
  );

  const dates = monthRows
    .map((row) => new Date(row.balance_date).getTime())
    .sort((a, b) => a - b);
  const trackedDays = getDaysBetween(new Date(dates[0]), new Date(dates[dates.length - 1])) + 1;

  const rounded = roundCurrency(cumulative);
  return {
    cumulative: rounded,
    trackedDays,
    status: getBudgetStatus(rounded),
  };
}
