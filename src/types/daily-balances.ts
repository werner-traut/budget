import { Prisma } from "@prisma/client";

export interface DailyBalanceResponse {
  id: string;
  user_id: string;
  balance: Prisma.Decimal;
  date: Date;
  created_at: Date;
  updated_at: Date;
  users?: {
    id: string;
    email: string;
    name: string | null;
  };
}
