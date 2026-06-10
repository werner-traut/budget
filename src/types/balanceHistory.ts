
export interface BalanceHistory {
    id: string;
    bank_balance: number;
    current_period_end_balance: number;
    next_period_end_balance: number;
    period_after_end_balance: number;
    balance_date: string;
    created_at: string;
    updated_at: string;
    // Adhoc savings tracking — null on rows recorded before the feature existed.
    adhoc_delta?: number | null;
    adhoc_cumulative?: number | null;
    adhoc_salary_received?: number | null;
    adhoc_expenses_due?: number | null;
    adhoc_budget?: number | null;
    adhoc_baseline?: boolean;
  }
