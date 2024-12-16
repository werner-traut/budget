
export interface BalanceHistory {
    id: string;
    bank_balance: number;
    current_period_end_balance: number;
    next_period_end_balance: number;
    period_after_end_balance: number;
    balance_date: string;
    created_at: string;
    updated_at: string;
  }
  