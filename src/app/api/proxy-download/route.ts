// /src/app/api/proxy-download/route.ts

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decryptBuffer } from "@/lib/encryption/crypto";
import { getFileFromGCS } from "@/lib/gcs";
import { debugLog } from "@/utils/debug";

export async function GET(req: NextRequest) {
  const session = await getServerSession(await getAuthOptions());
  const userId = session?.user?.id;

  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get("filePath");
  const holographId = searchParams.get("holographId");
  const filename = searchParams.get("filename") || "downloaded_file";

  if (!userId || !filePath || !holographId) {
    return new Response("Missing or invalid parameters", { status: 400 });
  }

  // 🔐 Check that the user has access to this Holograph
  const holograph = await prisma.holograph.findUnique({
    where: { id: holographId },
    select: {
      principals: { select: { userId: true } },
      delegates: { select: { userId: true } },
    },
  });

  if (!holograph) return new Response("Holograph not found", { status: 404 });

  const isPrincipal = holograph.principals.some((p) => p.userId === userId);
  const isDelegate = holograph.delegates.some((d) => d.userId === userId);

  if (!isPrincipal && !isDelegate) {
    return new Response("Unauthorized", { status: 403 });
  }

  try {
    const encryptedBuffer = await getFileFromGCS(filePath);
    const decryptedBuffer = await decryptBuffer(encryptedBuffer, holographId);

    return new Response(decryptedBuffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("❌ Download error:", err);
    return new Response("Error retrieving file", { status: 500 });
  }
}
