// src/components/DailyBalanceCheck.tsx
"use client";

import { useEffect, useState } from "react";
import { DailyBalanceModal } from "./DailyBalanceModal";

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
  const [showModal, setShowModal] = useState(false);
  const [currentBalance, setCurrentBalance] = useState<number | undefined>(
    initialBalance !== null ? initialBalance : undefined
  );

  useEffect(() => {
    if (!currentBalance && controlledIsOpen === undefined) {
      setShowModal(true);
    }
  }, [currentBalance, controlledIsOpen]);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : showModal;
  const handleClose = onClose || (() => setShowModal(false));

  return (
    <DailyBalanceModal
      isOpen={isOpen}
      onClose={handleClose}
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
