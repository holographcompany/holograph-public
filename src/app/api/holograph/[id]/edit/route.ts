// /src/app/api/holograph/[id]/edit/route.ts
// PATCH function

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { debugLog } from "@/utils/debug";
import { holographSchema } from "@/validators/holographSchema";
import { ZodError } from "zod";
import { withCors, getCorsHeaders } from "@/utils/withCORS";


export const PATCH = withCors(async (req, context) => {
  const session = await getServerSession(await getAuthOptions());
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const holographId = context.params.id;
  const userId = session.user.id;

  try {
    const formData = await req.formData();
    const title = formData.get("title") as string;
    const geography = formData.get("geography") as string;

    debugLog("📌 Editing Holograph:", holographId);
    debugLog("📝 New Title:", title);
    debugLog("🌍 New Geography:", geography);

    // ✅ Validate input with Zod
    try {
      holographSchema.parse({ title, geography });
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json({ errors: err.errors }, { status: 400 });
      }
      throw err;
    }

    // ✅ Update the Holograph
    const updated = await prisma.holograph.update({
      where: { id: holographId },
      data: {
        title,
        geography,
        updatedAt: new Date(),
        // updatedBy: userId, // 🔒 Future: track editor
      },
    });

    return NextResponse.json({
      id: updated.id,
      title: updated.title,
      geography: updated.geography,
      lastModified: updated.updatedAt.toISOString(),
    });

  } catch (error: any) {
    console.error("❌ Error updating Holograph:", error);
    return NextResponse.json(
      { error: "Failed to update Holograph" },
      { status: 500 }
    );
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
