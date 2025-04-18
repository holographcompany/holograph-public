// /src/app/api/holograph/delegates/route.ts - GET function

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from '../../../../lib/auth';
import { prisma } from '@/lib/db';
import { debugLog } from '@/utils/debug';
import { withCors, getCorsHeaders } from '@/utils/withCORS';


export const GET = withCors(async (request: NextRequest) => {

  try {
    debugLog("🔍 API Route: Getting holographs where user is a delegate");
    
    // Get authenticated user from session
    const session = await getServerSession(await getAuthOptions());
    
    if (!session || !session.user || !session.user.id) {
      debugLog("❌ No authenticated user found in session");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    debugLog("✅ User ID from session:", userId);

    // ✅ Fetch Delegated Holographs with assigned date (`assignedAt`) and Principals and Delegates
    const delegatedHolographs = await prisma.holographDelegate.findMany({
      where: { userId },
      select: {
        assignedAt: true,
        holograph: {
          select: {
            id: true,
            title: true,
            geography: true,
            updatedAt: true,
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            },
            principals: {
              select: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            },
            delegates: {
              select: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    


    // Transform response to include the owner's userId
    // ✅ Format the response correctly
    const formattedHolographs = delegatedHolographs.map(dh => {
      const holo = dh.holograph;
      
      return {
        id: holo.id,
        title: holo.title,
        geography: holo.geography ?? "Not specified",
        updatedAt: holo.updatedAt,
        assignedAt: dh.assignedAt.toISOString(),
        owner: holo.owner || null,
        principals: holo.principals.map(p => p.user),
        delegates: holo.delegates.map(d => d.user),
      };
    });
    

    debugLog("✅ Returning", formattedHolographs.length, "delegated holographs");
    return NextResponse.json(formattedHolographs);
  } catch (error) {
    console.error('Error fetching delegated holographs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch delegated holographs' },
      { status: 500 }
    );
  }
});

export const POST = withCors(async (request: NextRequest) => {
  try {
    // Get authenticated user from session
    const session = await getServerSession(await getAuthOptions());
    
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const authenticatedUserId = session.user.id;
    
    const { holographId, delegateId } = await request.json();

    // Validate input
    if (!holographId || !delegateId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify that the authenticated user is a principal
    const isPrincipal = await prisma.holographPrincipal.findUnique({
      where: {
        holographId_userId: {
          holographId,
          userId: authenticatedUserId,
        },
      },
    });

    if (!isPrincipal) {
      return NextResponse.json(
        { error: 'Not authorized to add delegates' },
        { status: 403 }
      );
    }

    // Check if user is already a delegate
    const existingDelegate = await prisma.holographDelegate.findUnique({
      where: {
        holographId_userId: {
          holographId,
          userId: delegateId,
        },
      },
    });

    if (existingDelegate) {
      return NextResponse.json(
        { error: 'User is already a delegate' },
        { status: 400 }
      );
    }

    // Add new delegate
    const result = await prisma.holographDelegate.create({
      data: {
        holographId,
        userId: delegateId,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error adding delegate:', error);
    return NextResponse.json(
      { error: 'Failed to add delegate' },
      { status: 500 }
    );
  }
});

export const DELETE = withCors(async (request: NextRequest) => {
  try {
    // Get authenticated user from session
    const session = await getServerSession(await getAuthOptions());
    
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const authenticatedUserId = session.user.id;
    
    const { searchParams } = new URL(request.url);
    const holographId = searchParams.get('holographId');
    const delegateId = searchParams.get('delegateId');

    if (!holographId || !delegateId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify that the authenticated user is a principal
    const isPrincipal = await prisma.holographPrincipal.findUnique({
      where: {
        holographId_userId: {
          holographId,
          userId: authenticatedUserId,
        },
      },
    });

    if (!isPrincipal) {
      return NextResponse.json(
        { error: 'Not authorized to remove delegates' },
        { status: 403 }
      );
    }

    // ✅ Delete delegate's permissions
    await prisma.delegatePermissions.deleteMany({
      where: {
        holographId,
        delegateId,
      },
    });

    // ✅ Delete delegate's invitations for this holograph
    await prisma.invitation.deleteMany({
      where: {
        holographId,
        inviteeId: delegateId,
      },
    });


    // ✅ Remove delegate from HolographDelegate
    await prisma.holographDelegate.delete({
      where: {
        holographId_userId: {
          holographId,
          userId: delegateId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing delegate:', error);
    return NextResponse.json(
      { error: 'Failed to remove delegate' },
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
