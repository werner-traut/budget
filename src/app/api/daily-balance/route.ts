import { auth } from "@/auth";
import { formatDateForAPI } from "@/lib/utils/date";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { balance } = await req.json();

    const { data, error } = await supabase
      .from("daily_balances")
      .upsert(
        {
          user_id: session.user.id,
          balance,
          date: new Date().toISOString().split("T")[0],
        },
        {
          onConflict: "user_id,date",
        }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to save balance:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");

  try {
    const query = supabase
      .from("daily_balances")
      .select("*")
      .eq("user_id", session.user.id)
      .order("date", { ascending: false }); // Default ascending order for latest

    if (dateParam) {
      // Filter by date if provided
      query.eq("date", formatDateForAPI(dateParam)); // Parse date parameter
    } else {
      // Limit to 1 record if no date provided
      query.limit(1);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") {
        // No balance found
        return NextResponse.json({ balance: null });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch balance:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
