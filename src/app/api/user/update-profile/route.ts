//  /src/app/api/user/update-profile/route.ts

export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import validator from 'validator';
import { debugLog } from "@/utils/debug";
import { userProfileSchema } from "@/validators/userProfileSchema";
import { ZodError } from "zod";

export async function POST(req: Request) {
  const session = await getServerSession(await getAuthOptions());

  if (!session || !session.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();

    // ✅ Zod Validation
    const validated = userProfileSchema.parse(body);

    // ✅ Check if new email is already used by someone else
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser && existingUser.id !== session.user.id) {
      return NextResponse.json({ error: "Email is already in use" }, { status: 400 });
    }

    // ✅ Update user info
    await prisma.user.update({
      where: { id: session.user.id },
      data: validated,
    });

    return NextResponse.json({ message: "Profile updated successfully" });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ errors: error.errors }, { status: 400 });
    }

    console.error("❌ Error updating profile:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
