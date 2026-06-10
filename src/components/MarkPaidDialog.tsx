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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="relative">
          <CardTitle className="text-xl font-semibold">
            Mark &ldquo;{entry.name}&rdquo; as Paid
          </CardTitle>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-500 hover:text-gray-700"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount actually paid
              </label>
              <input
                ref={amountInputRef}
                type="number"
                step="0.01"
                min="0"
                value={actualAmount}
                onChange={(e) => setActualAmount(e.target.value)}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Budgeted: ${Number(entry.amount).toFixed(2)}
              </p>
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 focus:outline-hidden focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Saving..." : "Mark as Paid"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
