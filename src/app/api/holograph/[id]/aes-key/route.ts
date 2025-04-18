// /src/app/api/holograph/[id]/aes-key/route.ts

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { getHolographFileEncryptionKey } from "@/utils/encryption";
import { prisma } from "@/lib/db";
import { withCors, getCorsHeaders } from "@/utils/withCORS";


export const GET = withCors(async (req, context) => {
  const session = await getServerSession(await getAuthOptions());
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const holographId = context.params.id;

  // 🔐 Check user is authorized (Owner, Principal, or Delegate)
  const holograph = await prisma.holograph.findUnique({
    where: { id: holographId },
    select: {
      ownerId: true,
      principals: { select: { userId: true } },
      delegates: { select: { userId: true } },
    },
  });

  if (
    !holograph ||
    (userId !== holograph.ownerId &&
      !holograph.principals.some((p) => p.userId === userId) &&
      !holograph.delegates.some((d) => d.userId === userId))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const aesKeyBuffer = await getHolographFileEncryptionKey(holographId);
    return new NextResponse(aesKeyBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("❌ Failed to load AES key:", err);
    return NextResponse.json({ error: "Failed to fetch AES key" }, { status: 500 });
  }
});
