// src/app/api/budget-entries/route.ts
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { CreateBudgetEntryDto } from "@/types/budget";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const budgetItems = await prisma.budget_items.findMany({
      where: {
        user_id: session.user.id,
      },
      orderBy: {
        due_date: "asc",
      },
    });

    return NextResponse.json(budgetItems);
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

    const budgetItem = await prisma.budget_items.create({
      data: {
        user_id: session.user.id,
        name: body.name,
        amount: body.amount,
        due_date: new Date(body.due_date),
      },
    });

    return NextResponse.json(budgetItem);
  } catch (error) {
    console.error("Failed to create budget entry:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
