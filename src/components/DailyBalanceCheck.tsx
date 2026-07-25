// src/components/DailyBalanceCheck.tsx
"use client";

import { useState } from "react";
import { DailyBalanceModal } from "./DailyBalanceModal";
import { getLocalDateString } from "@/lib/utils/date";
import {
  dailyBalanceUpsertSchema,
  parseApiResponse,
} from "@/lib/api/schemas";

interface DailyBalanceCheckProps {
  onDailyBalanceChange: (balance: number) => void;
  initialBalance?: number | null;
  isOpen?: boolean;
  onClose?: () => void;
}

export function DailyBalanceCheck({
  onDailyBalanceChange,
  initialBalance,
  isOpen: controlledIsOpen,
  onClose,
}: DailyBalanceCheckProps) {
  const [dismissed, setDismissed] = useState(false);
  const [currentBalance, setCurrentBalance] = useState<number | undefined>(
    initialBalance !== null ? initialBalance : undefined
  );

  // Uncontrolled mode: open automatically while no balance has been entered,
  // until explicitly dismissed.
  const isOpen =
    controlledIsOpen !== undefined
      ? controlledIsOpen
      : !currentBalance && !dismissed;
  const handleClose = onClose || (() => setDismissed(true));

  return (
    <DailyBalanceModal
      isOpen={isOpen}
      onClose={handleClose}
      onSubmit={async (balance) => {
        try {
          const response = await fetch("/api/daily-balance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ balance, date: getLocalDateString() }),
          });

          const data = await parseApiResponse(
            response,
            dailyBalanceUpsertSchema,
            "Failed to save balance"
          );
          setCurrentBalance(data.balance);
          onDailyBalanceChange(data.balance);
          handleClose();
        } catch (error) {
          console.error("Failed to save balance:", error);
          throw error;
        }
      }}
      currentBalance={currentBalance}
    />
  );
}
