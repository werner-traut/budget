import { formatDateForAPI, parseDateStringToUTC } from "./date";

export interface RecurrenceRule {
  frequency: "MONTHLY" | "WEEKLY" | "PER_PERIOD";
  day_of_month: number | null;
  interval_weeks: number | null;
  anchor_date: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDaysToDateString(date: string, days: number): string {
  const utc = parseDateStringToUTC(date);
  return formatDateForAPI(new Date(utc.getTime() + days * MS_PER_DAY));
}

function diffDays(from: string, to: string): number {
  return Math.round(
    (parseDateStringToUTC(to).getTime() - parseDateStringToUTC(from).getTime()) /
      MS_PER_DAY
  );
}

function maxDateString(a: string, b: string): string {
  return a >= b ? a : b;
}

/**
 * Generates occurrence dates for a recurrence rule within an inclusive window.
 *
 * - MONTHLY: one occurrence per calendar month on `day_of_month`, clamped to
 *   the month's length (day 31 yields Feb 28/29 but returns to Mar 31 — the
 *   day is derived from the rule each month, never from the prior occurrence).
 * - WEEKLY: anchor_date + 7 * interval_weeks * k for k >= 0.
 * - PER_PERIOD: the supplied pay period start dates. The schedule is not
 *   derivable from the rule alone, so callers pass the user's period starts;
 *   the other frequencies ignore them.
 *
 * All dates are UTC date-only strings ("yyyy-MM-dd"), returned ascending.
 */
export function generateOccurrences(
  rule: RecurrenceRule,
  fromInclusive: string,
  throughInclusive: string,
  periodStartDates: string[] = []
): string[] {
  const from = maxDateString(fromInclusive, rule.anchor_date);
  if (from > throughInclusive) return [];

  switch (rule.frequency) {
    case "MONTHLY": {
      if (!rule.day_of_month) return [];
      const occurrences: string[] = [];
      const [fromYear, fromMonth] = from.split("-").map(Number);
      const [throughYear, throughMonth] = throughInclusive
        .split("-")
        .map(Number);

      let year = fromYear;
      let month = fromMonth;
      while (year < throughYear || (year === throughYear && month <= throughMonth)) {
        const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const day = Math.min(rule.day_of_month, daysInMonth);
        const occurrence = `${year}-${String(month).padStart(2, "0")}-${String(
          day
        ).padStart(2, "0")}`;
        if (occurrence >= from && occurrence <= throughInclusive) {
          occurrences.push(occurrence);
        }
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
      }
      return occurrences;
    }

    case "WEEKLY": {
      if (!rule.interval_weeks || rule.interval_weeks < 1) return [];
      const stepDays = 7 * rule.interval_weeks;
      const daysFromAnchor = diffDays(rule.anchor_date, from);
      const firstK = Math.max(0, Math.ceil(daysFromAnchor / stepDays));
      const occurrences: string[] = [];
      for (let k = firstK; ; k++) {
        const occurrence = addDaysToDateString(rule.anchor_date, k * stepDays);
        if (occurrence > throughInclusive) break;
        occurrences.push(occurrence);
      }
      return occurrences;
    }

    case "PER_PERIOD":
      return [...periodStartDates]
        .map((d) => formatDateForAPI(d))
        .filter((d) => d >= from && d <= throughInclusive)
        .sort();
  }
}

export interface MaterializableItem {
  rule: RecurrenceRule;
  materialized_through: string | null;
  active: boolean;
}

/**
 * Plans which occurrence dates still need budget_items instances: those in
 * (materialized_through, horizon], never earlier than `floor` (today) so a
 * newly created template does not backfill the past. The watermark — not the
 * DB unique index — is what keeps an instance the user deleted from being
 * recreated by the next run.
 */
export function planMaterialization(
  item: MaterializableItem,
  floor: string,
  horizon: string,
  periodStartDates: string[] = []
): string[] {
  if (!item.active) return [];
  let from = floor;
  if (item.materialized_through !== null) {
    if (item.materialized_through >= horizon) return [];
    from = maxDateString(floor, addDaysToDateString(item.materialized_through, 1));
  }
  return generateOccurrences(item.rule, from, horizon, periodStartDates);
}
