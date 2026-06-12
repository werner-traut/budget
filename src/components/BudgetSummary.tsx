"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Repeat } from "lucide-react";
import { formatDateForDisplay, getTodayInUTC } from "@/lib/utils/date";
import {
  calculateMonthlyBudgetOverview,
  calculatePeriodSummaries,
  sumMonthToDateAdhocSavings,
} from "@/lib/utils/budget-calculations";
import { useBudgetStore } from "@/store/useBudgetStore";
import type { BalanceHistory } from "@/types/balanceHistory";
import type { PayPeriod } from "@/types/periods";

export function BudgetSummary() {
  const { 
    entries, 
    payPeriods,
    dailyBalance,
    adhocSettings,
    setAdhocSettings,
    setError 
  } = useBudgetStore();
  
  const [isEditingAdhoc, setIsEditingAdhoc] = useState(false);
  const [newDailyAmount, setNewDailyAmount] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [monthlyHistory, setMonthlyHistory] = useState<BalanceHistory[]>([]);
  const [monthlyPayPeriods, setMonthlyPayPeriods] = useState<
    PayPeriod[] | null
  >(null);

  const fetchMonthlyHistory = useCallback(async () => {
    const today = getTodayInUTC();
    const startOfMonth = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
    );
    const startDateStr = startOfMonth.toISOString().split("T")[0];
    try {
      const response = await fetch(
        `/api/balance-history?startDate=${startDateStr}`
      );
      if (response.ok) setMonthlyHistory(await response.json());
    } catch {
      // Non-fatal: the month-to-date card simply stays hidden.
    }
  }, []);

  useEffect(() => {
    fetchMonthlyHistory();
  }, [fetchMonthlyHistory]);

  useEffect(() => {
    const today = getTodayInUTC();
    const currentYear = today.getUTCFullYear();
    const currentMonth = today.getUTCMonth();
    const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
    const startOfNextMonth = new Date(
      Date.UTC(currentYear, currentMonth + 1, 1)
    );
    const startDateStr = startOfMonth.toISOString().split("T")[0];
    const endDateStr = startOfNextMonth.toISOString().split("T")[0];

    fetch(
      `/api/pay-periods?includeClosed=true&startDate=${startDateStr}&endDate=${endDateStr}`
    )
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch monthly pay periods");
        return r.json();
      })
      .then((data: PayPeriod[]) =>
        setMonthlyPayPeriods(
          data.map((period) => ({
            ...period,
            salary_amount: Number(period.salary_amount),
          }))
        )
      )
      .catch(() => {
        setMonthlyPayPeriods(null);
      });
  }, [payPeriods]);

  const incomePayPeriods = monthlyPayPeriods ?? payPeriods;

  const monthlySavings = useMemo(() => {
    const today = getTodayInUTC();
    return sumMonthToDateAdhocSavings(monthlyHistory, today);
  }, [monthlyHistory]);

  const monthlyOverview = useMemo(() => {
    const today = getTodayInUTC();
    return calculateMonthlyBudgetOverview(
      entries,
      incomePayPeriods,
      adhocSettings.daily_amount,
      today
    );
  }, [entries, incomePayPeriods, adhocSettings.daily_amount]);

  const periods = useMemo(() => {
    return calculatePeriodSummaries(
      entries,
      payPeriods,
      adhocSettings.daily_amount,
      dailyBalance,
      getTodayInUTC()
    );
  }, [entries, payPeriods, adhocSettings.daily_amount, dailyBalance]);

  useEffect(() => {
    // Save balance history whenever periods calculations change
    const saveBalanceHistory = async () => {
      if (!periods.CURRENT_PERIOD) return;

      try {
        await fetch("/api/balance-history", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bankBalance: dailyBalance,
            currentPeriodEndBalance: periods.CURRENT_PERIOD.remaining,
            nextPeriodEndBalance: periods.NEXT_PERIOD.remaining,
            periodAfterEndBalance: periods.PERIOD_AFTER.remaining,
            dailyExpenses: adhocSettings.daily_amount,
          }),
        });
        // The server computes the adhoc variance for today's snapshot, so
        // refresh the month's history to reflect it in the card.
        await fetchMonthlyHistory();
      } catch (err) {
        console.error("Error saving balance history:", err);
      }
    };

    saveBalanceHistory();
  }, [periods, dailyBalance, adhocSettings.daily_amount, fetchMonthlyHistory]);

  const resetAdhocBaseline = async () => {
    setIsResetting(true);
    try {
      const response = await fetch("/api/balance-history/reset", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to reset adhoc savings");
      await fetchMonthlyHistory();
    } catch (err) {
      console.error("Error resetting adhoc savings:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsResetting(false);
    }
  };

  const updateAdhocAmount = async () => {
    try {
      const response = await fetch("/api/adhoc-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_amount: parseFloat(newDailyAmount) }),
      });

      if (!response.ok) throw new Error("Failed to update adhoc amount");
      const data = await response.json();
      setAdhocSettings(data);
      setIsEditingAdhoc(false);
    } catch (err) {
      console.error("Error updating adhoc amount:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const periodCards = [
    { key: "CURRENT_PERIOD", title: "This Period" },
    { key: "NEXT_PERIOD", title: "Next Period" },
    { key: "PERIOD_AFTER", title: "Period After" },
  ];

  return (
    <div className="space-y-4">
      {/* Adhoc Settings */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Daily Adhoc Amount</CardTitle>
            <Button
              variant="outline"
              onClick={() => {
                setNewDailyAmount(adhocSettings.daily_amount.toString());
                setIsEditingAdhoc(true);
              }}
            >
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isEditingAdhoc ? (
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                value={newDailyAmount}
                onChange={(e) => setNewDailyAmount(e.target.value)}
                step="0.01"
                className="w-32"
              />
              <Button onClick={updateAdhocAmount}>Save</Button>
              <Button
                variant="outline"
                onClick={() => setIsEditingAdhoc(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="font-mono text-2xl font-semibold tabular-nums">
              ${Number(adhocSettings.daily_amount).toFixed(2)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                / day
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Monthly Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6 text-center sm:grid-cols-4 sm:divide-x sm:divide-border/70">
            <div>
              <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Total Expenses
              </div>
              <div className="font-mono text-2xl font-semibold tabular-nums">
                ${monthlyOverview.totalExpenses.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Total Adhoc
              </div>
              <div className="font-mono text-2xl font-semibold tabular-nums">
                ${monthlyOverview.totalAdhoc.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Income This Month
              </div>
              <div className="font-mono text-2xl font-semibold tabular-nums">
                ${monthlyOverview.totalIncome.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Difference
              </div>
              <div
                className={`font-mono text-2xl font-semibold tabular-nums ${
                  monthlyOverview.difference >= 0
                    ? "text-positive"
                    : "text-destructive"
                }`}
              >
                ${monthlyOverview.difference.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t flex items-center justify-between">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Month-to-date adhoc savings
              </div>
              {monthlySavings !== null ? (
                <div className="text-xs text-muted-foreground/70 mt-0.5">
                  actual spend vs budget over {monthlySavings.trackedDays} tracked day
                  {monthlySavings.trackedDays !== 1 ? "s" : ""}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground/70 mt-0.5">
                  no tracked snapshots yet this month
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-7 px-2 text-xs"
                onClick={resetAdhocBaseline}
                disabled={isResetting}
              >
                {isResetting ? "Resetting…" : "Reset baseline"}
              </Button>
            </div>
            <div className="text-right">
              {monthlySavings !== null ? (
                <>
                  <div
                    className={`font-mono text-2xl font-semibold tabular-nums ${
                      monthlySavings.cumulative >= 0
                        ? "text-positive"
                        : "text-destructive"
                    }`}
                  >
                    {monthlySavings.cumulative >= 0 ? "+" : ""}
                    ${Math.abs(monthlySavings.cumulative).toFixed(2)}
                  </div>
                  <div className="font-display text-xs italic text-muted-foreground mt-0.5">
                    {monthlySavings.cumulative > 0
                      ? "under budget"
                      : monthlySavings.cumulative < 0
                      ? "over budget"
                      : "on budget"}
                  </div>
                </>
              ) : (
                <div className="font-mono text-2xl font-semibold text-muted-foreground/40">—</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Period Summaries */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {periodCards.map(({ key, title }) => {
          const period = periods[key as keyof typeof periods];
          if (!period) return null;

          return (
            <Card key={key} className={key === "CURRENT_PERIOD" ? "border-primary/50" : ""}>
              <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
                <div className="font-mono text-xs tabular-nums text-muted-foreground">
                  {formatDateForDisplay(period.periodStart)}
                  {period.periodEnd &&
                    ` — ${formatDateForDisplay(period.periodEnd)}`}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2 text-sm">
                    {period.entries.length > 0 ? (
                      period.entries.map((entry) => (
                        <div
                          key={entry.id}
                          className={`grid grid-cols-[1fr_auto_auto] gap-2 ${
                            entry.paid_at
                              ? "text-muted-foreground/60 line-through decoration-foreground/30"
                              : ""
                          }`}
                        >
                          <span className="flex items-center gap-1 truncate">
                            {entry.name}
                            {entry.source_recurring_id && (
                              <Repeat
                                className="h-3 w-3 text-muted-foreground/60 shrink-0"
                                aria-label="Created by recurring item"
                              />
                            )}
                          </span>
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {formatDateForDisplay(entry.due_date)}
                          </span>
                          <span className="font-mono tabular-nums">
                            ${Number(entry.actual_amount ?? entry.amount).toFixed(2)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="font-display italic text-muted-foreground">
                        No expenses
                      </div>
                    )}
                  </div>

                  <div className="border-t-2 border-foreground/50 pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pay</span>
                      <span className="font-mono tabular-nums">
                        ${Number(period.salary_amount).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Expenses</span>
                      <span className="font-mono tabular-nums">
                        ${Number(period.totalExpenses).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Days remaining</span>
                      <span className="font-mono tabular-nums">
                        {period.daysInPeriod}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Adhoc</span>
                      <span className="font-mono tabular-nums">
                        ${Number(period.adhocTotal).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between border-t border-border/70 pt-2">
                      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        Balance
                      </span>
                      <span
                        className={`font-mono text-lg font-semibold tabular-nums ${
                          period.remaining < 0
                            ? "text-destructive"
                            : "text-positive"
                        }`}
                      >
                        ${Number(period.remaining).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
