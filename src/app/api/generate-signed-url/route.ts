// /src/app/api/generate-signed-url/route.ts

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
//import { Storage } from "@google-cloud/storage";
import { bucket } from "@/lib/gcs";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { cookies } from "next/headers";
import jwt, { JwtPayload } from "jsonwebtoken";
import { prisma } from "@/lib/db"; // ✅ Import Prisma to check permissions
import { getDocumentBySection } from "@/utils/getDocumentBySection";
import { debugLog } from "@/utils/debug";

/*
const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET_NAME;
if (!BUCKET_NAME) {
  throw new Error("❌ GCS_BUCKET_NAME is not set in environment variables");
}
const bucket = storage.bucket(BUCKET_NAME);
*/

export async function GET(req: NextRequest) {
  try {
    debugLog("🔍 Checking user session...");

    // ✅ Retrieve cookies properly
    const cookieStore = cookies();
    const authToken = await cookieStore.get("auth-token");
    debugLog("🟢 Retrieved Cookies: ", authToken);

    // ✅ Authenticate user with NextAuth
    const authOptions = await getAuthOptions(); // ⬅️ get the resolved options
    let session = await getServerSession(authOptions); // ⬅️ now you can pass it
    debugLog("✅ Retrieved session:", session);

    // 🔴 If no session, attempt manual JWT verification
    if (!session || !session.user) {
      console.warn("⚠️ No valid session from NextAuth. Attempting manual JWT verification...");

      if (!authToken) {
        console.error("❌ No auth token found in cookies");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      try {
        const decodedToken = jwt.verify(authToken.value, process.env.NEXTAUTH_SECRET!) as JwtPayload;
        session = {
          user: {
            id: decodedToken.id as string,
            email: decodedToken.email as string,
          },
          expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };
      } catch (error) {
        console.error("❌ JWT Verification Failed:", error);
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
    }

    debugLog(`🟢 User ${session.user.email} requested a signed URL`);

    // ✅ Extract filePath and holographId from query parameters
    const { searchParams } = new URL(req.url);
    let filePath = searchParams.get("filePath");
    const holographId = searchParams.get("holographId");

    if (!filePath || !holographId) {
      console.error("❌ Missing filePath or holographId in request.");
      return NextResponse.json({ error: "Missing filePath or holographId" }, { status: 400 });
    }

    // ✅ Ensure filePath is stored correctly in DB
    //if (filePath.startsWith("https://storage.googleapis.com/holograph-user-documents/")) {
    //  filePath = filePath.replace("https://storage.googleapis.com/holograph-user-documents/", "");
    //}

    const publicPrefix = `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/`;

    if (filePath.startsWith(publicPrefix)) {
      filePath = filePath.replace(publicPrefix, "");
    }

    debugLog("🟢 Corrected filePath for DB lookup:", filePath);

    // ✅ Verify user has access to the document
    const section = searchParams.get("section") || "vital-documents";
    let document: any;
    try {
      document = await getDocumentBySection(section, holographId, filePath);
    } catch (err) {
      return NextResponse.json({ error: err.message || "Unsupported section" }, { status: 400 });
    }

    if (!document) {
      console.error("❌ Document not found for filePath:", filePath);
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    debugLog("✅ Document found:", document);

    const userId = session.user.id;
    const isOwner = document.uploadedBy === userId;
    const isAuthorizedPrincipal = document.holograph.principals.some((p) => p.userId === userId);
    const isAuthorizedDelegate = document.holograph.delegates.some((d) => d.userId === userId);

    if (!(isOwner || isAuthorizedPrincipal || isAuthorizedDelegate)) {
      console.error(`❌ Unauthorized: User ${userId} is not allowed to access this document.`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    debugLog("✅ User authorized to access this document.");

    // ✅ Generate the Signed URL
    debugLog("🟢 Generating signed URL for:", filePath);
    const file = bucket.file(filePath);

    try {
      const [signedUrl] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 10 * 60 * 1000, // URL valid for 10 minutes
      });

      debugLog("✅ Signed URL generated:", signedUrl);
      return NextResponse.json({ url: signedUrl });
    } catch (error) {
      console.error("❌ Error generating signed URL:", error);
      return NextResponse.json({ error: "Failed to generate signed URL" }, { status: 500 });
    }
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

