// /src/app/api/holograph/users/route.ts

export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { debugLog } from "@/utils/debug";
import { withCors, getCorsHeaders } from "@/utils/withCORS";


export const GET = withCors(async (req: NextRequest) => {
  const session = await getServerSession(await getAuthOptions());
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const holographId = searchParams.get("holographId");

  if (!holographId) {
    return NextResponse.json({ error: "Missing holographId" }, { status: 400 });
  }

  try {
    const userId = session.user.id;

    // 🔐 Check if user is a Principal or Delegate
    const principal = await prisma.holographPrincipal.findFirst({
      where: { holographId, userId },
    });

    const delegate = await prisma.holographDelegate.findFirst({
      where: { holographId, userId },
    });

    if (!principal && !delegate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ✅ User is authorized — fetch users
    const principals = await prisma.holographPrincipal.findMany({
      where: { holographId },
      select: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    const delegates = await prisma.holographDelegate.findMany({
      where: { holographId },
      select: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    const formattedUsers = [
      ...principals.map((entry) => ({
        id: entry.user.id,
        firstName: entry.user.firstName,
        lastName: entry.user.lastName,
        email: entry.user.email,
        role: "Principal",
      })),
      ...delegates.map((entry) => ({
        id: entry.user.id,
        firstName: entry.user.firstName,
        lastName: entry.user.lastName,
        email: entry.user.email,
        role: "Delegate",
      })),
    ];

    return NextResponse.json(formattedUsers);
  } catch (error) {
    console.error("❌ Error fetching users:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});

export function OPTIONS(request: Request) {
  const origin = request.headers.get("origin") || "";
  const headers = getCorsHeaders(origin);
  const res = new Response(null, { status: 204 });
  for (const [key, value] of Object.entries(headers)) {
    res.headers.set(key, value);
  }
  return res;
}

