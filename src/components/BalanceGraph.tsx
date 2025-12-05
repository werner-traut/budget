"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";
import {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { formatDateForDisplay } from "@/lib/utils/date";
import type { BalanceHistory } from '@/types/balanceHistory';

// Define the shape of our data point
interface DataPoint {
  date: string;
  "Bank Balance": number;
  "Current Period End Balance": number;
  "Next Period End Balance": number;
  "Period After End Balance": number;
  [key: string]: string | number; // Allow for dynamic key access
}

// Define the structure of the payload item
interface CustomTooltipPayloadItem {
  name: string;
  value: number;
  color: string;
  dataKey: string;
  payload: DataPoint;
}

// Define the props for our custom tooltip component
interface CustomTooltipProps
  extends Omit<TooltipProps<ValueType, NameType>, "payload"> {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  label?: string;
}

function BalanceGraph() {
  const [duration, setDuration] = useState("30");
  const [history, setHistory] = useState<BalanceHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalanceHistory = async (duration: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/balance-history?days=${duration}`);
      if (!response.ok) throw new Error('Failed to fetch balance history');
      const data = await response.json();
      setHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balance history');
      console.error('Error fetching balance history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalanceHistory(duration);
  }, [duration]);

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

  const data: DataPoint[] = history.map((entry) => ({
    date: formatDateForDisplay(entry.balance_date),
    "Bank Balance": Number(entry.bank_balance),
    "Current Period End Balance": Number(entry.current_period_end_balance),
    "Next Period End Balance": Number(entry.next_period_end_balance),
    "Period After End Balance": Number(entry.period_after_end_balance),
  }));

  // Calculate linear regression trend line for Bank Balance
  const n = data.length;
  if (n > 1) {
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    // Use index as X coordinate (0, 1, 2, ...) to simplify calculation and avoid date parsing issues
    for (let i = 0; i < n; i++) {
      const x = i;
      const y = data[i]["Bank Balance"];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Add trend line values to data
    for (let i = 0; i < n; i++) {
      data[i]["Trend"] = slope * i + intercept;
    }
  }

  // Calculate domain for YAxis to add some padding
  const allValues = data.flatMap((entry) => [
    entry["Bank Balance"],
    entry["Current Period End Balance"],
    entry["Next Period End Balance"],
    entry["Period After End Balance"],
    (entry["Trend"] as number) || entry["Bank Balance"],
  ]);
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const padding = (maxValue - minValue) * 0.1; // 10% padding

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border rounded shadow-sm">
          <p className="font-bold">{label}</p>
          {payload.map((entry: CustomTooltipPayloadItem) => (
            <p key={entry.name} style={{ color: entry.color }}>
              {entry.name}: ${entry.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Balance History</CardTitle>
        <Select value={duration} onValueChange={setDuration}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Select duration" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 Days</SelectItem>
            <SelectItem value="60">60 Days</SelectItem>
            <SelectItem value="90">90 Days</SelectItem>
            <SelectItem value="120">120 Days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="h-[600px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{
                top: 20,
                right: 30,
                left: 60,
                bottom: 60,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="date"
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fill: "#666", fontSize: 12 }}
                tickMargin={20}
              />
              <YAxis
                domain={[minValue - padding, maxValue + padding]}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
                tick={{ fill: "#666", fontSize: 12 }}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={36}
                wrapperStyle={{
                  paddingTop: "20px",
                }}
              />
              <Line
                type="monotone"
                dataKey="Bank Balance"
                stroke="#6366f1"
                dot={false}
                strokeWidth={2}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="Trend"
                stroke="#94a3b8"
                strokeDasharray="5 5"
                dot={false}
                strokeWidth={2}
                activeDot={false}
                name="Trend (Bank Balance)"
              />
              <Line
                type="monotone"
                dataKey="Current Period End Balance"
                stroke="#22c55e"
                dot={false}
                strokeWidth={2}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="Next Period End Balance"
                stroke="#eab308"
                dot={false}
                strokeWidth={2}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="Period After End Balance"
                stroke="#ef4444"
                dot={false}
                strokeWidth={2}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default BalanceGraph;
