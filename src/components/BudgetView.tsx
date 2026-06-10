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
  const paidEntries = entries.filter((entry) => entry.paid_at);

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
        className={`hover:bg-gray-50 ${isPaid ? "text-gray-400" : ""}`}
      >
        <td className={`p-3 ${isPaid ? "line-through" : ""}`}>
          <span className="flex items-center gap-1.5">
            {entry.name}
            {entry.source_recurring_id && (
              <Repeat
                className="h-4 w-4 text-gray-400 shrink-0"
                aria-label="Created by recurring item"
              />
            )}
          </span>
        </td>
        <td className="p-3">
          ${Number(entry.actual_amount ?? entry.amount).toFixed(2)}
          {isPaid &&
            entry.actual_amount !== null &&
            entry.actual_amount !== entry.amount && (
              <span className="text-xs ml-1">
                (budgeted ${Number(entry.amount).toFixed(2)})
              </span>
            )}
        </td>
        <td className="p-3">{formatDateForDisplay(entry.due_date)}</td>
        <td className="p-3 text-right space-x-2">
          <button
            onClick={() => setEditingEntry(entry)}
            className="text-blue-600 hover:text-blue-800 p-1"
            title={entry.source_recurring_id ? "Edit this occurrence" : "Edit"}
          >
            <Pencil className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleDeleteEntry(entry.id)}
            className="text-red-600 hover:text-red-800 p-1"
            title="Delete"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          {isPaid ? (
            <button
              onClick={() => handleUnmarkPaid(entry)}
              className="text-green-600 hover:text-green-800 p-1"
              title="Mark as Unpaid"
            >
              <CheckCircle className="w-5 h-5 fill-green-100" />
            </button>
          ) : (
            <button
              onClick={() => setMarkingPaidEntry(entry)}
              className="text-gray-400 hover:text-green-700 p-1"
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
              <p className="text-sm text-gray-500">Today&apos;s Balance</p>
              <p className="text-2xl font-bold">
                {dailyBalance !== null
                  ? `$${Number(dailyBalance).toFixed(2)}`
                  : "Not checked today"}
              </p>
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
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Add Entry
          </button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Amount</th>
                  <th className="text-left p-3 font-medium">Due Date</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-gray-500">
                      No budget entries found
                    </td>
                  </tr>
                ) : (
                  <>
                    {unpaidEntries.map(renderEntryRow)}
                    {paidEntries.length > 0 && (
                      <tr className="bg-gray-50">
                        <td colSpan={4} className="p-2">
                          <button
                            onClick={() => setShowPaidSection(!showPaidSection)}
                            className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
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
