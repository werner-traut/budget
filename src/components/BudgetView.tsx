"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Pencil, Trash2, CheckCircle } from "lucide-react";
import { DailyBalanceCheck } from "./DailyBalanceCheck";
import { BudgetEntryForm } from "./BudgetEntryForm";
import { formatDateForDisplay } from "@/lib/utils/date";
import { useBudgetStore } from "@/store/useBudgetStore";
import type { BudgetEntry } from "@/types/budget";

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

  const handleAddEntry = async (entry: Entry) => {
    try {
      const response = await fetch("/api/budget-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
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
        body: JSON.stringify(updatedData),
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

  const handleMarkAsPaid = async (entry: BudgetEntry) => {
    const nextDueDate = new Date(entry.due_date);
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);

    try {
      await handleUpdateEntry(entry.id, {
        ...entry,
        due_date: nextDueDate.toISOString().split("T")[0],
      });
    } catch (err) {
      console.error("Error marking entry as paid:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    }
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
              <p className="text-sm text-gray-500">Today&apos; Balance</p>
              <p className="text-2xl font-bold">
                {dailyBalance !== null
                  ? `$${Number(dailyBalance).toFixed(2)}`
                  : "Not checked today"}
              </p>
            </div>
            {dailyBalance === null && (
              <DailyBalanceCheck onDailyBalanceChange={setDailyBalance} />
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
                  entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="p-3">{entry.name}</td>
                      <td className="p-3">
                        ${Number(entry.amount).toFixed(2)}
                      </td>
                      <td className="p-3">
                        {formatDateForDisplay(entry.due_date)}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => setEditingEntry(entry)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Edit"
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
                        <button
                          onClick={() => handleMarkAsPaid(entry)}
                          className="text-green-600 hover:text-green-800 p-1"
                          title="Mark as Paid"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
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
    </div>
  );
}
