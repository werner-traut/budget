"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Pencil, Trash2, Repeat } from "lucide-react";
import { RecurringItemForm } from "./RecurringItemForm";
import { formatDateForDisplay } from "@/lib/utils/date";
import { useBudgetStore } from "@/store/useBudgetStore";
import type { RecurringItem, UpdateRecurringItemDto } from "@/types/recurring";

function describeSchedule(item: RecurringItem): string {
  switch (item.frequency) {
    case "MONTHLY":
      return `Monthly on day ${item.day_of_month}`;
    case "WEEKLY":
      return item.interval_weeks === 1
        ? `Weekly from ${formatDateForDisplay(item.anchor_date)}`
        : `Every ${item.interval_weeks} weeks from ${formatDateForDisplay(item.anchor_date)}`;
    case "PER_PERIOD":
      return "Each pay period's start date";
  }
}

export function RecurringItemsManager() {
  const {
    recurringItems,
    addRecurringItem,
    updateRecurringItem,
    deleteRecurringItem,
    fetchEntries,
    setError,
  } = useBudgetStore();

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringItem | null>(null);

  const processItem = (item: RecurringItem): RecurringItem => ({
    ...item,
    amount: Number(item.amount),
  });

  const handleCreate = async (data: UpdateRecurringItemDto) => {
    const response = await fetch("/api/recurring-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create recurring item");
    const { item } = await response.json();
    addRecurringItem(processItem(item));
    // Creation backfills instances immediately; pick them up.
    await fetchEntries();
  };

  const handleUpdate = async (id: string, data: UpdateRecurringItemDto) => {
    const response = await fetch(`/api/recurring-items/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update recurring item");
    const item = await response.json();
    updateRecurringItem(id, processItem(item));
    await fetchEntries();
  };

  const handleToggleActive = async (item: RecurringItem) => {
    try {
      await handleUpdate(item.id, { active: !item.active });
    } catch (err) {
      console.error("Error toggling recurring item:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleDelete = async (item: RecurringItem) => {
    if (!window.confirm(`Delete recurring item "${item.name}"?`)) return;
    const deleteFuture = window.confirm(
      "Also remove its unpaid future entries from the budget?"
    );

    try {
      const response = await fetch(
        `/api/recurring-items/${item.id}?deleteFutureInstances=${deleteFuture}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("Failed to delete recurring item");
      deleteRecurringItem(item.id);
      await fetchEntries();
    } catch (err) {
      console.error("Error deleting recurring item:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recurring Items</CardTitle>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Add Recurring Item
          </button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            Recurring items create budget entries automatically — immediately
            when added, and again each time pay periods shift.
          </p>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Amount</th>
                  <th className="text-left p-3 font-medium">Schedule</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recurringItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-gray-500">
                      No recurring items yet
                    </td>
                  </tr>
                ) : (
                  recurringItems.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-gray-50 ${
                        item.active ? "" : "text-gray-400"
                      }`}
                    >
                      <td className="p-3">
                        <span className="flex items-center gap-1.5">
                          <Repeat className="h-4 w-4 text-gray-400 shrink-0" />
                          {item.name}
                        </span>
                      </td>
                      <td className="p-3">${Number(item.amount).toFixed(2)}</td>
                      <td className="p-3">{describeSchedule(item)}</td>
                      <td className="p-3">
                        <button
                          onClick={() => handleToggleActive(item)}
                          className={`text-xs font-medium px-2 py-1 rounded-full ${
                            item.active
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                          title={
                            item.active
                              ? "Pause: stop creating future entries"
                              : "Resume creating future entries"
                          }
                        >
                          {item.active ? "Active" : "Paused"}
                        </button>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => setEditingItem(item)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Edit"
                        >
                          <Pencil className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
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

      {(showForm || editingItem) && (
        <RecurringItemForm
          item={editingItem ?? undefined}
          onClose={() => {
            setShowForm(false);
            setEditingItem(null);
          }}
          onSubmit={
            editingItem
              ? (data) => handleUpdate(editingItem.id, data)
              : handleCreate
          }
        />
      )}
    </div>
  );
}
