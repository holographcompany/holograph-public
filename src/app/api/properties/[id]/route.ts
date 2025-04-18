// /src/app/api/properties/[id]/route.ts 
// - PUT and DELETE methods

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadEncryptedBufferToGCS, deleteFileFromGCS } from "@/lib/gcs";
import { debugLog } from "@/utils/debug";
import { encryptFieldWithHybridEncryption } from "@/utils/encryption";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { propertySchema } from "@/validators/propertySchema";
import { ZodError } from "zod";
import Tokens from "csrf";
import { encryptBuffer } from "@/lib/encryption/crypto";


export async function PUT(req: NextRequest, context) {
  const id = context.params.id;
  const session = await getServerSession(await getAuthOptions());
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
    const propertyType = formData.get("propertyType") as string;
    const notes = formData.get("notes") as string;
    let uploadedBy: string | null = null; // ✅ Initialize as null
    const existingFilePath = formData.get("existingFilePath") as string | null;
    const file = formData.get("file") as File | null;
    const fileEncrypted = formData.get("fileEncrypted") === "true";
    updatedBy = session.user.id

    try {
      propertySchema.parse({
        name,
        propertyType,
        notes,
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json({ errors: err.errors }, { status: 400 });
      }
      throw err;
    }
    
    if (!holographId) {
      return NextResponse.json({ error: "Missing Holograph ID" }, { status: 400 });
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
      const gcsPath = `properties/${holographId}/${timestampedFileName}`;

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


    const updatedAccount = await prisma.property.update({
      where: { id },
      data: {
        holographId,
        uploadedBy,
        propertyType,
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

    debugLog("✅ Property updated:", updatedAccount.id);
    return NextResponse.json(updatedAccount);
  } catch (error) {
    console.error("❌ Error updating property:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context) {
  const id = context.params.id;

  const session = await getServerSession(await getAuthOptions());
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ✅ CSRF Protection
  const tokens = new Tokens();
  const csrfToken = req.headers.get("x-csrf-token");
  const csrfSecret = req.cookies.get("csrfSecret")?.value;

  if (!csrfToken || !csrfSecret || !tokens.verify(csrfSecret, csrfToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const fileOnly = searchParams.get("fileOnly") === "true"; // Determine if file-only delete

    const record = await prisma.property.findUnique({
      where: { id },
      select: { filePath: true, holographId: true },
    });

    if (!record) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    // Ensure the user has permissions to modify this property
    const userAccess = await prisma.holographPrincipal.findFirst({
      where: {
        holographId: record.holographId,
        userId: session.user.id,
      },
    });

    if (!userAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

   // 🟢 File-only delete mode
  if (fileOnly) {
    if (!record.filePath) {
      return NextResponse.json({ error: "No file to delete" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await deleteFileFromGCS(record.filePath!);
      debugLog(`🗑️ GCS file deleted: ${record.filePath}`);

      // ✅ Force recognition by clearing to empty string first
      await tx.property.update({
        where: { id },
        data: {
          filePath: "", // Force change
        },
      });

      // ✅ Then nullify the fields
      await tx.property.update({
        where: { id },
        data: {
          filePath: null,
          uploadedBy: null,
        },
      });
    });

    debugLog(`✅ File-only delete completed for property ${id}`);
    return NextResponse.json({ success: true, message: "File deleted, record retained" });
  }



    // 🟢 Full deletion
    await prisma.$transaction(async (tx) => {
      if (record.filePath) {
        await deleteFileFromGCS(record.filePath);
        debugLog(`🗑️ GCS file deleted: ${record.filePath}`);
      }

      await tx.property.delete({
        where: { id },
      });

      debugLog(`🗑️ Deleted property ${id} from database`);
    });

    return NextResponse.json({ success: true, message: "Property deleted" });

  } catch (error) {
    console.error("❌ Error deleting property:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
