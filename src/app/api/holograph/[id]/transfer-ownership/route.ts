// /src/app/api/holograph/[id]/transfer-ownership/route.ts

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { debugLog } from "@/utils/debug";
import { z, ZodError } from "zod";
import { transferOwnershipSchema } from "@/validators/transferOwnershipSchema";
import Tokens from "csrf";
import { withCors, getCorsHeaders } from "@/utils/withCORS";


export const POST = withCors(async (req, context) => {


  const session = await getServerSession(await getAuthOptions());

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const holographId = context.params.id;

  // ✅ CSRF check
  const tokens = new Tokens();
  const csrfToken = req.headers.get("x-csrf-token");
  const csrfSecret = req.cookies.get("csrfSecret")?.value;

  if (!csrfToken || !csrfSecret || !tokens.verify(csrfSecret, csrfToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  // ✅ Parse and validate body using Zod
  let newOwnerId: string;
  try {
    const body = await req.json();
    const parsed = transferOwnershipSchema.parse(body);
    newOwnerId = parsed.newOwnerId;
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ errors: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

/*
  if (!newOwnerId) {
    return NextResponse.json({ error: "Missing newOwnerId" }, { status: 400 });
  }
*/ // temporarily comment out until we're sure it works

  try {
    // Fetch the Holograph and verify ownership
    const holograph = await prisma.holograph.findUnique({
      where: { id: holographId },
      select: { ownerId: true },
    });

    if (!holograph) {
      return NextResponse.json({ error: "Holograph not found" }, { status: 404 });
    }

    if (holograph.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Only the current owner can transfer ownership." }, { status: 403 });
    }

    // Update ownerId in Holograph
    await prisma.holograph.update({
      where: { id: holographId },
      data: { ownerId: newOwnerId },
    });

    // Add to OwnershipAuditLog
    await prisma.ownershipAuditLog.create({
      data: {
        holographId,
        oldOwnerId: holograph.ownerId,
        currentOwnerId: newOwnerId,
      },
    });

    return NextResponse.json({ message: "Ownership transferred successfully." });
  } catch (error) {
    console.error("Error in transfer-ownership:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
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

