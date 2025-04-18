// /src/app/api/invitations/route.ts - send invitations.  see your invitations. 
// ** accept or decline invitations is in /src/app/api/invitations/[id]/route.ts 

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { debugLog } from '@/utils/debug';
import { withCors, getCorsHeaders } from '@/utils/withCORS';


// POST: Send an invitation
export const POST = withCors(async (request: NextRequest) => {
  try {
    debugLog("🚀 /api/invitations endpoint hit!"); 

    // make sure the person sending the invitation is the user logged in
    const session = await getServerSession(await getAuthOptions());
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    debugLog("📩 Raw API Request Data:", body);

    const { holographId, inviterId, inviteeEmail, role } = body;
    debugLog("📩 Parsed API Request Data:", { holographId, inviterId, inviteeEmail, role });

    // 🔐 Validate inviterId matches session user
    if (inviterId !== session.user.id) {
      console.error("❌ inviterId mismatch with logged-in user");
      return NextResponse.json({ error: 'Forbidden — inviterId mismatch' }, { status: 403 });
    }

    // ✅ Validate required fields
    if (!holographId || !inviterId || !inviteeEmail || !role) {
      console.error("❌ Missing required fields");
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ✅ Ensure `holographId` exists
    const holograph = await prisma.holograph.findUnique({
      where: { id: holographId },
      select: { id: true },
    });

    if (!holograph) {
      console.error(`❌ Holograph with ID ${holographId} not found`);
      return NextResponse.json({ error: 'Holograph not found' }, { status: 404 });
    }

    // ✅ Ensure `inviterId` exists
    const inviter = await prisma.user.findUnique({
      where: { id: inviterId },
      select: { id: true },
    });

    if (!inviter) {
      console.error(`❌ User with ID ${inviterId} (Inviter) not found`);
      return NextResponse.json({ error: 'Inviter not found' }, { status: 404 });
    }

    // ✅ Ensure `inviteeEmail` exists
    const invitee = await prisma.user.findUnique({
      where: { email: inviteeEmail },
      select: { id: true, email: true },
    });

    if (!invitee) {
      console.error(`❌ User with email ${inviteeEmail} not found`);
      return NextResponse.json({ error: 'User not found, please try again' }, { status: 404 });
    }

    // ✅ Check if the user is already a Delegate for this Holograph
    const existingDelegate = await prisma.holographDelegate.findFirst({
      where: { holographId, userId: invitee.id },
    });

    // ✅ Check if the user is already a Principal for this Holograph
    const existingPrincipal = await prisma.holographPrincipal.findFirst({
      where: { holographId, userId: invitee.id },
    });

    // 🚨 Enforce the Business Rule 🚨
    // ❌ Case 1: User is ALREADY a Delegate and being invited AGAIN as a Delegate
    if (existingDelegate && role === "Delegate") {
      console.error(`❌ User ${inviteeEmail} is already a Delegate for Holograph ${holographId}`);
      return NextResponse.json({ error: "This user is already a Delegate for this Holograph." }, { status: 400 });
    }

    // ❌ Case 2: User is ALREADY a Principal and being invited AGAIN as a Principal
    if (existingPrincipal && role === "Principal") {
      console.error(`❌ User ${inviteeEmail} is already a Principal for Holograph ${holographId}`);
      return NextResponse.json({ error: "This user is already a Principal for this Holograph." }, { status: 400 });
    }

    // ❌ Case 3: User is ALREADY a Delegate and is being invited as a Principal
    if (existingDelegate && role === "Principal") {
      console.error(`❌ User ${inviteeEmail} is already a Delegate and cannot be assigned as a Principal for Holograph ${holographId}`);
      return NextResponse.json({ error: "This user is already a Delegate and cannot be assigned as a Principal." }, { status: 400 });
    }

    // ❌ Case 4: User is ALREADY a Principal and is being invited as a Delegate
    if (existingPrincipal && role === "Delegate") {
      console.error(`❌ User ${inviteeEmail} is already a Principal and cannot be assigned as a Delegate for Holograph ${holographId}`);
      return NextResponse.json({ error: "This user is already a Principal and cannot be assigned as a Delegate." }, { status: 400 });
    }

    // ✅ Check if there is already a pending invitation for this user in this Holograph
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        holographId,
        inviteeId: invitee.id,
        status: "Pending",
      },
    });
    

    // ❌ Case 5: there is already a pending invitation for this user in this Holograph
    if (existingInvitation) {
      console.error(`❌ User ${inviteeEmail} already has a pending invitation for Holograph ${holographId}`);
      return NextResponse.json({ error: "This user already has a pending invitation for this Holograph." }, { status: 400 });
    }

    debugLog("✅ Final Data Before Prisma Query:", {
      holographId,
      inviterId,
      inviteeEmail,
      role,
    });

    // ✅ Ensure correct Prisma schema by explicitly connecting relations
    const invitationData = {
      holograph: { connect: { id: holographId } },
      inviter: { connect: { id: inviterId } },
      invitee: { connect: { id: invitee.id } }, // ✅ Add this
      role: role,
      status: "Pending",
    };
    

    debugLog("📩 Sending data to Prisma:", invitationData);

    // ✅ Create the invitation
    const invitation = await prisma.invitation.create({
      data: invitationData,
    });

    debugLog("✅ Invitation Created:", invitation);
    return NextResponse.json({ success: true, invitation });

  } catch (error: any) {
    console.error("❌ API Error in /api/invitations:", error);

    if (error.code) {
      console.error("🔍 Prisma Error Code:", error.code);
    }
    
    return NextResponse.json({ error: error.message || "Failed to send invitation" }, { status: 500 });
  }
})


// GET: Fetch invitations for a user
export const GET = withCors(async (request: Request) => {
  try {
    const session = await getServerSession(await getAuthOptions());
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // 🔐 Validate userId matches logged-in user
    if (userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden — userId mismatch' }, { status: 403 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      console.error(`❌ User with ID ${userId} not found`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const invitations = await prisma.invitation.findMany({
      where: { inviteeId: user.id },
      include: {
        holograph: { select: { title: true } },  // ✅ Get Holograph title
        inviter: { select: { firstName: true, lastName: true } }, // ✅ Get Inviter’s name
      },
    });   

    const formattedInvitations = invitations.map((invite) => ({
      id: invite.id,
      holographId: invite.holographId,
      role: invite.role,
      inviterId: invite.inviterId,
      status: invite.status,  // ✅ Add this line
      holographTitle: invite.holograph.title, // ✅ Include title
      inviterFirstName: invite.inviter.firstName, // ✅ Include names
      inviterLastName: invite.inviter.lastName,
    }));
    

    debugLog(`✅ Retrieved ${invitations.length} invitations for ${user.id}`);
    return NextResponse.json(formattedInvitations);
  } catch (error: any) {
    console.error("❌ Error fetching invitations:", error);
    return NextResponse.json({ error: error.message || 'Failed to fetch invitations' }, { status: 500 });
  }
})

export function OPTIONS(request: Request) {
  const origin = request.headers.get("origin") || "";
  const headers = getCorsHeaders(origin);
  const res = new Response(null, { status: 204 });

  for (const [key, value] of Object.entries(headers)) {
    res.headers.set(key, value);
  }

  return res;
}

