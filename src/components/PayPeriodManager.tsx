"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PayPeriod, PeriodType } from "@/types/periods";
import PayPeriodForm from "./PayPeriodForm";
import { formatDateForDisplay } from "@/lib/utils/date";

const PERIOD_TYPES: PeriodType[] = [
  "CURRENT_PERIOD",
  "NEXT_PERIOD",
  "PERIOD_AFTER",
  "FUTURE_PERIOD",
];

export function PayPeriodManager() {
  const [periods, setPeriods] = useState<PayPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PayPeriod | null>(null);
  const [selectedPeriodType, setSelectedPeriodType] = useState<PeriodType>(
    PERIOD_TYPES[0]
  );
  const [defaultStartDate, setDefaultStartDate] = useState<string>("");

  useEffect(() => {
    fetchPeriods();
  }, []);

  const fetchPeriods = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/pay-periods");
      if (!response.ok) throw new Error("Failed to fetch periods");
      const data = await response.json();
      setPeriods(data);
    } catch (error) {
      console.error("Error fetching periods:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPeriod = async () => {
    try {
      // First check and cascade if needed
      await fetch("/api/pay-periods/cascade", {
        method: "POST",
      });

      // Find the latest period's start date
      const latestPeriod = periods
        .filter((p) => p.period_type !== "CLOSED_PERIOD")
        .sort(
          (a, b) =>
            new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
        )[0];

      const defaultStartDate = latestPeriod
        ? new Date(latestPeriod.start_date)
        : new Date();

      // Add 14 days (or your preferred period length)
      defaultStartDate.setDate(defaultStartDate.getDate() + 14);

      setSelectedPeriod(null);
      setSelectedPeriodType("FUTURE_PERIOD");
      setShowForm(true);
      setDefaultStartDate(defaultStartDate.toISOString().split("T")[0]);

      // Refresh periods after cascade
      await fetchPeriods();
    } catch (error) {
      console.error("Failed to handle period addition:", error);
    }
  };

  const handleSubmit = async (period: Partial<PayPeriod>) => {
    try {
      const response = await fetch("/api/pay-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(period),
      });
      if (!response.ok) throw new Error("Failed to create period");
      await fetchPeriods();
      setShowForm(false);
    } catch (error) {
      console.error("Error creating period:", error);
    }
  };

  if (isLoading) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Pay Periods</h2>
        <button
          onClick={() => handleAddPeriod()}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Period
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PERIOD_TYPES.map((type) => {
          const period = periods.find((p) => p.period_type === type);
          return (
            <Card
              key={type}
              className={period ? "border-blue-200" : "border-gray-200"}
            >
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {type.replace("_", " ")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {period ? (
                  <div className="space-y-2">
                    <p className="font-medium">
                      Start: {formatDateForDisplay(period.start_date)}
                    </p>
                    <p className="font-medium">
                      Salary: ${period.salary_amount.toFixed(2)}
                    </p>
                    <button
                      onClick={() => {
                        setSelectedPeriod(period);
                        setSelectedPeriodType(type);
                        setShowForm(true);
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedPeriod(null);
                      setSelectedPeriodType(type);
                      setShowForm(true);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Set Up Period
                  </button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {showForm && (
        <PayPeriodForm
          period={selectedPeriod}
          periodType={selectedPeriodType} // Pass the selected type
          onSubmit={handleSubmit}
          onClose={() => {
            setShowForm(false);
            setSelectedPeriod(null);
            setSelectedPeriodType(PERIOD_TYPES[0]);
          }}
          defaultStartDate={defaultStartDate}
        />
      )}
    </div>
  );
}
