import { describe, expect, it } from "vitest";
import {
  generateOccurrences,
  planMaterialization,
  type MaterializableItem,
  type RecurrenceRule,
} from "./recurrence";

function monthly(dayOfMonth: number, anchor = "2026-01-01"): RecurrenceRule {
  return {
    frequency: "MONTHLY",
    day_of_month: dayOfMonth,
    interval_weeks: null,
    anchor_date: anchor,
  };
}

function weekly(intervalWeeks: number, anchor: string): RecurrenceRule {
  return {
    frequency: "WEEKLY",
    day_of_month: null,
    interval_weeks: intervalWeeks,
    anchor_date: anchor,
  };
}

function perPeriod(anchor = "2026-01-01"): RecurrenceRule {
  return {
    frequency: "PER_PERIOD",
    day_of_month: null,
    interval_weeks: null,
    anchor_date: anchor,
  };
}

describe("generateOccurrences MONTHLY", () => {
  it("clamps day 31 to short months without drifting", () => {
    expect(generateOccurrences(monthly(31), "2026-01-01", "2026-04-30")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("uses Feb 29 in leap years", () => {
    expect(generateOccurrences(monthly(31), "2028-02-01", "2028-02-29")).toEqual([
      "2028-02-29",
    ]);
  });

  it("includes an occurrence landing exactly on the window start", () => {
    expect(generateOccurrences(monthly(15), "2026-03-15", "2026-03-31")).toEqual([
      "2026-03-15",
    ]);
  });

  it("excludes occurrences before the anchor date", () => {
    expect(
      generateOccurrences(monthly(10, "2026-02-20"), "2026-01-01", "2026-03-31")
    ).toEqual(["2026-03-10"]);
  });

  it("returns nothing for an inverted window", () => {
    expect(generateOccurrences(monthly(1), "2026-05-01", "2026-04-01")).toEqual([]);
  });
});

describe("generateOccurrences WEEKLY", () => {
  it("includes the anchor when the window starts on it", () => {
    expect(
      generateOccurrences(weekly(2, "2026-06-12"), "2026-06-12", "2026-07-31")
    ).toEqual(["2026-06-12", "2026-06-26", "2026-07-10", "2026-07-24"]);
  });

  it("starts at the next grid point when the window opens mid-cycle", () => {
    expect(
      generateOccurrences(weekly(2, "2026-06-12"), "2026-06-13", "2026-07-10")
    ).toEqual(["2026-06-26", "2026-07-10"]);
  });

  it("handles an anchor far in the past", () => {
    expect(
      generateOccurrences(weekly(1, "2025-01-03"), "2026-06-08", "2026-06-21")
    ).toEqual(["2026-06-12", "2026-06-19"]);
  });

  it("returns nothing when the anchor is after the window", () => {
    expect(
      generateOccurrences(weekly(1, "2026-09-01"), "2026-06-01", "2026-06-30")
    ).toEqual([]);
  });
});

describe("generateOccurrences PER_PERIOD", () => {
  const periodStarts = ["2026-06-15", "2026-06-30", "2026-07-15", "2026-07-31"];

  it("returns exactly the period starts inside the window", () => {
    expect(
      generateOccurrences(perPeriod(), "2026-06-20", "2026-07-20", periodStarts)
    ).toEqual(["2026-06-30", "2026-07-15"]);
  });

  it("respects the anchor as a floor", () => {
    expect(
      generateOccurrences(
        perPeriod("2026-07-01"),
        "2026-06-01",
        "2026-07-31",
        periodStarts
      )
    ).toEqual(["2026-07-15", "2026-07-31"]);
  });

  it("includes a period start equal to the window boundaries", () => {
    expect(
      generateOccurrences(perPeriod(), "2026-06-15", "2026-07-31", periodStarts)
    ).toEqual(periodStarts);
  });

  it("returns nothing without period starts", () => {
    expect(generateOccurrences(perPeriod(), "2026-06-01", "2026-07-31")).toEqual([]);
  });
});

describe("planMaterialization", () => {
  function item(
    rule: RecurrenceRule,
    materializedThrough: string | null,
    active = true
  ): MaterializableItem {
    return { rule, materialized_through: materializedThrough, active };
  }

  it("is idempotent: a second run after the watermark advances is empty", () => {
    const rule = monthly(31);
    const first = planMaterialization(item(rule, null), "2026-06-10", "2026-07-15");
    expect(first).toEqual(["2026-06-30"]);
    // simulate the watermark having advanced to the horizon
    expect(
      planMaterialization(item(rule, "2026-07-15"), "2026-06-10", "2026-07-15")
    ).toEqual([]);
  });

  it("yields only the new tail when the horizon extends", () => {
    const rule = weekly(2, "2026-06-12");
    expect(
      planMaterialization(item(rule, "2026-07-15"), "2026-06-10", "2026-07-31")
    ).toEqual(["2026-07-24"]);
  });

  it("clips backfill to the floor (today), not the anchor", () => {
    const rule = weekly(1, "2026-01-02");
    const planned = planMaterialization(item(rule, null), "2026-06-10", "2026-06-30");
    expect(planned).toEqual(["2026-06-12", "2026-06-19", "2026-06-26"]);
  });

  it("returns nothing for inactive items", () => {
    expect(
      planMaterialization(item(monthly(1), null, false), "2026-06-10", "2026-12-31")
    ).toEqual([]);
  });

  it("never resurrects occurrences at or below the watermark", () => {
    const rule = perPeriod();
    const periodStarts = ["2026-06-15", "2026-06-30", "2026-07-15"];
    expect(
      planMaterialization(
        item(rule, "2026-06-30"),
        "2026-06-10",
        "2026-07-15",
        periodStarts
      )
    ).toEqual(["2026-07-15"]);
  });
});
