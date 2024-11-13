export interface BudgetEntry {
  id: string;
  user_id: string;
  period_id: string | null;
  name: string;
  amount: number;
  due_date: string;
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
}
