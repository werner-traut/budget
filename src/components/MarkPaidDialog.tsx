"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle } from "lucide-react";
import type { BudgetEntry } from "@/types/budget";

interface MarkPaidDialogProps {
  entry: BudgetEntry;
  onClose: () => void;
  onConfirm: (actualAmount: number) => Promise<void>;
}

export function MarkPaidDialog({ entry, onClose, onConfirm }: MarkPaidDialogProps) {
  const [actualAmount, setActualAmount] = useState(entry.amount.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    amountInputRef.current?.focus();
    amountInputRef.current?.select();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(actualAmount);
    if (Number.isNaN(parsed) || parsed < 0) {
      setError("Please enter a valid amount.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await onConfirm(parsed);
      onClose();
    } catch (err) {
      setError("Failed to mark entry as paid. Please try again.");
      console.error("Error marking entry as paid:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-[2px] flex items-center justify-center z-50 animate-in fade-in duration-200">
      <Card className="w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">
        <CardHeader className="relative">
          <CardTitle className="text-xl font-semibold">
            Mark &ldquo;{entry.name}&rdquo; as Paid
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
                Amount actually paid
              </label>
              <input
                ref={amountInputRef}
                type="number"
                step="0.01"
                min="0"
                value={actualAmount}
                onChange={(e) => setActualAmount(e.target.value)}
                className="w-full rounded-md border border-input bg-background p-2 font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-ring focus:border-ring"
                required
              />
              <p className="font-mono text-xs tabular-nums text-muted-foreground mt-1">
                Budgeted: ${Number(entry.amount).toFixed(2)}
              </p>
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-positive py-2 px-4 text-sm font-medium tracking-wide text-primary-foreground shadow-sm transition-colors hover:bg-positive/90 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Saving..." : "Mark as Paid"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
