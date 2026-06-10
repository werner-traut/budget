export interface BudgetEntry {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  due_date: string;
  paid_at: string | null;
  actual_amount: number | null;
  source_recurring_id: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateBudgetEntryDto = {
  name: string;
  amount: number;
  due_date: string;
};

export interface UpdateBudgetEntryDto {
  name?: string;
  amount?: number;
  due_date?: string;
  paid_at?: string | null;
  actual_amount?: number | null;
}
