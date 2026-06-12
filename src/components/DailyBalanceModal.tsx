"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateForDisplay } from "@/lib/utils/date";

interface DailyBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (balance: number) => Promise<void>;
  currentBalance?: number;
}

export function DailyBalanceModal({
  isOpen,
  onClose,
  onSubmit,
  currentBalance,
}: DailyBalanceModalProps) {
  const [balance, setBalance] = useState(currentBalance?.toString() || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const balanceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen && balanceInputRef.current) {
      // Small timeout to ensure the modal is rendered before focusing
      setTimeout(() => {
        balanceInputRef.current?.focus();
      }, 0);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await onSubmit(parseFloat(balance));
      onClose();
    } catch (err) {
      setError("Failed to update balance. Please try again.");
      console.error("Error updating balance:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-[2px] flex items-center justify-center z-50 animate-in fade-in duration-200">
      <Card className="w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">
        <CardHeader className="relative">
          <CardTitle className="text-xl font-semibold">
            Update Bank Balance
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
                Current Bank Balance
              </label>
              <input
                type="number"
                ref={balanceInputRef}
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="w-full rounded-md border border-input bg-background p-2 font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-ring focus:border-ring"
                placeholder="Enter current balance"
                required
              />
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
            <div className="font-mono text-xs tabular-nums text-muted-foreground">
              Last updated: {formatDateForDisplay(new Date())}
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-primary py-2 px-4 text-sm font-medium tracking-wide text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Updating..." : "Update Balance"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>,
    document.body
  );
}
