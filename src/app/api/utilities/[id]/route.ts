// /src/app/api/utilities/[id]/route.ts 
// - PUT and DELETE methods

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteFileFromGCS } from "@/lib/gcs";
import { debugLog } from "@/utils/debug";
import { encryptFieldWithHybridEncryption } from "@/utils/encryption";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { utilitySchema } from "@/validators/utilitySchema"; // ✅ Import schema
import { ZodError } from "zod"; // ✅ Zod error type
import { encryptBuffer } from "@/lib/encryption/crypto";
import { uploadEncryptedBufferToGCS } from "@/lib/gcs";
import Tokens from 'csrf';
import { withCors, getCorsHeaders } from "@/utils/withCORS";



export const PUT = withCors(async (req, context) => {
  const session = await getServerSession(await getAuthOptions());
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // csrf check
  const tokens = new Tokens();
  const csrfToken = req.headers.get("x-csrf-token");
  const csrfSecret = req.cookies.get("csrfSecret")?.value;

  if (!csrfToken || !csrfSecret || !tokens.verify(csrfSecret, csrfToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  let updatedBy: string | null = null; 

  try {
    const formData = await req.formData();

    const holographId = formData.get("holographId") as string;
    const name = formData.get("name") as string;
    const notes = formData.get("notes") as string;
    let uploadedBy: string | null = null; // ✅ Initialize as null
    const existingFilePath = formData.get("existingFilePath") as string | null;
    const file = formData.get("file") as File | null;
    const fileEncrypted = formData.get("fileEncrypted") === "true";
    updatedBy = session.user.id

    // ✅ Zod input validation
    try {
      utilitySchema.parse({
        name,
        notes,
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json({ errors: err.errors }, { status: 400 });
      }
      throw err;
    }

    if (!holographId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Encrypt fields
    const encryptedName = await encryptFieldWithHybridEncryption(holographId, name);
    const encryptedNotes = notes
      ? await encryptFieldWithHybridEncryption(holographId, notes)
      : null;

    let filePath = existingFilePath || null;

    if (file) {
      uploadedBy = session.user.id;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = file.name.split(".").pop();
      const safeOriginalName = file.name.replaceAll("/", "_");
      const timestampedFileName = `${Date.now()}-${safeOriginalName}`;
      const gcsPath = `utilities/${holographId}/${timestampedFileName}`;
    
      if (existingFilePath && existingFilePath !== gcsPath) {
        try {
          await deleteFileFromGCS(existingFilePath);
          debugLog(`🗑️ Deleted old file from GCS: ${existingFilePath}`);
        } catch (err) {
          console.error("❌ Failed to delete old file:", err);
        }
      }
    
      if (fileEncrypted) {
        debugLog("🛡️ Skipping server-side encryption — file already encrypted on client");
        await uploadEncryptedBufferToGCS(buffer, gcsPath, file.type || "application/octet-stream");
      } else {
        const encryptedBuffer = await encryptBuffer(buffer, holographId);
        await uploadEncryptedBufferToGCS(encryptedBuffer, gcsPath, file.type || "application/octet-stream");
      }
      filePath = gcsPath;
    }
    
    const updatedAccount = await prisma.utility.update({
      where: { id: context.params.id },      data: {
        holographId,
        uploadedBy,
        updatedBy,
        filePath: filePath || undefined,

        name: encryptedName.encryptedValue,
        nameKey: encryptedName.encryptedKey,
        nameIV: encryptedName.iv,

        notes: encryptedNotes?.encryptedValue || null,
        notesKey: encryptedNotes?.encryptedKey || null,
        notesIV: encryptedNotes?.iv || null,
      },
    });

    debugLog("✅ Utility updated:", updatedAccount.id);
    return NextResponse.json(updatedAccount);
  } catch (error) {
    console.error("❌ Error updating utility:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const DELETE = withCors(async (req, context) => {

  const session = await getServerSession(await getAuthOptions());
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // csrf check
  const tokens = new Tokens();
  const csrfToken = req.headers.get("x-csrf-token");
  const csrfSecret = req.cookies.get("csrfSecret")?.value;

  if (!csrfToken || !csrfSecret || !tokens.verify(csrfSecret, csrfToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const fileOnly = searchParams.get("fileOnly") === "true"; // Determine if file-only delete

    // Step 1 look up record + access rights
    const record = await prisma.utility.findUnique({
      where: { id: context.params.id },      select: { filePath: true, holographId: true },
    });

    if (!record) {
      return NextResponse.json({ error: "Utility not found" }, { status: 404 });
    }

    // Ensure the user has permissions to modify this utility
    const userAccess = await prisma.holographPrincipal.findFirst({
      where: {
        holographId: record.holographId,
        userId: session.user.id,
      },
    });

    if (!userAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // 🟢 Step 2 File-only delete mode: Remove file but keep the record
    // 🟢 File-only delete mode: Remove file but keep the record
    if (fileOnly) {
      if (!record.filePath) {
        return NextResponse.json({ error: "No file to delete" }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        await deleteFileFromGCS(record.filePath!);
        debugLog(`🗑️ GCS file deleted: ${record.filePath}`);

        await tx.Utility.update({
          where: { id: context.params.id },          data: {
            filePath: "", // Force recognition
          },
        });

        await tx.Utility.update({
          where: { id: context.params.id },          data: {
            filePath: null,
            uploadedBy: null,
          },
        });
      });

    
      debugLog(`🗑️ Database updated: filePath=null, uploadedBy=null for Utility ${context.params.id}`);
      return NextResponse.json({ success: true, message: "File deleted, record updated" });
    }
    
    // Step 3: Full delete (file + DB record)
    await prisma.$transaction(async (tx) => {
      if (record.filePath) {
        await deleteFileFromGCS(record.filePath);
        debugLog(`🗑️ GCS file deleted: ${record.filePath}`);
      }

      await tx.Utility.delete({
        where: { id: context.params.id },      });

      debugLog(`🗑️ Deleted utility ${context.params.id} from database`);
    });
    return NextResponse.json({ success: true, message: "Utility deleted" });

  } catch (error) {
    console.error("❌ Error deleting utility:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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