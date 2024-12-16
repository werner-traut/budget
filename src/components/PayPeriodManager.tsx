"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { type PayPeriod, type PeriodType } from "@/types/periods";
import PayPeriodForm from "./PayPeriodForm";
import { formatDateForDisplay } from "@/lib/utils/date";
import { useBudgetStore } from "@/store/useBudgetStore";

const PERIOD_TYPES: PeriodType[] = [
  "CURRENT_PERIOD",
  "NEXT_PERIOD",
  "PERIOD_AFTER",
  "FUTURE_PERIOD",
  "CLOSED_PERIOD",
];

export function PayPeriodManager() {
  const { 
    payPeriods,
    fetchPayPeriods,
    setError 
  } = useBudgetStore();
  
  const [showForm, setShowForm] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PayPeriod | null>(null);
  const [isAddingNewPeriod, setIsAddingNewPeriod] = useState(false);
  const [selectedPeriodType, setSelectedPeriodType] = useState<PeriodType>(
    PERIOD_TYPES[0]
  );

  const shiftPeriods = async () => {
    // Get all periods except CLOSED_PERIOD
    const periodsToShift = payPeriods.filter(
      (p) => p.period_type !== "CLOSED_PERIOD"
    );

    // Calculate new period mappings
    const periodShifts = [
      { from: "FUTURE_PERIOD", to: "PERIOD_AFTER" },
      { from: "PERIOD_AFTER", to: "NEXT_PERIOD" },
      { from: "NEXT_PERIOD", to: "CURRENT_PERIOD" },
      { from: "CURRENT_PERIOD", to: "CLOSED_PERIOD" },
    ];

    try {
      // Update existing periods
      const updatePromises = periodShifts.map(async ({ from, to }) => {
        const period = periodsToShift.find((p) => p.period_type === from);
        if (!period) return;

        const response = await fetch(`/api/pay-periods/${period.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...period,
            period_type: to,
          }),
        });

        if (!response.ok)
          throw new Error(`Failed to update period from ${from} to ${to}`);
      });

      await Promise.all(updatePromises);
      await fetchPayPeriods(); // Refresh the periods after successful shift
    } catch (error) {
      console.error("Error shifting periods:", error);
      throw error;
    }
  };

  const handleAddPeriod = () => {
    setIsAddingNewPeriod(true);
    setSelectedPeriod(null);
    setSelectedPeriodType("FUTURE_PERIOD");
    setShowForm(true);
  };

  const handleSubmit = async (period: Partial<PayPeriod>) => {
    try {
      if (isAddingNewPeriod) {
        // Shift periods before adding a new one
        await shiftPeriods();
      }
      
      if (period.id) {
        // Handling update of existing period
        const response = await fetch(`/api/pay-periods/${period.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(period),
        });
        if (!response.ok) throw new Error("Failed to update period");
      } else {
        // Handling creation of new period
        const response = await fetch("/api/pay-periods", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(period),
        });
        if (!response.ok) throw new Error("Failed to create period");
      }
      
      await fetchPayPeriods();
      setShowForm(false);
    } catch (error) {
      console.error("Error handling period:", error);
      setError(error instanceof Error ? error.message : "An error occurred");
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedPeriod(null);
    setSelectedPeriodType(PERIOD_TYPES[0]);
    setIsAddingNewPeriod(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Pay Periods</h2>
        <button
          onClick={handleAddPeriod}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Period
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PERIOD_TYPES.map((type) => {
          if (type === "CLOSED_PERIOD") return null;
          const period = payPeriods.find((p) => p.period_type === type);
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
                      Salary: ${Number(period.salary_amount).toFixed(2)}
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
                      setIsAddingNewPeriod(false);
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
          periodType={selectedPeriodType}
          onSubmit={handleSubmit}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
}
