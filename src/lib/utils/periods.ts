import { getTodayInUTC } from "./date";
import { PayPeriod, PeriodType } from "@/types/periods";

export function shouldCascadePeriods(periods: PayPeriod[]): boolean {
  const nextPeriod = periods.find((p) => p.period_type === "NEXT_PERIOD");
  if (!nextPeriod) return false;

  const today = getTodayInUTC();
  const nextPeriodStart = new Date(nextPeriod.start_date);

  return nextPeriodStart <= today;
}

export function cascadePeriodTypes(periods: PayPeriod[]): PayPeriod[] {
  // Sort periods by start date
  const sortedPeriods = [...periods].sort(
    (a, b) =>
      new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );

  // Get active periods (excluding already closed ones)
  const activePeriods = sortedPeriods.filter(
    (p) => p.period_type !== "CLOSED_PERIOD"
  );

  // Map of current type to next type in the cascade
  const cascadeMap: Record<PeriodType, PeriodType> = {
    CURRENT_PERIOD: "CLOSED_PERIOD",
    NEXT_PERIOD: "CURRENT_PERIOD",
    PERIOD_AFTER: "NEXT_PERIOD",
    FUTURE_PERIOD: "PERIOD_AFTER",
    CLOSED_PERIOD: "CLOSED_PERIOD",
  };

  // Update period types
  return activePeriods.map((period) => ({
    ...period,
    period_type:
      period.period_type !== "CLOSED_PERIOD"
        ? cascadeMap[period.period_type]
        : period.period_type,
  }));
}
