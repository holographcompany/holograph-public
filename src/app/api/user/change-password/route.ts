// /src/app/api/user/change-password/route.ts

export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { debugLog } from "@/utils/debug";
import { changePasswordSchema } from "@/validators/changePasswordSchema";
import { ZodError } from "zod";

export async function POST(req: Request) {
  const session = await getServerSession(await getAuthOptions());

  if (!session || !session.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // ✅ Zod Validation
    const { currentPassword, newPassword } = changePasswordSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 403 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { email: user.email },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ message: "Password updated successfully" });
  } catch (error) {
    if (error instanceof ZodError) {
      const formatted = error.errors.map((e) => ({
        field: e.path[0],
        message: e.message,
      }));
      return NextResponse.json({ errors: formatted }, { status: 400 });
    }
    console.error("❌ Error changing password:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
