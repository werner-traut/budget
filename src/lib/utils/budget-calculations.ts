import type { BalanceHistory } from "@/types/balanceHistory";
import type { BudgetEntry } from "@/types/budget";
import type { PayPeriod } from "@/types/periods";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface AdhocSavingsPoint {
  cumulative: number;
  trackedDays: number;
}

export interface MonthlyBudgetOverview {
  totalExpenses: number;
  totalIncome: number;
  totalAdhoc: number;
  difference: number;
}

export interface AdhocSavingsCalculationLog {
  previousDate: string;
  currentDate: string;
  daysGap: number;
  previousBalance: number;
  actualBalance: number;
  salaryReceived: number;
  expensesDue: number;
  adhocBudget: number;
  expectedBalance: number;
  delta: number;
  cumulative: number;
  trackedDays: number;
  status: "under-budget" | "over-budget" | "on-budget";
}

export interface AdhocSavingsCalculationOptions {
  logger?: (details: AdhocSavingsCalculationLog) => void;
}

export function createAdhocSavingsConsoleLogger(
  label: string
): AdhocSavingsCalculationOptions["logger"] {
  return (details) => {
    console.debug(`[budget-calculation:${label}]`, details);
  };
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function getBudgetStatus(delta: number): AdhocSavingsCalculationLog["status"] {
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
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
}

function sumPayPeriodsBetweenDates(
  payPeriods: PayPeriod[],
  startDate: Date,
  endDate: Date,
  includeStart: boolean
): number {
  return payPeriods
    .filter((period) => {
      const periodStart = new Date(period.start_date);
      return (
        (includeStart ? periodStart >= startDate : periodStart > startDate) &&
        periodStart <= endDate
      );
    })
    .reduce((sum, period) => sum + Number(period.salary_amount), 0);
}

export function calculateMonthlyBudgetOverview(
  entries: BudgetEntry[],
  payPeriods: PayPeriod[],
  dailyAmount: number,
  today: Date
): MonthlyBudgetOverview {
  const monthStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
  );
  const todayDay = today.getUTCDate();

  const totalExpenses = sumBudgetEntriesByProjectedDay(
    entries,
    today,
    1,
    todayDay
  );
  const totalIncome = sumPayPeriodsBetweenDates(
    payPeriods,
    monthStart,
    today,
    true
  );
  const totalAdhoc = todayDay * Number(dailyAmount);

  return {
    totalExpenses: roundCurrency(totalExpenses),
    totalIncome: roundCurrency(totalIncome),
    totalAdhoc: roundCurrency(totalAdhoc),
    difference: roundCurrency(totalIncome - totalExpenses - totalAdhoc),
  };
}

export function calculateMonthToDateAdhocSavings(
  history: BalanceHistory[],
  entries: BudgetEntry[],
  payPeriods: PayPeriod[],
  dailyAmount: number,
  today: Date,
  options: AdhocSavingsCalculationOptions = {}
): AdhocSavingsPoint | null {
  const monthHistory = [...history]
    .filter((entry) => {
      const balanceDate = new Date(entry.balance_date);
      return balanceDate <= today && isSameUtcMonth(balanceDate, today);
    })
    .sort(
      (a, b) =>
        new Date(a.balance_date).getTime() - new Date(b.balance_date).getTime()
    );

  if (!monthHistory.length) return null;

  const previous = monthHistory[0];
  const current = monthHistory[monthHistory.length - 1];
  const previousDate = new Date(previous.balance_date);
  const currentDate = new Date(current.balance_date);
  const startDay = previousDate.getUTCDate();
  const currentDay = currentDate.getUTCDate();
  const trackedDays = Math.max(0, currentDay - startDay + 1);

  const salaryReceived = sumPayPeriodsBetweenDates(
    payPeriods,
    previousDate,
    currentDate,
    true
  );
  const expensesDue = sumBudgetEntriesByProjectedDay(
    entries,
    currentDate,
    startDay,
    currentDay
  );
  const previousBalance = Number(previous.bank_balance);
  const actualBalance = Number(current.bank_balance);
  const adhocBudget = trackedDays * Number(dailyAmount);
  const expected = previousBalance + salaryReceived - expensesDue - adhocBudget;
  const delta = actualBalance - expected;
  const roundedDelta = roundCurrency(delta);

  options.logger?.({
    previousDate: previous.balance_date,
    currentDate: current.balance_date,
    daysGap: trackedDays,
    previousBalance,
    actualBalance,
    salaryReceived: roundCurrency(salaryReceived),
    expensesDue: roundCurrency(expensesDue),
    adhocBudget: roundCurrency(adhocBudget),
    expectedBalance: roundCurrency(expected),
    delta: roundedDelta,
    cumulative: roundedDelta,
    trackedDays,
    status: getBudgetStatus(roundedDelta),
  });

  return {
    cumulative: roundedDelta,
    trackedDays,
  };
}

export function calculateAdhocSavingsTimeline(
  history: BalanceHistory[],
  entries: BudgetEntry[],
  payPeriods: PayPeriod[],
  dailyAmount: number,
  options: AdhocSavingsCalculationOptions = {}
): AdhocSavingsPoint[] {
  let cumulative = 0;
  let trackedDays = 0;

  return history.map((entry, index) => {
    if (index > 0) {
      const previous = history[index - 1];
      const previousDate = new Date(previous.balance_date);
      const currentDate = new Date(entry.balance_date);
      const daysGap = Math.round(
        (currentDate.getTime() - previousDate.getTime()) / MS_PER_DAY
      );

      const salaryReceived = sumPayPeriodsBetweenDates(
        payPeriods,
        previousDate,
        currentDate,
        false
      );

      const expensesDue = entries
        .filter((budgetEntry) => {
          const dueDate = new Date(budgetEntry.due_date);
          return dueDate > previousDate && dueDate <= currentDate;
        })
        .reduce((sum, budgetEntry) => sum + Number(budgetEntry.amount), 0);

      const previousBalance = Number(previous.bank_balance);
      const actualBalance = Number(entry.bank_balance);
      const adhocBudget = daysGap * Number(dailyAmount);
      const expected =
        previousBalance +
        salaryReceived -
        expensesDue -
        adhocBudget;
      const delta = actualBalance - expected;

      cumulative += delta;
      trackedDays += daysGap;

      options.logger?.({
        previousDate: previous.balance_date,
        currentDate: entry.balance_date,
        daysGap,
        previousBalance,
        actualBalance,
        salaryReceived: roundCurrency(salaryReceived),
        expensesDue: roundCurrency(expensesDue),
        adhocBudget: roundCurrency(adhocBudget),
        expectedBalance: roundCurrency(expected),
        delta: roundCurrency(delta),
        cumulative: roundCurrency(cumulative),
        trackedDays,
        status: getBudgetStatus(roundCurrency(delta)),
      });
    }

    return {
      cumulative: roundCurrency(cumulative),
      trackedDays,
    };
  });
}

export function calculateAdhocSavings(
  history: BalanceHistory[],
  entries: BudgetEntry[],
  payPeriods: PayPeriod[],
  dailyAmount: number,
  options: AdhocSavingsCalculationOptions = {}
): AdhocSavingsPoint | null {
  if (history.length < 2) return null;

  const timeline = calculateAdhocSavingsTimeline(
    history,
    entries,
    payPeriods,
    dailyAmount,
    options
  );

  return timeline[timeline.length - 1] ?? null;
}
