// src/app/api/budget-entries/route.ts
import { auth } from "@/auth";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { CreateBudgetEntryDto } from "@/types/budget";

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
      .from("budget_items")
      .select("*")
      .eq("user_id", session.user.id)
      .order("due_date", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch budget entries:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body: CreateBudgetEntryDto = await req.json();

    const { data, error } = await supabase
      .from("budget_items")
      .insert({
        user_id: session.user.id,
        name: body.name,
        amount: body.amount,
        due_date: body.due_date,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to create budget entry:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
