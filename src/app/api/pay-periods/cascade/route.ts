import { auth } from "@/auth";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cascadePeriodTypes, shouldCascadePeriods } from "@/lib/utils/periods";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    // Get all periods
    const { data: periods, error: fetchError } = await supabase
      .from("pay_periods")
      .select("*")
      .eq("user_id", session.user.id)
      .order("start_date", { ascending: true });

    if (fetchError) throw fetchError;
    if (!periods?.length) {
      return NextResponse.json({ message: "No periods to update" });
    }

    // Check if cascade is needed
    if (!shouldCascadePeriods(periods)) {
      return NextResponse.json({ message: "No cascade needed" });
    }

    const updatedPeriods = cascadePeriodTypes(periods);

    // Update all active periods
    const updates = updatedPeriods
      .filter((p) => p.period_type !== "CLOSED_PERIOD")
      .map((period) => ({
        id: period.id,
        period_type: period.period_type,
      }));

    if (updates.length > 0) {
      const { error: updateError } = await supabase
        .from("pay_periods")
        .upsert(updates);

      if (updateError) throw updateError;
    }

    return NextResponse.json({
      updated: updates.length,
      periods: updatedPeriods,
    });
  } catch (error) {
    console.error("Failed to cascade period types:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
