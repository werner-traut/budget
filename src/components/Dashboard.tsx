"use client";

import { useState, useEffect } from "react";
import { PayPeriodManager } from "./PayPeriodManager";
import { BudgetView } from "./BudgetView";
import { BudgetSummary } from "./BudgetSummary";
import type { BudgetEntry } from "@/types/budget";
import { BalanceGraph } from "./BalanceGraph";

type ActiveTab = "budget" | "periods" | "summary" | "graph";

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("budget");
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [dailyBalance, setDailyBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/budget-entries");
      if (!response.ok) throw new Error("Failed to fetch budget entries");
      const data = await response.json();
      setEntries(data);

      // Check if we have a balance for today
      const today = new Date().toISOString().split("T")[0];
      const balanceResponse = await fetch(`/api/daily-balance?date=${today}`);
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        setDailyBalance(balanceData?.balance);
      }
    } catch (err) {
      console.error("Error fetching entries:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEntriesChange = (updatedEntries: BudgetEntry[]) => {
    setEntries(updatedEntries);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Tabs */}
      <div className="border-b bg-white">
        <div className="max-w-7xl mx-auto">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("budget")}
              className={`
                py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm
                ${
                  activeTab === "budget"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              Budget
            </button>
            <button
              onClick={() => setActiveTab("periods")}
              className={`
                py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm
                ${
                  activeTab === "periods"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              Pay Periods
            </button>
            <button
              onClick={() => setActiveTab("summary")}
              className={`
                py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm
                ${
                  activeTab === "summary"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              Summary
            </button>
            <button
              onClick={() => setActiveTab("graph")}
              className={`
                py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm
                ${
                  activeTab === "graph"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              Graph
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-4">
        {activeTab === "budget" && (
          <BudgetView
            entries={entries}
            onEntriesChange={handleEntriesChange}
            dailyBalance={dailyBalance}
          />
        )}
        {activeTab === "periods" && <PayPeriodManager />}
        {activeTab === "summary" && (
          <BudgetSummary entries={entries} dailyBalance={dailyBalance} />
        )}
        {activeTab === "graph" && <BalanceGraph />}
      </div>
    </div>
  );
}
