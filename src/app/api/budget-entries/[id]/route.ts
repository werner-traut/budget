// src/api/budget-entries/[id]/route.ts
import { auth } from "@/auth";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from("budget_items")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", session.user.id)
      .single();

    if (error) throw error;
    if (!data) {
      return new NextResponse("Not found", { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch budget entry:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// PUT update entry
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();

    // First verify the entry belongs to the user
    const { data: existingEntry, error: fetchError } = await supabase
      .from("budget_items")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", session.user.id)
      .single();

    if (fetchError || !existingEntry) {
      return new NextResponse("Not found", { status: 404 });
    }

    const { data, error } = await supabase
      .from("budget_items")
      .update({
        name: body.name,
        amount: body.amount,
        due_date: body.due_date,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .eq("user_id", session.user.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to update budget entry:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// DELETE entry
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    // First verify the entry belongs to the user
    const { data: existingEntry, error: fetchError } = await supabase
      .from("budget_items")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", session.user.id)
      .single();

    if (fetchError || !existingEntry) {
      return new NextResponse("Not found", { status: 404 });
    }

    const { error } = await supabase
      .from("budget_items")
      .delete()
      .eq("id", params.id)
      .eq("user_id", session.user.id);

    if (error) throw error;

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete budget entry:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
