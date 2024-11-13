export type PeriodType =
  | "CURRENT_PERIOD"
  | "NEXT_PERIOD"
  | "PERIOD_AFTER"
  | "FUTURE_PERIOD"
  | "CLOSED_PERIOD";

export interface PayPeriod {
  id: string;
  user_id: string;
  period_type: PeriodType;
  start_date: string;
  salary_amount: number;
  created_at: string;
  updated_at: string;
}
