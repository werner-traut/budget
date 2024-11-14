import { auth } from "@/auth";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, NextRequest } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const id = req.nextUrl.pathname.split("/").pop(); // Get ID from URL path

  try {
    const body = await req.json();
    const { data, error } = await supabase
      .from("pay_periods")
      .update({
        period_type: body.period_type,
        start_date: body.start_date,
        salary_amount: body.salary_amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", session.user.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to update pay period:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
