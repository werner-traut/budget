import { Decimal } from "@prisma/client/runtime/library";

export interface DailyBalanceResponse {
  id: string;
  user_id: string;
  balance: Decimal;
  date: Date;
  created_at: Date;
  updated_at: Date;
  users?: {
    id: string;
    email: string;
    name: string | null;
  };
}
