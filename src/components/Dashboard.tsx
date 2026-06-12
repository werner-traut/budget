"use client";

import { useState, useEffect } from "react";
import { PayPeriodManager } from "./PayPeriodManager";
import { BudgetView } from "./BudgetView";
import { BudgetSummary } from "./BudgetSummary";
import BalanceGraph from "./BalanceGraph";
import { RecurringItemsManager } from "./RecurringItemsManager";
import { useBudgetStore } from "@/store/useBudgetStore";
import { formatDateForDisplay, getTodayInUTC } from "@/lib/utils/date";

type ActiveTab = "budget" | "recurring" | "periods" | "summary" | "graph";

const TABS: { id: ActiveTab; label: string }[] = [
  { id: "budget", label: "Budget" },
  { id: "recurring", label: "Recurring" },
  { id: "periods", label: "Pay Periods" },
  { id: "summary", label: "Summary" },
  { id: "graph", label: "Graph" },
];

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("budget");
  const {
    isInitializing,
    error,
    initialized,
    fetchEntries,
    fetchRecurringItems,
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
            fetchRecurringItems(),
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
  }, [initialized, fetchEntries, fetchRecurringItems, fetchDailyBalance, fetchAdhocSettings, setInitialized, fetchPayPeriods, setInitializing]);

  // Loading state
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="font-display text-2xl italic text-foreground/80">
          Balancing the books&hellip;
        </div>
        <div className="h-px w-32 bg-foreground/40 animate-pulse" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="font-mono text-sm text-destructive">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground selection:bg-primary/20">
      {/* Masthead */}
      <header className="sticky top-0 z-40 border-b border-foreground/15 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[1.6rem] font-semibold leading-none tracking-tight">
              Budget
            </span>
            <span className="font-display text-[1.6rem] italic leading-none text-primary">
              Tracker
            </span>
          </div>
          <div className="text-right leading-tight">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {formatDateForDisplay(getTodayInUTC())}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/60">
              no. v{process.env.NEXT_PUBLIC_APP_VERSION}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Index tabs */}
        <nav className="mb-10 flex flex-wrap gap-x-8 gap-y-2 border-b border-border">
          {TABS.map((tab, i) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group relative pb-3 text-sm transition-colors duration-200 ${
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="mr-2 font-mono text-[10px] tracking-[0.2em] text-primary/70">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-medium tracking-wide">{tab.label}</span>
                <span
                  className={`absolute inset-x-0 -bottom-px h-[2px] origin-left bg-primary transition-transform duration-300 ease-out ${
                    isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-50"
                  }`}
                />
              </button>
            );
          })}
        </nav>

        {/* Content Area */}
        <div
          key={activeTab}
          className="animate-in fade-in slide-in-from-bottom-2 duration-500"
        >
          {activeTab === "budget" && <BudgetView />}
          {activeTab === "recurring" && <RecurringItemsManager />}
          {activeTab === "periods" && <PayPeriodManager />}
          {activeTab === "summary" && <BudgetSummary />}
          {activeTab === "graph" && <BalanceGraph />}
        </div>
      </main>
    </div>
  );
}
