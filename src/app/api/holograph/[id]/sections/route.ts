// /src/app/api/holograph/[id]/sections/route.ts

export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { debugLog } from "@/utils/debug";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { withCors, getCorsHeaders } from "@/utils/withCORS";

export const GET = withCors(async (req: NextRequest, context: { params: { id: string } }) => {
  const holographId = context.params.id;
  // ✅ 1. Authenticate user
  const session = await getServerSession(await getAuthOptions());
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // ✅ 2. Verify user access to this Holograph
  const holograph = await prisma.holograph.findUnique({
    where: { id: holographId },
    select: {
      principals: { select: { userId: true } },
      delegates: { select: { userId: true } },
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

  debugLog("📢 API called with holographId:", holographId);

  if (!holographId) {
    console.log("❌ Missing holograph ID");
    return NextResponse.json({ error: "Holograph ID is required" }, { status: 400 });
  }

  try {
    debugLog("🔍 Fetching sections linked to Holograph ID:", holographId);

    const holographSections = await prisma.holographSection.findMany({
      where: { holographId },
      include: { section: true },
    });

    if (!holographSections.length) {
      console.log("❌ No sections found for Holograph ID:", holographId);
      return NextResponse.json({ error: "No sections found for this Holograph" }, { status: 404 });
    }

    return NextResponse.json(holographSections.map(s => ({
      sectionId: s.id,
      id: s.section.id,
      name: s.section.name,
      slug: s.section.slug,
      description: s.section.description,
      iconSlug: s.section.iconSlug,
    })));
  } catch (error) {
    console.error("❌ Server Error fetching sections:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
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