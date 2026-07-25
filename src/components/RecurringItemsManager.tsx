"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Pencil, Trash2, Repeat } from "lucide-react";
import { RecurringItemForm } from "./RecurringItemForm";
import { formatDateForDisplay } from "@/lib/utils/date";
import { useBudgetStore } from "@/store/useBudgetStore";
import { parseApiResponse, recurringItemSchema } from "@/lib/api/schemas";
import type { RecurringItem, UpdateRecurringItemDto } from "@/types/recurring";
import { z } from "zod";

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

  const handleCreate = async (data: UpdateRecurringItemDto) => {
    const response = await fetch("/api/recurring-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const { item } = await parseApiResponse(
      response,
      z.object({ item: recurringItemSchema }),
      "Failed to create recurring item"
    );
    addRecurringItem(item);
    // Creation backfills instances immediately; pick them up.
    await fetchEntries();
  };

  const handleUpdate = async (id: string, data: UpdateRecurringItemDto) => {
    const response = await fetch(`/api/recurring-items/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const item = await parseApiResponse(
      response,
      recurringItemSchema,
      "Failed to update recurring item"
    );
    updateRecurringItem(id, item);
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
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium tracking-wide text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Add Recurring Item
          </button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Recurring items create budget entries automatically — immediately
            when added, and again each time pay periods shift.
          </p>
          <div className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-foreground/60">
                  <th className="p-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Name</th>
                  <th className="p-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Amount</th>
                  <th className="p-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Schedule</th>
                  <th className="p-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Status</th>
                  <th className="p-3 text-right font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {recurringItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center font-display italic text-muted-foreground">
                      No recurring items yet
                    </td>
                  </tr>
                ) : (
                  recurringItems.map((item) => (
                    <tr
                      key={item.id}
                      className={`transition-colors hover:bg-accent/50 ${
                        item.active ? "" : "text-muted-foreground/60"
                      }`}
                    >
                      <td className="p-3">
                        <span className="flex items-center gap-1.5">
                          <Repeat className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                          {item.name}
                        </span>
                      </td>
                      <td className="p-3 font-mono tabular-nums">
                        ${Number(item.amount).toFixed(2)}
                      </td>
                      <td className="p-3 text-sm">{describeSchedule(item)}</td>
                      <td className="p-3">
                        <button
                          onClick={() => handleToggleActive(item)}
                          className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] transition-colors ${
                            item.active
                              ? "border-positive/40 bg-accent text-positive hover:bg-accent/70"
                              : "border-border bg-secondary text-muted-foreground hover:bg-secondary/70"
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
                          className="text-muted-foreground hover:text-primary p-1 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="text-muted-foreground hover:text-destructive p-1 transition-colors"
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
