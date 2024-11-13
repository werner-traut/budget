// src/lib/utils/pay-periods.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface PayPeriod {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  daily_budget: number | null;
  total_budget: number | null;
  created_at: string;
  updated_at: string;
}

export async function checkOverlappingPeriods(
  userId: string,
  startDate: Date,
  endDate: Date,
  excludePeriodId?: string
): Promise<boolean> {
  const query = supabase
    .from("pay_periods")
    .select("id")
    .eq("user_id", userId)
    .or(
      `start_date,lte,${endDate.toISOString()},end_date,gte,${startDate.toISOString()}`
    );

  if (excludePeriodId) {
    query.neq("id", excludePeriodId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("Failed to check overlapping periods");
  }

  return data.length > 0;
}

export async function createPayPeriod(
  userId: string,
  startDate: Date,
  endDate: Date,
  dailyBudget?: number,
  totalBudget?: number
): Promise<PayPeriod> {
  // Check for overlapping periods first
  const hasOverlap = await checkOverlappingPeriods(userId, startDate, endDate);
  if (hasOverlap) {
    throw new Error("Pay period overlaps with existing period");
  }

  const { data, error } = await supabase
    .from("pay_periods")
    .insert({
      user_id: userId,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      daily_budget: dailyBudget,
      total_budget: totalBudget,
    })
    .select()
    .single();

  if (error) {
    throw new Error("Failed to create pay period");
  }

  return data;
}

export async function updatePayPeriod(
  periodId: string,
  userId: string,
  updates: Partial<
    Omit<PayPeriod, "id" | "user_id" | "created_at" | "updated_at">
  >
): Promise<PayPeriod> {
  // If dates are being updated, check for overlaps
  if (updates.start_date || updates.end_date) {
    const { data: currentPeriod } = await supabase
      .from("pay_periods")
      .select("start_date, end_date")
      .eq("id", periodId)
      .single();

    const startDate = new Date(updates.start_date || currentPeriod?.start_date);
    const endDate = new Date(updates.end_date || currentPeriod?.end_date);

    const hasOverlap = await checkOverlappingPeriods(
      userId,
      startDate,
      endDate,
      periodId
    );
    if (hasOverlap) {
      throw new Error("Updated dates overlap with existing period");
    }
  }

  const { data, error } = await supabase
    .from("pay_periods")
    .update(updates)
    .eq("id", periodId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw new Error("Failed to update pay period");
  }

  return data;
}
