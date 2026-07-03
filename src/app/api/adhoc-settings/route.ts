import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = 'nodejs';

const adhocSettingsSchema = z.object({
  daily_amount: z.number().min(0),
});

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    // Try to find existing settings
    let adhocSettings = await prisma.adhoc_settings.findUnique({
      where: {
        user_id: session.user.id,
      },
      include: {
        users: true,
      },
    });

    // If no settings exist, create default settings
    if (!adhocSettings) {
      adhocSettings = await prisma.adhoc_settings.create({
        data: {
          user_id: session.user.id,
          daily_amount: 40.0,
        },
        include: {
          users: true, // Include user data if needed
        },
      });
    }

    return NextResponse.json(adhocSettings);
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
    const body = adhocSettingsSchema.parse(await req.json());

    const adhocSettings = await prisma.adhoc_settings.upsert({
      where: {
        user_id: session.user.id,
      },
      update: {
        daily_amount: body.daily_amount,
        updated_at: new Date(),
      },
      create: {
        user_id: session.user.id,
        daily_amount: body.daily_amount,
      },
      include: {
        users: true, // Include user data if needed
      },
    });

    return NextResponse.json(adhocSettings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid input", errors: error.issues }),
        { status: 400 }
      );
    }

    console.error("Failed to update adhoc settings:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
