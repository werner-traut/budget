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
      .from("pay_periods")
      .select("*")
      .eq("user_id", session.user.id)
      .order("start_date", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch pay periods:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

async function validatePeriodOrder(
  userId: string,
  newPeriod: { period_type: string; start_date: string }
) {
  // Get all existing periods
  const { data: periods } = await supabase
    .from("pay_periods")
    .select("period_type, start_date")
    .eq("user_id", userId)
    .neq("period_type", "CLOSED_PERIOD")
    .order("start_date", { ascending: true });

  // Add new period to the list and sort
  const allPeriods = [...(periods || []), newPeriod].sort(
    (a, b) =>
      new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );

  // Check order matches period types
  const correctOrder = [
    "CURRENT_PERIOD",
    "NEXT_PERIOD",
    "PERIOD_AFTER",
    "FUTURE_PERIOD",
  ];
  const activePeriods = allPeriods.filter(
    (p) => p.period_type !== "CLOSED_PERIOD"
  );

  for (let i = 0; i < activePeriods.length; i++) {
    if (activePeriods[i].period_type !== correctOrder[i]) {
      throw new Error("Periods must be in correct chronological order");
    }
  }
}

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();

    // Validate required fields
    if (!body.period_type || !body.start_date || !body.salary_amount) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Validate period order
    await validatePeriodOrder(session.user.id, {
      period_type: body.period_type,
      start_date: body.start_date,
    });

    const { data, error } = await supabase
      .from("pay_periods")
      .insert({
        user_id: session.user.id,
        period_type: body.period_type,
        start_date: body.start_date,
        salary_amount: body.salary_amount,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to create pay period:", error);
    return new NextResponse(
      error instanceof Error ? error.message : "Internal Server Error",
      { status: 500 }
    );
  }
}
