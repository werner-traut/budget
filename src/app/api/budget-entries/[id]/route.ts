// src/api/budget-entries/[id]/route.ts
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { formatDateForAPI, parseDateStringToUTC } from "@/lib/utils/date";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const id = req.nextUrl.pathname.split("/").pop(); // Get ID from URL path

  try {
    const budgetItem = await prisma.budget_items.findUnique({
      where: { id },
    });

    if (!budgetItem) {
      return new NextResponse("Not found", { status: 404 });
    }

    if (budgetItem.user_id !== session.user.id) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    return NextResponse.json(budgetItem);
  } catch (error) {
    console.error("Failed to fetch budget entry:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// PUT update entry
export async function PUT(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const id = req.nextUrl.pathname.split("/").pop(); // Get ID from URL path

  try {
    const body = await req.json();

    // First verify the entry belongs to the user
    const existingEntry = await prisma.budget_items.findUnique({
      where: { id },
    });

    if (!existingEntry) {
      return new NextResponse("Not found", { status: 404 });
    }

    if (existingEntry.user_id !== session.user.id) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    const budgetItem = await prisma.budget_items.update({
      where: { id },
      data: {
        name: body.name,
        amount: body.amount,
        ...(body.due_date
          ? {
              due_date: parseDateStringToUTC(
                formatDateForAPI(body.due_date)
              ),
            }
          : {}),
        updated_at: new Date(),
      },
    });

    return NextResponse.json(budgetItem);
  } catch (error) {
    console.error("Failed to update budget entry:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// DELETE entry
export async function DELETE(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const id = req.nextUrl.pathname.split("/").pop(); // Get ID from URL path

  try {
    // First verify the entry belongs to the user
    const existingEntry = await prisma.budget_items.findUnique({
      where: { id },
    });

    if (!existingEntry) {
      return new NextResponse("Not found", { status: 404 });
    }

    if (existingEntry.user_id !== session.user.id) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    await prisma.budget_items.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete budget entry:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
