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
    // eslint-disable-next-line prefer-const
    let { data, error } = await supabase
      .from("adhoc_settings")
      .select("*")
      .eq("user_id", session.user.id)
      .single();

    if (error && error.code === "PGRST116") {
      // If no settings exist, create default settings
      const { data: newData, error: insertError } = await supabase
        .from("adhoc_settings")
        .insert({
          user_id: session.user.id,
          daily_amount: 40.0,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      data = newData;
    } else if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch adhoc settings:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const { daily_amount } = body;

    // Use upsert with the unique key (user_id)
    const { data, error } = await supabase
      .from("adhoc_settings")
      .upsert(
        {
          user_id: session.user.id,
          daily_amount,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id", // Specify the column to match on
          ignoreDuplicates: false, // We want to update if exists
        }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to update adhoc settings:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
