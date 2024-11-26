"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { BudgetEntry } from "@/types/budget";
import { formatDateForDisplay } from "@/lib/utils/date";

interface PayPeriod {
  id: string;
  start_date: string;
  period_type:
    | "CURRENT_PERIOD"
    | "NEXT_PERIOD"
    | "PERIOD_AFTER"
    | "FUTURE_PERIOD";
  salary_amount: number;
}

interface PeriodSummary {
  entries: BudgetEntry[];
  totalExpenses: number;
  periodStart: string;
  periodEnd: string | null;
  salary_amount: number;
  adhocTotal: number;
  daysInPeriod: number;
  remaining: number;
}

interface AdhocSettings {
  daily_amount: number;
}

export function BudgetSummary({
  entries,
  dailyBalance,
}: {
  entries: BudgetEntry[];
  dailyBalance: number | null;
}) {
  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([]);
  const [adhocSettings, setAdhocSettings] = useState<AdhocSettings>({
    daily_amount: 40,
  });
  const [isEditingAdhoc, setIsEditingAdhoc] = useState(false);
  const [newDailyAmount, setNewDailyAmount] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [periodsResponse, settingsResponse] = await Promise.all([
          fetch("/api/pay-periods"),
          fetch("/api/adhoc-settings"),
        ]);

        if (!periodsResponse.ok) throw new Error("Failed to fetch pay periods");
        if (!settingsResponse.ok)
          throw new Error("Failed to fetch adhoc settings");

        const periodsData = await periodsResponse.json();
        const settingsData = await settingsResponse.json();
        const processedData = periodsData.map((item: PayPeriod) => ({
          ...item,
          salary_amount: Number(item.salary_amount), // Converts the string to a number
        }));

        setPayPeriods(processedData);
        setAdhocSettings(settingsData);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const periods = useMemo(() => {
    if (!payPeriods.length) return {};

    const sortedPeriods = payPeriods.sort(
      (a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let previousRemaining = Number(dailyBalance) ? Number(dailyBalance) : 0;

    return sortedPeriods.reduce((acc, period, index) => {
      const nextPeriod = sortedPeriods[index + 1];
      const periodStart = new Date(period.start_date);
      const periodEnd = nextPeriod ? new Date(nextPeriod.start_date) : null;

      // Get entries for this period
      const periodEntries = entries.filter((entry) => {
        const entryDate = new Date(entry.due_date);
        if (!periodEnd) return entryDate >= periodStart;
        return entryDate >= periodStart && entryDate < periodEnd;
      });

      // Calculate total expenses
      const totalExpenses = periodEntries.reduce(
        (sum, entry) => sum + entry.amount,
        0
      );

      // Calculate adhoc days and total
      let daysInPeriod;
      if (period.period_type === "CURRENT_PERIOD") {
        daysInPeriod = periodEnd
          ? Math.max(
              0,
              Math.ceil(
                (periodEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
              )
            )
          : 0;
      } else {
        daysInPeriod = periodEnd
          ? Math.ceil(
              (periodEnd.getTime() - periodStart.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 0;
      }

      const adhocTotal = daysInPeriod * adhocSettings.daily_amount;

      // Calculate remaining
      const payAmount =
        period.period_type === "CURRENT_PERIOD" ? 0 : period.salary_amount;
      const remaining =
        previousRemaining + payAmount - totalExpenses - adhocTotal;
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
      } catch (err) {
        console.error("Error saving balance history:", err);
      }
    };

    saveBalanceHistory();
  }, [periods, dailyBalance, adhocSettings.daily_amount]);

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

  if (isLoading)
    return (
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    );
  if (error) return <div className="text-red-600">Error: {error}</div>;

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
            <div className="text-2xl font-bold">
              ${Number(adhocSettings.daily_amount).toFixed(2)}/day
            </div>
          )}
        </CardContent>
      </Card>

      {/* Period Summaries */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {periodCards.map(({ key, title }) => {
          const period = periods[key as keyof typeof periods];
          if (!period) return null;

          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
                <div className="text-sm text-gray-500">
                  {formatDateForDisplay(period.periodStart)}
                  {period.periodEnd &&
                    ` - ${formatDateForDisplay(period.periodEnd)}`}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    {period.entries.length > 0 ? (
                      period.entries.map((entry) => (
                        <div
                          key={entry.id}
                          className="grid grid-cols-[1fr,auto,auto] gap-2"
                        >
                          <span>{entry.name}</span>
                          <span className="text-gray-500 text-sm">
                            {formatDateForDisplay(entry.due_date)}
                          </span>
                          <span>${Number(entry.amount).toFixed(2)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-500">No expenses</div>
                    )}
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Pay</span>
                      <span>${Number(period.salary_amount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Expenses</span>
                      <span>${Number(period.totalExpenses).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Days remaining</span>
                      <span>{period.daysInPeriod}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Adhoc</span>
                      <span>${Number(period.adhocTotal).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Balance</span>
                      <span
                        className={
                          period.remaining < 0
                            ? "text-red-600"
                            : "text-green-600"
                        }
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
