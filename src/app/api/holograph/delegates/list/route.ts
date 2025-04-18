// /src/app/api/holograph/delegates/list/route.ts

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { debugLog } from "@/utils/debug";
import { withCors, getCorsHeaders } from '@/utils/withCORS';

export const GET = withCors(async (request: NextRequest) => {
  const session = await getServerSession(await getAuthOptions());
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(request.url);
  const holographId = searchParams.get("holographId");

  if (!holographId) {
    return NextResponse.json({ error: "Missing holographId" }, { status: 400 });
  }

  try {
    // ✅ Fetch Holograph with principals and delegates
    const holograph = await prisma.holograph.findUnique({
      where: { id: holographId },
      include: {
        principals: true,
        delegates: true,
      },
    });

    if (!holograph) {
      return NextResponse.json({ error: "Holograph not found" }, { status: 404 });
    }

    const isAuthorizedPrincipal = holograph.principals.some(p => p.userId === userId);
    const isAuthorizedDelegate = holograph.delegates.some(d => d.userId === userId);

    if (!isAuthorizedPrincipal && !isAuthorizedDelegate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ✅ User is authorized — fetch delegates with user info
    const delegates = await prisma.holographDelegate.findMany({
      where: { holographId },
      include: {
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

    const formatted = delegates.map((d) => ({
      id: d.user.id,
      firstName: d.user.firstName || "Unknown First Name",
      lastName: d.user.lastName || "Unknown Last Name",
      email: d.user.email,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("❌ Error fetching delegates:", error);
    return NextResponse.json({ error: "Failed to fetch delegates" }, { status: 500 });
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
