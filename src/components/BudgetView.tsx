"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Pencil,
  Trash2,
  CheckCircle,
  Repeat,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { DailyBalanceCheck } from "./DailyBalanceCheck";
import { BudgetEntryForm } from "./BudgetEntryForm";
import { MarkPaidDialog } from "./MarkPaidDialog";
import {
  formatDateForAPI,
  formatDateForDisplay,
  getTodayInUTC,
} from "@/lib/utils/date";
import { useBudgetStore } from "@/store/useBudgetStore";
import type { BudgetEntry } from "@/types/budget";
import { Button } from "@/components/ui/button";

interface Entry {
  name: string;
  amount: number;
  due_date: string;
}

export function BudgetView() {
  const { 
    entries, 
    dailyBalance,
    setDailyBalance,
    addEntry,
    updateEntry,
    deleteEntry,
    setError
  } = useBudgetStore();
  
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BudgetEntry | null>(null);
  const [markingPaidEntry, setMarkingPaidEntry] = useState<BudgetEntry | null>(null);
  const [showPaidSection, setShowPaidSection] = useState(false);
  const [showDailyBalanceModal, setShowDailyBalanceModal] = useState(false);

  const unpaidEntries = entries.filter((entry) => !entry.paid_at);
  // Paid entries due before the current month are kept in the database (the
  // monthly overview still reads them) but hidden here so the Paid section
  // doesn't grow indefinitely as recurring instances are paid off.
  const today = getTodayInUTC();
  const currentMonthStart = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    1
  );
  const paidEntries = entries.filter(
    (entry) =>
      entry.paid_at && new Date(entry.due_date).getTime() >= currentMonthStart
  );

  const handleAddEntry = async (entry: Entry) => {
    try {
      const response = await fetch("/api/budget-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...entry,
          due_date: formatDateForAPI(entry.due_date),
        }),
      });
      if (!response.ok) throw new Error("Failed to create entry");
      const newEntry = await response.json();
      const processedEntry = {
        ...newEntry,
        amount: Number(newEntry.amount),
      };
      addEntry(processedEntry);
      setShowEntryForm(false);
    } catch (err) {
      console.error("Error adding entry:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleUpdateEntry = async (entryId: string, updatedData: Entry) => {
    try {
      const response = await fetch(`/api/budget-entries/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...updatedData,
          due_date: formatDateForAPI(updatedData.due_date),
        }),
      });
      if (!response.ok) throw new Error("Failed to update entry");
      const updatedEntry = await response.json();
      const processedEntry = {
        ...updatedEntry,
        amount: Number(updatedEntry.amount),
      };
      updateEntry(entryId, processedEntry);
      setEditingEntry(null);
    } catch (err) {
      console.error("Error updating entry:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!window.confirm("Are you sure you want to delete this entry?")) return;

    try {
      const response = await fetch(`/api/budget-entries/${entryId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete entry");
      deleteEntry(entryId);
    } catch (err) {
      console.error("Error deleting entry:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleSetPaid = async (
    entry: BudgetEntry,
    paidAt: string | null,
    actualAmount: number | null
  ) => {
    const response = await fetch(`/api/budget-entries/${entry.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid_at: paidAt, actual_amount: actualAmount }),
    });
    if (!response.ok) throw new Error("Failed to update entry");
    const updatedEntry = await response.json();
    updateEntry(entry.id, {
      ...updatedEntry,
      amount: Number(updatedEntry.amount),
      actual_amount:
        updatedEntry.actual_amount === null
          ? null
          : Number(updatedEntry.actual_amount),
    });
  };

  const handleUnmarkPaid = async (entry: BudgetEntry) => {
    try {
      await handleSetPaid(entry, null, null);
    } catch (err) {
      console.error("Error unmarking entry as paid:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const renderEntryRow = (entry: BudgetEntry) => {
    const isPaid = entry.paid_at !== null;
    return (
      <tr
        key={entry.id}
        className={`transition-colors hover:bg-accent/50 ${
          isPaid ? "text-muted-foreground/60" : ""
        }`}
      >
        <td className={`p-3 ${isPaid ? "line-through decoration-foreground/40" : ""}`}>
          <span className="flex items-center gap-1.5">
            {entry.name}
            {entry.source_recurring_id && (
              <Repeat
                className="h-4 w-4 text-muted-foreground/60 shrink-0"
                aria-label="Created by recurring item"
              />
            )}
          </span>
        </td>
        <td className="p-3 font-mono tabular-nums">
          ${Number(entry.actual_amount ?? entry.amount).toFixed(2)}
          {isPaid &&
            entry.actual_amount !== null &&
            entry.actual_amount !== entry.amount && (
              <span className="text-xs ml-1 text-muted-foreground">
                (budgeted ${Number(entry.amount).toFixed(2)})
              </span>
            )}
        </td>
        <td className="p-3 font-mono text-sm tabular-nums">
          {formatDateForDisplay(entry.due_date)}
        </td>
        <td className="p-3 text-right space-x-2">
          <button
            onClick={() => setEditingEntry(entry)}
            className="text-muted-foreground hover:text-primary p-1 transition-colors"
            title={entry.source_recurring_id ? "Edit this occurrence" : "Edit"}
          >
            <Pencil className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleDeleteEntry(entry.id)}
            className="text-muted-foreground hover:text-destructive p-1 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          {isPaid ? (
            <button
              onClick={() => handleUnmarkPaid(entry)}
              className="text-positive hover:text-positive/70 p-1 transition-colors"
              title="Mark as Unpaid"
            >
              <CheckCircle className="w-5 h-5 fill-accent" />
            </button>
          ) : (
            <button
              onClick={() => setMarkingPaidEntry(entry)}
              className="text-muted-foreground/60 hover:text-positive p-1 transition-colors"
              title="Mark as Paid"
            >
              <CheckCircle className="w-5 h-5" />
            </button>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Daily Balance Status */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Balance Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Today&apos;s Balance
              </p>
              {dailyBalance !== null ? (
                <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-primary">
                  ${Number(dailyBalance).toFixed(2)}
                </p>
              ) : (
                <p className="mt-1 font-display text-2xl italic text-muted-foreground">
                  Not checked today
                </p>
              )}
            </div>
            {dailyBalance === null ? (
              <DailyBalanceCheck onDailyBalanceChange={setDailyBalance} />
            ) : (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowDailyBalanceModal(true)}
                className="ml-2"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Budget Entries */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Budget Entries</CardTitle>
          <button
            onClick={() => setShowEntryForm(true)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium tracking-wide text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Add Entry
          </button>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-foreground/60">
                  <th className="p-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Name</th>
                  <th className="p-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Amount</th>
                  <th className="p-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Due Date</th>
                  <th className="p-3 text-right font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center font-display italic text-muted-foreground">
                      No budget entries found
                    </td>
                  </tr>
                ) : (
                  <>
                    {unpaidEntries.map(renderEntryRow)}
                    {paidEntries.length > 0 && (
                      <tr className="bg-secondary/50">
                        <td colSpan={4} className="p-2">
                          <button
                            onClick={() => setShowPaidSection(!showPaidSection)}
                            className="flex items-center gap-1 font-mono text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {showPaidSection ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                            Paid ({paidEntries.length})
                          </button>
                        </td>
                      </tr>
                    )}
                    {showPaidSection && paidEntries.map(renderEntryRow)}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {(showEntryForm || editingEntry) && (
        <BudgetEntryForm
          isOpen={true}
          onClose={() => {
            setShowEntryForm(false);
            setEditingEntry(null);
          }}
          onSubmit={
            editingEntry
              ? (data) => handleUpdateEntry(editingEntry.id, data)
              : handleAddEntry
          }
          initialValues={
            editingEntry
              ? {
                  name: editingEntry.name,
                  amount: editingEntry.amount,
                  date: editingEntry.due_date,
                }
              : undefined
          }
        />
      )}

      {markingPaidEntry && (
        <MarkPaidDialog
          entry={markingPaidEntry}
          onClose={() => setMarkingPaidEntry(null)}
          onConfirm={(actualAmount) =>
            handleSetPaid(
              markingPaidEntry,
              formatDateForAPI(getTodayInUTC()),
              actualAmount
            )
          }
        />
      )}

      {showDailyBalanceModal && (
        <DailyBalanceCheck
          onDailyBalanceChange={setDailyBalance}
          initialBalance={dailyBalance}
          isOpen={showDailyBalanceModal}
          onClose={() => setShowDailyBalanceModal(false)}
        />
      )}
    </div>
  );
}
