// src/components/DailyBalanceCheck.tsx
"use client";

import { useEffect, useState } from "react";
import { DailyBalanceModal } from "./DailyBalanceModal";

interface DailyBalanceCheckProps {
  onDailyBalanceChange: (balance: number) => void;
}

export function DailyBalanceCheck({
  onDailyBalanceChange,
}: DailyBalanceCheckProps) {
  const [showModal, setShowModal] = useState(false);
  const [currentBalance, setCurrentBalance] = useState<number | undefined>(
    undefined
  );

  useEffect(() => {
    if (!currentBalance) {
      setShowModal(true);
    }
  }, [currentBalance]);

  return (
    <DailyBalanceModal
      isOpen={showModal}
      onClose={() => setShowModal(false)}
      onSubmit={async (balance) => {
        try {
          const response = await fetch("/api/daily-balance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ balance }),
          });

          if (!response.ok) throw new Error("Failed to save balance");

          const data = await response.json();
          setCurrentBalance(data.balance);
          onDailyBalanceChange(data.balance);
          setShowModal(false);
        } catch (error) {
          console.error("Failed to save balance:", error);
          throw error;
        }
      }}
      currentBalance={currentBalance}
    />
  );
}
