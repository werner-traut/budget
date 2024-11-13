// src/components/DailyBalanceCheck.tsx
"use client";

import { useEffect, useState } from "react";
import { DailyBalanceModal } from "./DailyBalanceModal";

export function DailyBalanceCheck() {
  const [showModal, setShowModal] = useState(false);
  const [currentBalance, setCurrentBalance] = useState<number | undefined>(
    undefined
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkDailyBalance = async () => {
      try {
        setIsLoading(true);
        // Check if we have a balance for today
        const today = new Date().toISOString().split("T")[0];
        const response = await fetch(`/api/daily-balance?date=${today}`);

        if (response.ok) {
          const data = await response.json();
          if (data && data.balance !== null) {
            setCurrentBalance(data.balance ?? undefined);
          } else {
            setShowModal(true);
          }
        }
      } catch (error) {
        console.error("Failed to check daily balance:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkDailyBalance();
  }, []);

  if (isLoading) return null;

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
