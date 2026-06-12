"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
  ReferenceLine,
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
  "Adhoc Savings": number | null;
  [key: string]: string | number | null; // Allow for dynamic key access
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

/* Ledger palette: ink green, sage, ink blue, oxide red, ochre. */
const LINE_CONFIG = [
  { key: "Bank Balance",               color: "#1d5c4a" },
  { key: "Trend",                      color: "#a39a8a", label: "Trend (Bank Balance)" },
  { key: "Current Period End Balance", color: "#5b8a72" },
  { key: "Next Period End Balance",    color: "#4a6fa5" },
  { key: "Period After End Balance",   color: "#b3402e" },
  { key: "Adhoc Savings",              color: "#b97e16" },
] as const;

const AXIS_TICK = {
  fill: "#6f6759",
  fontSize: 11,
  fontFamily: "var(--font-plex-mono), monospace",
};

type LineKey = (typeof LINE_CONFIG)[number]["key"];

function BalanceGraph() {
  const [duration, setDuration] = useState("30");
  const [customDate, setCustomDate] = useState("");
  const [history, setHistory] = useState<BalanceHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleLines, setVisibleLines] = useState<Record<LineKey, boolean>>({
    "Bank Balance": true,
    "Trend": true,
    "Current Period End Balance": true,
    "Next Period End Balance": true,
    "Period After End Balance": true,
    "Adhoc Savings": true,
  });

  const toggleLine = (key: LineKey) =>
    setVisibleLines((prev) => ({ ...prev, [key]: !prev[key] }));

  const fetchBalanceHistory = async (duration: string, startDate?: string) => {
    try {
      if (duration === "custom" && !startDate) return;

      setIsLoading(true);
      setError(null);

      let url = `/api/balance-history?days=${duration}`;
      if (duration === "custom" && startDate) {
        url = `/api/balance-history?startDate=${startDate}`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch balance history');
      const data: BalanceHistory[] = await response.json();
      setHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balance history');
      console.error('Error fetching balance history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalanceHistory(duration, customDate);
  }, [duration, customDate]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 h-96">
          <div className="font-display italic text-muted-foreground">
            Drawing the lines&hellip;
          </div>
          <div className="h-px w-24 bg-foreground/30 animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="font-mono text-sm text-destructive">Error: {error}</div>
        </CardContent>
      </Card>
    );
  }

  const data: DataPoint[] = history.map((entry) => {
    // Cumulative adhoc savings is computed server-side and frozen at write
    // time. Rows recorded before the feature have no value and are left as
    // gaps so the series naturally begins where tracking started.
    const cumulative =
      entry.adhoc_cumulative === null || entry.adhoc_cumulative === undefined
        ? null
        : Number(entry.adhoc_cumulative);

    return {
      date: formatDateForDisplay(entry.balance_date),
      "Bank Balance": Number(entry.bank_balance),
      "Current Period End Balance": Number(entry.current_period_end_balance),
      "Next Period End Balance": Number(entry.next_period_end_balance),
      "Period After End Balance": Number(entry.period_after_end_balance),
      "Adhoc Savings": cumulative,
    };
  });

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
  const minValue = allValues.length ? Math.min(...allValues) : 0;
  const maxValue = allValues.length ? Math.max(...allValues) : 0;
  const padding = Math.max((maxValue - minValue) * 0.1, 1); // 10% padding

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-md border border-border bg-card p-4 shadow-md">
          <p className="mb-1 font-mono text-xs font-semibold uppercase tracking-[0.12em]">
            {label}
          </p>
          {payload.map((entry: CustomTooltipPayloadItem) => (
            <p
              key={entry.name}
              className="font-mono text-xs tabular-nums"
              style={{ color: entry.color }}
            >
              {entry.name}: ${entry.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Gradient for savings chart: green above 0, red below
  const savingsValues = data
    .map((d) => d["Adhoc Savings"])
    .filter((v): v is number => v !== null);
  const hasSavingsData = savingsValues.length > 0;
  const savingsMin = hasSavingsData ? Math.min(...savingsValues) : 0;
  const savingsMax = hasSavingsData ? Math.max(...savingsValues) : 0;
  const savingsPad = Math.max(Math.abs(savingsMax), Math.abs(savingsMin), 1) * 0.15;
  const savingsDomainMin = savingsMin - savingsPad;
  const savingsDomainMax = savingsMax + savingsPad;
  const zeroOffset =
    savingsDomainMax <= 0
      ? 0
      : savingsDomainMin >= 0
      ? 1
      : savingsDomainMax / (savingsDomainMax - savingsDomainMin);

  const chartMargin = { top: 20, right: 30, left: 60, bottom: 60 };
  const savingsMargin = { top: 10, right: 30, left: 60, bottom: 0 };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Balance History</CardTitle>
        <div className="flex items-center gap-2">
          {duration === "custom" && (
            <Input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="w-auto"
            />
          )}
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 Days</SelectItem>
              <SelectItem value="60">60 Days</SelectItem>
              <SelectItem value="90">90 Days</SelectItem>
              <SelectItem value="120">120 Days</SelectItem>
              <SelectItem value="custom">Custom Date</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Line visibility toggles */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 pb-1">
          {LINE_CONFIG.map((cfg) => (
            <label key={cfg.key} className="flex items-center gap-1.5 cursor-pointer select-none font-mono text-xs text-foreground/80">
              <input
                type="checkbox"
                checked={visibleLines[cfg.key]}
                onChange={() => toggleLine(cfg.key)}
                className="sr-only"
              />
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded border"
                style={{
                  backgroundColor: visibleLines[cfg.key] ? cfg.color : "transparent",
                  borderColor: cfg.color,
                }}
              >
                {visibleLines[cfg.key] && (
                  <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
              {"label" in cfg ? cfg.label : cfg.key}
            </label>
          ))}
        </div>
        {/* calc: 100vh minus header(64) nav+margin(80) main-padding(64) card-header(84) card-content-padding(24) outer-padding(48) */}
        <div style={{ height: 'calc(100vh - 364px)', minHeight: '420px' }} className="flex flex-col gap-2">
        {/* Balance chart — takes all remaining space */}
        <div className="flex-1 min-h-0">
          <ResponsiveContainer
            width="100%"
            height="100%"
            minHeight={150}
            initialDimension={{ width: 800, height: 300 }}
          >
            <LineChart data={data} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="#aca390" opacity={0.35} />
              <XAxis
                dataKey="date"
                angle={-45}
                textAnchor="end"
                height={80}
                tick={AXIS_TICK}
                tickMargin={20}
              />
              <YAxis
                domain={[minValue - padding, maxValue + padding]}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
                tick={AXIS_TICK}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={36}
                wrapperStyle={{
                  paddingTop: "20px",
                  fontFamily: "var(--font-plex-mono), monospace",
                  fontSize: "11px",
                }}
              />
              {visibleLines["Bank Balance"] && (
                <Line
                  type="monotone"
                  dataKey="Bank Balance"
                  stroke={LINE_CONFIG[0].color}
                  dot={false}
                  strokeWidth={2}
                  activeDot={{ r: 6 }}
                />
              )}
              {visibleLines["Trend"] && (
                <Line
                  type="monotone"
                  dataKey="Trend"
                  stroke={LINE_CONFIG[1].color}
                  strokeDasharray="5 5"
                  dot={false}
                  strokeWidth={2}
                  activeDot={false}
                  name="Trend (Bank Balance)"
                />
              )}
              {visibleLines["Current Period End Balance"] && (
                <Line
                  type="monotone"
                  dataKey="Current Period End Balance"
                  stroke={LINE_CONFIG[2].color}
                  dot={false}
                  strokeWidth={2}
                  activeDot={{ r: 6 }}
                />
              )}
              {visibleLines["Next Period End Balance"] && (
                <Line
                  type="monotone"
                  dataKey="Next Period End Balance"
                  stroke={LINE_CONFIG[3].color}
                  dot={false}
                  strokeWidth={2}
                  activeDot={{ r: 6 }}
                />
              )}
              {visibleLines["Period After End Balance"] && (
                <Line
                  type="monotone"
                  dataKey="Period After End Balance"
                  stroke={LINE_CONFIG[4].color}
                  dot={false}
                  strokeWidth={2}
                  activeDot={{ r: 6 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Adhoc savings chart */}
        {visibleLines["Adhoc Savings"] && <div className="border-t pt-2">
          <p className="pl-[72px] mb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Cumulative Adhoc Savings
            <span className="ml-2 normal-case tracking-normal text-muted-foreground/70">
              (above 0 = under budget · below 0 = over budget)
            </span>
          </p>
          <div className="h-[180px] w-full">
            {!hasSavingsData ? (
              <div className="flex h-full items-center justify-center font-display text-sm italic text-muted-foreground">
                No adhoc savings tracked in this range yet.
              </div>
            ) : (
            <ResponsiveContainer
              width="100%"
              height="100%"
              initialDimension={{ width: 800, height: 180 }}
            >
              <AreaChart data={data} margin={savingsMargin}>
                <defs>
                  <linearGradient
                    id="savingsGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset={`${zeroOffset * 100}%`}
                      stopColor="#2e7d5b"
                      stopOpacity={0.25}
                    />
                    <stop
                      offset={`${zeroOffset * 100}%`}
                      stopColor="#b3402e"
                      stopOpacity={0.25}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#aca390" opacity={0.25} />
                <XAxis dataKey="date" hide />
                <YAxis
                  domain={[savingsDomainMin, savingsDomainMax]}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                  tick={AXIS_TICK}
                  width={80}
                />
                <Tooltip
                  formatter={(value: ValueType | undefined) => [
                    `$${Number(value ?? 0).toFixed(2)}`,
                    "Adhoc Savings",
                  ]}
                  labelFormatter={() => ""}
                />
                <ReferenceLine y={0} stroke="#8a8273" strokeWidth={1.5} />
                <Area
                  type="monotone"
                  dataKey="Adhoc Savings"
                  stroke="#b97e16"
                  strokeWidth={2}
                  fill="url(#savingsGradient)"
                  dot={{ r: 3, fill: "#b97e16", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>}
        </div>
      </CardContent>
    </Card>
  );
}

export default BalanceGraph;
