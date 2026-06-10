export type RecurrenceFrequency = "MONTHLY" | "WEEKLY" | "PER_PERIOD";

export interface RecurringItem {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  frequency: RecurrenceFrequency;
  day_of_month: number | null;
  interval_weeks: number | null;
  anchor_date: string;
  active: boolean;
  materialized_through: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateRecurringItemDto = {
  name: string;
  amount: number;
  frequency: RecurrenceFrequency;
  day_of_month?: number | null;
  interval_weeks?: number | null;
  anchor_date: string;
};

export interface UpdateRecurringItemDto {
  name?: string;
  amount?: number;
  frequency?: RecurrenceFrequency;
  day_of_month?: number | null;
  interval_weeks?: number | null;
  anchor_date?: string;
  active?: boolean;
  applyToFutureInstances?: boolean;
}
