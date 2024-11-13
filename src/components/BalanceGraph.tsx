"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatDateForDisplay } from "@/lib/utils/date";

interface BalanceHistory {
  id: string;
  bank_balance: number;
  current_period_end_balance: number;
  next_period_end_balance: number;
  period_after_end_balance: number;
  balance_date: string;
  created_at: string;
  updated_at: string;
}

export function BalanceGraph() {
  const [history, setHistory] = useState<BalanceHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/balance-history");
        if (!response.ok) throw new Error("Failed to fetch balance history");
        const data = await response.json();
        setHistory(data);
      } catch (err) {
        console.error("Error fetching balance history:", err);
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-red-600">Error: {error}</div>
        </CardContent>
      </Card>
    );
  }

  const data = history.map((entry) => ({
    date: formatDateForDisplay(entry.balance_date),
    "Bank Balance": entry.bank_balance,
    "Current Period End Balance": entry.current_period_end_balance,
    "Next Period End Balance": entry.next_period_end_balance,
    "Period After End Balance": entry.period_after_end_balance,
  }));

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Balance History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[600px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="Bank Balance"
                stroke="#8884d8"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="Current Period End Balance"
                stroke="#82ca9d"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="Next Period End Balance"
                stroke="#ffc658"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="Period After End Balance"
                stroke="#ff7300"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="Daily Expenses"
                stroke="#00C49F"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
