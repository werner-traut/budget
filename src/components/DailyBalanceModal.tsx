"use client";

import React, { useEffect, useRef, useState } from "react";
import { XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  const balanceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && balanceInputRef.current) {
      balanceInputRef.current.focus();
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="relative">
          <CardTitle className="text-xl font-semibold">
            Update Bank Balance
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
                Current Bank Balance
              </label>
              <input
                type="number"
                ref={balanceInputRef}
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter current balance"
                required
              />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="text-sm text-gray-500">
              Last updated: {new Date().toLocaleDateString()}
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Updating..." : "Update Balance"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
