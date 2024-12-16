"use client";

import { useState, useEffect } from "react";
import { PayPeriodManager } from "./PayPeriodManager";
import { BudgetView } from "./BudgetView";
import { BudgetSummary } from "./BudgetSummary";
import BalanceGraph from "./BalanceGraph";
import { useBudgetStore } from "@/store/useBudgetStore";

type ActiveTab = "budget" | "periods" | "summary" | "graph";

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("budget");
  const {
    isInitializing,
    error,
    initialized,
    fetchEntries,
    fetchDailyBalance,
    fetchAdhocSettings,
    fetchPayPeriods,
    setInitialized,
    setInitializing
  } = useBudgetStore();

  useEffect(() => {
    if (!initialized) {
      const initializeData = async () => {
        try {
          await Promise.all([
            fetchEntries(),
            fetchDailyBalance(),
            fetchAdhocSettings(),
            fetchPayPeriods()
          ]);
        } catch (error) {
          console.error('Error initializing data:', error);
        } finally {
          setInitialized(true);
          setInitializing(false);
        }
      };

      initializeData();
    }
  }, [initialized, fetchEntries, fetchDailyBalance, fetchAdhocSettings, setInitialized, fetchPayPeriods, setInitializing]);

  // Loading state
  if (isInitializing) {
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
          <BudgetView />
        )}
        {activeTab === "periods" && <PayPeriodManager />}
        {activeTab === "summary" && (
          <BudgetSummary />
        )}
        {activeTab === "graph" && <BalanceGraph />}
      </div>
    </div>
  );
}
