// /src/app/api/holograph/principal-removal-requests/route.ts

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getAuthOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { debugLog } from '@/utils/debug'
import { withCors, getCorsHeaders } from '@/utils/withCORS';

export const GET = withCors(async (request: NextRequest) => {
  const session = await getServerSession(await getAuthOptions());
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const pendingRequests = await prisma.pendingPrincipalRemoval.findMany({
      where: {
        targetUserId: userId,
        status: 'Pending',
      },
      include: {
        holograph: { select: { id: true, title: true } },
        requestedBy: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    // Format data for frontend use
    const formatted = pendingRequests.map((req) => ({
      id: req.id,
      holographId: req.holograph.id,
      holographTitle: req.holograph.title,
      requestedBy: {
        firstName: req.requestedBy.firstName,
        lastName: req.requestedBy.lastName,
        email: req.requestedBy.email,
      },
      createdAt: req.createdAt,
    }));

    return NextResponse.json(formatted, { status: 200 });
  } catch (error) {
    console.error('Error fetching removal requests:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
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
