// src/app/api/holograph/[id]/route.ts
// GET, PUT and DELETE functions 

export const dynamic = "force-dynamic";

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { debugLog } from '@/utils/debug';
import { deleteFileFromGCS } from "@/lib/gcs"; // Import Google Cloud Storage delete function
import { bucket } from "@/lib/gcs";
import { holographSchema } from "@/validators/holographSchema";
import { ZodError } from "zod"; // ✅ For safe error handling
import { withCors, getCorsHeaders } from '@/utils/withCORS';


export const GET = withCors(async (request, context) => {
  try {
    // Get session using NextAuth
    const session = await getServerSession(await getAuthOptions());
    if (!session || !session.user) {
      console.error("❌ No authenticated session found");
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = session.user.id;

    // Keep existing URL params logic for backward compatibility
    const { searchParams } = new URL(request.url);
    const queryUserId = searchParams.get('userId');

    // Log both session user and query user if different
    if (queryUserId && queryUserId !== userId) {
      debugLog(`⚠️ Note: Query userId (${queryUserId}) differs from session userId (${userId}). Using session userId.`);
    }

    // ✅ Await params before using it
    const { id: holographId } = await context.params;

    debugLog(`🔍 Fetching Holograph ${holographId} for user ${userId}`);

    // ✅ Fetch the Owner
    const holograph = await prisma.holograph.findUnique({
      where: { id: holographId },
      select: {
        id: true,
        title: true,
        geography: true,
        createdAt: true,
        updatedAt: true,
        ownerId: true,  
        owner: {
          select: { id: true, firstName: true, lastName: true },
        },
        principals: {
          select: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
        delegates: {
          select: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });

    if (!holograph) {
      console.error(`❌ Holograph ${holographId} not found`);
      return NextResponse.json({ error: "Holograph not found" }, { status: 404 });
    }

    debugLog(`✅ Found Holograph: ${holograph.title}`)
    debugLog(`👤 Owner Found: ${holograph.owner ? `${holograph.owner.firstName} ${holograph.owner.lastName}` : "Unknown User"}`);

    // ✅ Check if the user is authorized (Principals and Delegates)
    const isPrincipal = holograph.principals.some(p => p.user.id === userId);
    const isDelegate = holograph.delegates.some(d => d.user.id === userId);

    if (isPrincipal || isDelegate) {
      debugLog(`✅ User ${userId} is authorized to view full Holograph ${holographId}`);
      return NextResponse.json({
        id: holograph.id,
        title: holograph.title,
        geography: holograph.geography,
        createdAt: holograph.createdAt.toISOString(),
        updatedAt: holograph.updatedAt.toISOString(),
        ownerId: holograph.ownerId,
        owner: holograph.owner
          ? {
              id: holograph.owner.id,
              firstName: holograph.owner.firstName,
              lastName: holograph.owner.lastName,
            }
          : null,
        principals: holograph.principals.map(p => ({
          id: p.user.id,
          firstName: p.user.firstName,
          lastName: p.user.lastName,
        })),
        delegates: holograph.delegates.map(d => ({
          id: d.user.id,
          firstName: d.user.firstName,
          lastName: d.user.lastName,
        })),
      });
    }

    // 🚨 If user is not a Principal or Delegate, check for an invitation
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      console.error(`❌ User ${userId} not found in database`);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    debugLog(`🔍 Checking invitation for ${user.email} to Holograph ${holographId}`);

    const invitation = await prisma.invitation.findFirst({
      where: {
        holographId: holographId,
        inviteeEmail: user.email,
        status: "Pending",
      },
    });

    if (invitation) {
      debugLog(`🔹 User ${userId} has an invitation to Holograph ${holographId}. Returning limited data.`);
      return NextResponse.json({
        id: holograph.id,
        title: holograph.title, // Only return the title if invited
        owner: holograph.owner
          ? {
              id: holograph.owner.id,
              name: `${holograph.owner.firstName} ${holograph.owner.lastName}`,
            }
          : { id: "unknown", name: "Unknown User" },
      });
    }

    console.error(`❌ Unauthorized access: User ${userId} is not a Principal, Delegate, or Invitee`);
    return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });

  } catch (error) {
    console.error("❌ API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

// for editing a Holograph Name
export const PUT = withCors(async (req, context) => {
  const session = await getServerSession(await getAuthOptions());
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

  try {
    const userId = session.user.id;

    const { id } = context.params;
    // 🔐 Authorization: Only Principals can edit the Holograph
    const isPrincipal = await prisma.holographPrincipal.findFirst({
      where: { holographId: id, userId },
    });
    if (!isPrincipal) {
      return NextResponse.json({ error: 'Forbidden — only Principals can edit this Holograph' }, { status: 403 });
    }
    
    // ✅ Extract formData
    const formData = await req.formData();
    const title = formData.get("title") as string;
    const geography = formData.get("geography") as string;

    // ✅ Validate using Zod schema
    try {
      holographSchema.parse({ title, geography });
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json({ errors: err.errors }, { status: 400 });
      }
      throw err;
    }

    // ✅ Update in database
    const updatedHolograph = await prisma.holograph.update({
      where: { id },
      data: { title, geography },
    });

    return NextResponse.json(updatedHolograph, { status: 200 });

  } catch (error) {
    console.error("❌ Failed to update Holograph:", error);
    return NextResponse.json({ error: "Failed to update Holograph" }, { status: 500 });
  }
});

export const DELETE = withCors(async (req, context) => {
  try {

    const session = await getServerSession(await getAuthOptions());
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = context.params;
    const userId = session.user.id;

    debugLog(`🔍 User ${userId} attempting to delete Holograph with ID: ${id}`);

    // 🔐 Fetch Holograph Owner and cert paths
    const holograph = await prisma.holograph.findUnique({
      where: { id },
      select: { ownerId: true, sslCertPath: true, sslKeyPath: true },
    });

    if (!holograph) {
      return NextResponse.json({ error: "Holograph not found" }, { status: 404 });
    }

    // 🔐 Verify Owner
    if (holograph.ownerId !== userId) {
      return NextResponse.json({ error: 'Forbidden — only the Owner can delete this Holograph' }, { status: 403 });
    }

    // ✅ Step 1: Delete related Sections from `HolographSection`
    debugLog("🗑 Deleting related sections in HolographSection...");
    await prisma.holographSection.deleteMany({ where: { holographId: id } });

    // ✅ Step 2: Delete SSL certificate and AES key folder from GCS
    try {
      const sslFolderPrefix = `ssl-keys/${id}/current/`;
      debugLog(`🗑 Deleting all SSL/AES files under GCS path: ${sslFolderPrefix}`);

      const [sslFiles] = await bucket.getFiles({ prefix: sslFolderPrefix });

      if (sslFiles.length === 0) {
        debugLog(`⚠️ No files found under ${sslFolderPrefix}`);
      }

      for (const file of sslFiles) {
        try {
          debugLog(`🗑 Deleting file: ${file.name}`);
          await file.delete();
        } catch (err) {
          console.error(`❌ Error deleting file ${file.name}:`, err);
        }
      }
    } catch (err) {
      console.error("❌ Failed to fetch/delete SSL/AES key files from GCS:", err);
    }


    /*************************************************** 
    *
    DELETE EACH SECTION BEFORE DELETING THE HOLOGRAPH
    *
    * **************************************************/

    // 
    // ****************** VITAL DOCUMENTS ********************
    // ✅ 1 Fetch all related vital documents before deleting the Holograph
    const relatedDocuments = await prisma.vitalDocument.findMany({
      where: { holographId: id },
    });


    // ✅ 2 Delete related documents from Google Cloud Storage
    for (const doc of relatedDocuments) {
      debugLog(`🗑 Deleting file from GCS: ${doc.filePath}`);
      await deleteFileFromGCS(doc.filePath);
    }

    // ✅ 3 Delete all related database records
    debugLog("🗑 Deleting related vital documents...");
    await prisma.vitalDocument.deleteMany({ where: { holographId: id } });


    // ****************** FINANCIAL ACCOUNTS ********************
    // ✅ 1 Fetch all related financial account documents before deleting the Holograph
    const relatedFinancialAccounts = await prisma.financialAccount.findMany({
      where: { holographId: id },
    });


    // ✅ 2 Delete related financial account documents from Google Cloud Storage
    for (const doc of relatedFinancialAccounts) {
      debugLog(`🗑 Deleting file from GCS: ${doc.filePath}`);
      if (doc.filePath){
        await deleteFileFromGCS(doc.filePath);
      }
    }

    // ✅ 3 Delete all related database records
    debugLog("🗑 Deleting related financial account records...");
    await prisma.financialAccount.deleteMany({ where: { holographId: id } });

    //******************************************************************* */

    // ****************** Insurance ACCOUNTS ********************
    // ✅ 1 Fetch all related insurance account documents before deleting the Holograph
    const relatedInsuranceAccounts = await prisma.insuranceAccount.findMany({
      where: { holographId: id },
    });


    // ✅ 2 Delete related insurance account documents from Google Cloud Storage
    for (const doc of relatedInsuranceAccounts) {
      debugLog(`🗑 Deleting file from GCS: ${doc.filePath}`);
      if (doc.filePath){
        await deleteFileFromGCS(doc.filePath);
      }
    }

    // ✅ 3 Delete all related database records
    debugLog("🗑 Deleting related insurance account records...");
    await prisma.insuranceAccount.deleteMany({ where: { holographId: id } });

    //******************************************************************* */

    // **************************** PROPERTIES ******************************
    // ✅ 1 Fetch all related property account documents before deleting the Holograph
    const relatedProperties = await prisma.property.findMany({
      where: { holographId: id },
    });


    // ✅ 2 Delete related property documents from Google Cloud Storage
    for (const doc of relatedProperties) {
      debugLog(`🗑 Deleting file from GCS: ${doc.filePath}`);
      if (doc.filePath){
        await deleteFileFromGCS(doc.filePath);
      }
    }

    // ✅ 3 Delete all related database records
    debugLog("🗑 Deleting related property records...");
    await prisma.property.deleteMany({ where: { holographId: id } });

    //******************************************************************* */

    // **************************** PERSONAL PROPERTIES ******************************
    // ✅ 1 Fetch all related personal property account documents before deleting the Holograph
    const relatedPersonalProperties = await prisma.personalProperty.findMany({
      where: { holographId: id },
    });


    // ✅ 2 Delete related personal property documents from Google Cloud Storage
    for (const doc of relatedPersonalProperties) {
      debugLog(`🗑 Deleting file from GCS: ${doc.filePath}`);
      if (doc.filePath){
        await deleteFileFromGCS(doc.filePath);
      }
    }

    // ✅ 3 Delete all related database records
    debugLog("🗑 Deleting related personal property records...");
    await prisma.personalProperty.deleteMany({ where: { holographId: id } });

    //******************************************************************* */

    // **************************** UTILITIES ******************************
    // ✅ 1 Fetch all related utility account documents before deleting the Holograph
    const relatedUtilities = await prisma.utility.findMany({
      where: { holographId: id },
    });


    // ✅ 2 Delete related utility documents from Google Cloud Storage
    for (const doc of relatedUtilities) {
      debugLog(`🗑 Deleting file from GCS: ${doc.filePath}`);
      if (doc.filePath){
        await deleteFileFromGCS(doc.filePath);
      }
    }

    // ✅ 3 Delete all related database records
    debugLog("🗑 Deleting related utility records...");
    await prisma.utility.deleteMany({ where: { holographId: id } });

    //******************************************************************* */

    // **************************** HOME SERVICES ******************************
    // ✅ 1 Fetch all related Home Service account documents before deleting the Holograph
    const relatedHomeServices = await prisma.homeService.findMany({
      where: { holographId: id },
    });


    // ✅ 2 Delete related Home Service documents from Google Cloud Storage
    for (const doc of relatedHomeServices) {
      debugLog(`🗑 Deleting file from GCS: ${doc.filePath}`);
      if (doc.filePath){
        await deleteFileFromGCS(doc.filePath);
      }
    }

    // ✅ 3 Delete all related database records
    debugLog("🗑 Deleting related home service records...");
    await prisma.homeService.deleteMany({ where: { holographId: id } });

    //******************************************************************* */


    // ✅ Step 4: Delete related Principals and Delegates
    debugLog("🗑 Deleting related Principal and Delegate records...");
    await prisma.holographDelegate.deleteMany({ where: { holographId: id } });
    await prisma.holographPrincipal.deleteMany({ where: { holographId: id } });
    await prisma.invitation.deleteMany({ where: { holographId: id } });

    // ✅ Step 5: Delete OwnershipAuditLog entries
    debugLog("🗑 Deleting OwnershipAuditLog entries...");
    await prisma.ownershipAuditLog.deleteMany({ where: { holographId: id } });


    // ✅ Step 6: Finally delete the Holograph
    debugLog("🗑 Deleting the Holograph record...");
    await prisma.holograph.delete({ where: { id } });

    debugLog("✅ Holograph deleted successfully.");

    return NextResponse.json({ message: "Holograph deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting Holograph:", error);
    return NextResponse.json({ error: "Failed to delete Holograph" }, { status: 500 });
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

