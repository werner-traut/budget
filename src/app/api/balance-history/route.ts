import { auth } from "@/auth";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from("balance_history")
      .select("*")
      .eq("user_id", session.user.id)
      .order("balance_date", { ascending: true })
      .limit(30); // Last 30 records

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch balance history:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const today = new Date().toISOString().split("T")[0]; // Get today's date in YYYY-MM-DD format

    // Use upsert to update existing record or create new one
    const { data, error } = await supabase
      .from("balance_history")
      .upsert(
        {
          user_id: session.user.id,
          balance_date: today,
          bank_balance: body.bankBalance,
          current_period_end_balance: body.currentPeriodEndBalance,
          next_period_end_balance: body.nextPeriodEndBalance,
          period_after_end_balance: body.periodAfterEndBalance,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,balance_date",
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to update balance history:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
