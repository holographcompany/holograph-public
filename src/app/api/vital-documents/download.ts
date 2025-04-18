// /src/app/api/vital-documents/download.ts
/*
import { NextRequest, NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";
import { getServerSession } from "next-auth"; // Ensure this is correctly configured
import { authOptions } from "@/lib/auth"; // Adjust path as needed
import { prisma } from "@/lib/db";
import { debugLog } from "../../../utils/debug";

const storage = new Storage({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME as string);

export async function GET(req: NextRequest) {
  try {
    // ✅ Step 1: Authenticate User
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ Step 2: Get filePath and holographId from query params
    const { searchParams } = new URL(req.url);
    const holographId = searchParams.get("holographId");
    const filePath = searchParams.get("filePath");
    

    // Validate that both parameters exist
    if (!holographId || !filePath) {
        return NextResponse.json({ error: "Missing holographId or filePath parameter" }, { status: 400 });
    }

    debugLog("🟢 Download request for:", filePath);

    // ✅ Step 3: Check if the user has access to this document
    const document = await prisma.vitalDocument.findUnique({
        where: { holographId_filePath: { holographId, filePath } },
        include: {
          holograph: {
            include: { principals: true, delegates: true },
          },
        },
      });

      if (!document) {
        return new Response(JSON.stringify({ error: "Document not found" }), { status: 404 });
      }

    const userId = session.user.id;
    const isPrincipal = document.holograph.principals.some((p) => p.userId === userId);
    const isDelegate = document.holograph.delegates.some((d) => d.userId === userId);
    // Check if the user has permission to access this document
    if (!isPrincipal && !isDelegate) {
      return NextResponse.json({ error: "Forbidden: No access to this document" }, { status: 403 });
    }

    debugLog(`✅ User ${userId} is authorized to access ${filePath}`);

    // ✅ Step 4: Stream the file from GCS
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ error: "File not found in storage" }, { status: 404 });
    }

    const stream = file.createReadStream();

    // **Convert the Node.js stream into a Web API Response**
    return new Response(stream as any, {
      headers: {
        "Content-Disposition": `attachment; filename="${filePath.split("/").pop()}"`,
        "Content-Type": "application/octet-stream",
      },
    });
  } catch (error) {
    console.error("❌ Error streaming file:", error);
    return new Response(JSON.stringify({ error: "Failed to stream file" }), { status: 500 });
  }
}
*/