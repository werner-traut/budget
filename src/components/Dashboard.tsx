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
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      {/* Header Section */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-linear-to-br from-primary to-violet-600 flex items-center justify-center text-white font-bold shadow-lg shadow-primary/25">
              B
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">
              Budget Tracker
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              v{process.env.NEXT_PUBLIC_APP_VERSION} • Welcome back
            </div>
            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-800 border-2 border-white dark:border-gray-700 shadow-sm"></div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex p-1 space-x-1 bg-gray-100/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl max-w-fit border border-gray-200/50 dark:border-gray-700/50">
            {[
              { id: "budget", label: "Budget" },
              { id: "periods", label: "Pay Periods" },
              { id: "summary", label: "Summary" },
              { id: "graph", label: "Graph" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`
                  relative px-6 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ease-out
                  ${activeTab === tab.id
                    ? "bg-white dark:bg-gray-800 text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-gray-700/50"
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl rounded-3xl border border-white/20 shadow-xl shadow-black/5 p-6 min-h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === "budget" && <BudgetView />}
          {activeTab === "periods" && <PayPeriodManager />}
          {activeTab === "summary" && <BudgetSummary />}
          {activeTab === "graph" && <BalanceGraph />}
        </div>
      </main>
    </div>
  );
}
