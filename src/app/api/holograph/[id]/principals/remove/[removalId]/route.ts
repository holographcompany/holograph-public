// /src/app/api/holograph/[id]/principals/remove/[removalId]/route.ts 
// sends a removal request to a principal who can accept (be removed) or decline (remain a Principal of the Holograph)

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getAuthOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { removePrincipal } from '@/utils/principalHelpers';
import { debugLog } from '@/utils/debug';
import { withCors, getCorsHeaders } from '@/utils/withCORS';

export const PATCH = withCors(async (req: NextRequest, context) => {
  const session = await getServerSession(await getAuthOptions());
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: holographId, removalId } = context.params;
  const userId = session.user.id;

  try {
    const { action } = await req.json(); // action: "accept" or "decline"

    if (!action || !["accept", "decline"].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Fetch removal request
    const removalRequest = await prisma.pendingPrincipalRemoval.findUnique({
      where: { id: removalId },
    });

    if (!removalRequest || removalRequest.holographId !== holographId) {
      return NextResponse.json({ error: 'Removal request not found' }, { status: 404 });
    }

    if (removalRequest.targetUserId !== userId) {
      return NextResponse.json({ error: 'You are not authorized to respond to this request' }, { status: 403 });
    }

    if (removalRequest.status !== "Pending") {
      return NextResponse.json({ error: 'This request has already been processed' }, { status: 400 });
    }

    if (action === "accept") {
      // ✅ Remove the Principal (includes invitation cleanup)
      const result = await removePrincipal(holographId, userId, userId);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      // ✅ Delete the pending removal request
      await prisma.pendingPrincipalRemoval.delete({
        where: { id: removalId },
      });

      return NextResponse.json({ message: 'You have been removed from the Holograph.' }, { status: 200 });
    }

    if (action === "decline") {
      // ✅ Delete request on decline
      await prisma.pendingPrincipalRemoval.delete({
        where: { id: removalId },
      });

      return NextResponse.json({ message: 'You have declined the removal request.' }, { status: 200 });
    }
  } catch (error) {
    console.error('Error processing removal request:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
  return NextResponse.json({ error: "Unexpected error occurred" }, { status: 500 });
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
