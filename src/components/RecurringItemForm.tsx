"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle } from "lucide-react";
import { formatDateForAPI, formatDateForDisplay } from "@/lib/utils/date";
import type {
  RecurrenceFrequency,
  RecurringItem,
  UpdateRecurringItemDto,
} from "@/types/recurring";

interface RecurringItemFormProps {
  item?: RecurringItem;
  onClose: () => void;
  onSubmit: (data: UpdateRecurringItemDto) => Promise<void>;
}

export function RecurringItemForm({ item, onClose, onSubmit }: RecurringItemFormProps) {
  const [name, setName] = useState(item?.name || "");
  const [amount, setAmount] = useState(item?.amount?.toString() || "");
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(
    item?.frequency || "MONTHLY"
  );
  const [dayOfMonth, setDayOfMonth] = useState(
    item?.day_of_month?.toString() || "1"
  );
  const [intervalWeeks, setIntervalWeeks] = useState(
    item?.interval_weeks?.toString() || "2"
  );
  const [anchorDate, setAnchorDate] = useState(
    formatDateForDisplay(item?.anchor_date ?? new Date())
  );
  const [applyToFuture, setApplyToFuture] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await onSubmit({
        name,
        amount: parseFloat(amount),
        frequency,
        day_of_month: frequency === "MONTHLY" ? parseInt(dayOfMonth, 10) : null,
        interval_weeks:
          frequency === "WEEKLY" ? parseInt(intervalWeeks, 10) : null,
        anchor_date: formatDateForAPI(anchorDate),
        ...(item ? { applyToFutureInstances: applyToFuture } : {}),
      });
      onClose();
    } catch (err) {
      setError("Failed to save recurring item. Please try again.");
      console.error("Error saving recurring item:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-md border border-input bg-background p-2 font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-ring focus:border-ring";

  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-[2px] flex items-center justify-center z-50 animate-in fade-in duration-200">
      <Card className="w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">
        <CardHeader className="relative">
          <CardTitle className="text-xl font-semibold">
            {item ? "Edit Recurring Item" : "New Recurring Item"}
          </CardTitle>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">
                Name
              </label>
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">
                Amount
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">
                Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) =>
                  setFrequency(e.target.value as RecurrenceFrequency)
                }
                className={inputClass}
              >
                <option value="MONTHLY">Monthly</option>
                <option value="WEEKLY">Every N weeks</option>
                <option value="PER_PERIOD">Every pay period</option>
              </select>
            </div>
            {frequency === "MONTHLY" && (
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">
                  Day of month
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  className={inputClass}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Days past a month&apos;s end fall on its last day (31 → Feb 28).
                </p>
              </div>
            )}
            {frequency === "WEEKLY" && (
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">
                  Every how many weeks?
                </label>
                <input
                  type="number"
                  min="1"
                  value={intervalWeeks}
                  onChange={(e) => setIntervalWeeks(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            )}
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">
                {frequency === "WEEKLY" ? "First occurrence" : "Start from"}
              </label>
              <input
                type="date"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
                className={inputClass}
                required
              />
              {frequency === "PER_PERIOD" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Due on each pay period&apos;s start date, from this date onward.
                </p>
              )}
            </div>
            {item && (
              <label className="flex items-center gap-2 text-sm text-foreground/80">
                <input
                  type="checkbox"
                  checked={applyToFuture}
                  onChange={(e) => setApplyToFuture(e.target.checked)}
                />
                Apply changes to future unpaid instances
              </label>
            )}
            {error && <div className="text-sm text-destructive">{error}</div>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-primary py-2 px-4 text-sm font-medium tracking-wide text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Saving..." : "Save Recurring Item"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
