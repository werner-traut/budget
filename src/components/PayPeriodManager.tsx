"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { type PayPeriod, type PeriodType } from "@/types/periods";
import PayPeriodForm from "./PayPeriodForm";
import { formatDateForDisplay } from "@/lib/utils/date";
import { calculateNextPayPeriod } from "@/lib/utils/pay-period";
import { useBudgetStore } from "@/store/useBudgetStore";
import { cn } from "@/lib/utils";

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

  // Animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const [tempPeriods, setTempPeriods] = useState<PayPeriod[]>([]);

  // Create a display map of periods based on PERIOD_TYPES order (excluding CLOSED)
  // We use this to ensure consistent ordering: Current -> Next -> After -> Future
  const orderedTypes: PeriodType[] = [
    "CURRENT_PERIOD",
    "NEXT_PERIOD",
    "PERIOD_AFTER",
    "FUTURE_PERIOD",
  ];

  // Helper to get periods in order
  const getOrderedPeriods = (periods: PayPeriod[]) => {
    return orderedTypes.map(type => periods.find(p => p.period_type === type));
  };

  const currentPeriods = getOrderedPeriods(payPeriods);

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

  const handleAddPeriod = async () => {
    if (isAnimating) return;

    try {
      setIsAddingNewPeriod(true);

      // 1. Prepare Animation Data:
      // Create a "New Future" period object locally for animation purposes

      const latestPeriod =
        payPeriods.find(p => p.period_type === "FUTURE_PERIOD") ||
        payPeriods.find(p => p.period_type === "PERIOD_AFTER") ||
        payPeriods.find(p => p.period_type === "NEXT_PERIOD") ||
        payPeriods.find(p => p.period_type === "CURRENT_PERIOD");

      let newStartDate = new Date();
      let newSalary = 0;

      if (latestPeriod) {
        newStartDate = calculateNextPayPeriod(latestPeriod.start_date);
        newSalary = latestPeriod.salary_amount;
      }

      const tempNewPeriod: PayPeriod = {
        id: "temp-new-" + Date.now(),
        user_id: "temp-user", // Placeholder
        period_type: "FUTURE_PERIOD", // It will eventually be FUTURE
        start_date: formatDateForDisplay(newStartDate), // Need proper formatting? Assuming string is OK from utils
        salary_amount: newSalary,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Construct the temporary list: [Current, Next, After, Future, NewFuture]
      // filter out undefined slots if any are missing
      const activePeriods = getOrderedPeriods(payPeriods).filter(p => !!p) as PayPeriod[];

      // We need to attach the correct *visual* labels.
      // The CURRENT period (index 0) is sliding out.
      // The NEW period is sliding in at index 4 (or end).

      setTempPeriods([...activePeriods, tempNewPeriod]);
      setIsAnimating(true);

      // 2. Perform Backend Operations

      // Shift periods before adding a new one
      await shiftPeriods();

      // Create new FUTURE_PERIOD
      const response = await fetch("/api/pay-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Use ISO string for API if needed, or format. The original used formatDateForDisplay(newStartDate)
        body: JSON.stringify({
          period_type: "FUTURE_PERIOD",
          start_date: formatDateForDisplay(newStartDate),
          salary_amount: newSalary,
        }),
      });

      if (!response.ok) throw new Error("Failed to create period");

      // 3. Wait for Animation to finish visually
      // CSS transition is set to 500ms
      await new Promise(resolve => setTimeout(resolve, 600));

      await fetchPayPeriods();

      // Reset animation state
      setIsAnimating(false);
      setTempPeriods([]);

    } catch (error) {
      console.error("Error adding period:", error);
      setError(error instanceof Error ? error.message : "An error occurred");
      setIsAnimating(false);
    } finally {
      setIsAddingNewPeriod(false);
    }
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

  // Determine what to render
  // If animating, we render the `tempPeriods` list
  // If not, we render the `currentPeriods` (with potentially empty slots if missing, but typicaly 4)

  const displayPeriods = isAnimating ? tempPeriods : currentPeriods;

  return (
    <div className="space-y-4 overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Pay Periods</h2>
        <button
          onClick={handleAddPeriod}
          disabled={isAnimating}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isAnimating ? "Adding..." : "Add Period"}
        </button>
      </div>

      <div className="relative w-full overflow-hidden">
        <div
          className={cn(
            "flex transition-transform duration-500 ease-in-out",
            isAnimating ? "-translate-x-full md:-translate-x-[50%] lg:-translate-x-[25%]" : "translate-x-0"
          )}
          style={{
            // Force the width to accommodate all items if needed, but flex wrap usually handles it.
            // We DO NOT want wrap here.
            flexWrap: "nowrap",

            marginLeft: "-0.5rem", marginRight: "-0.5rem" // Negative margin to offset padding
          }}
        >
          {displayPeriods.map((period, index) => {
            // Determine label

            let typeLabel = "";
            let periodData = period;

            if (isAnimating) {
              // period is definitely defined in tempPeriods (except maybe initial empty state?)
              if (!period) return null;
              typeLabel = period.period_type?.replace("_", " ") || "Unknown";
            } else {
              const type = orderedTypes[index];
              typeLabel = type.replace("_", " ");
              if (!type) return null; // Should not happen given loop
            }

            return (
              <div
                key={period ? period.id : `empty-${index}`}
                className="w-full md:w-1/2 lg:w-1/4 flex-shrink-0 px-2" // px-2 acts as half-gap of 4 (1rem)
              >
                <Card
                  className={cn(
                    "h-full",
                    periodData ? "border-blue-200" : "border-gray-200"
                  )}
                >
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      {typeLabel}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {periodData ? (
                      <div className="space-y-2">
                        <p className="font-medium">
                          Start: {formatDateForDisplay(periodData.start_date)}
                        </p>
                        <p className="font-medium">
                          Salary: ${Number(periodData.salary_amount).toFixed(2)}
                        </p>
                        <button
                          onClick={() => {
                            setSelectedPeriod(periodData);
                            setSelectedPeriodType(periodData.period_type);
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
                          setSelectedPeriodType(orderedTypes[index]);
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
              </div>
            );
          })}
        </div>
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
