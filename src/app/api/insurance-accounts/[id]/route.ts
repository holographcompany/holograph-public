// /src/app/api/insurance-accounts/[id]/route.ts 
// - PUT and DELETE methods

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadEncryptedBufferToGCS, deleteFileFromGCS } from "@/lib/gcs";
import { debugLog } from "@/utils/debug";
import { encryptFieldWithHybridEncryption } from "@/utils/encryption";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { insuranceAccountSchema } from "@/validators/insuranceAccountSchema";
import { ZodError } from "zod";
import Tokens from "csrf";
import { encryptBuffer } from "@/lib/encryption/crypto";

export async function PUT(req: NextRequest, context: { params: { id: string } }) {
  const session = await getServerSession(await getAuthOptions());
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = context.params.id;
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
    const provider = formData.get("provider") as string;
    const policyType = formData.get("policyType") as string;
    const notes = formData.get("notes") as string;
    let uploadedBy: string | null = null; // ✅ Initialize as null
    const existingFilePath = formData.get("existingFilePath") as string | null;
    const file = formData.get("file") as File | null;
    const fileEncrypted = formData.get("fileEncrypted") === "true";
    updatedBy = session.user.id

    // ✅ Zod validation for user inputs
    try {
      insuranceAccountSchema.parse({
        name,
        provider,
        policyType,
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
    const encryptedProvider = provider
      ? await encryptFieldWithHybridEncryption(holographId, provider)
      : null;
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
      const gcsPath = `insurance-accounts/${holographId}/${timestampedFileName}`;

      // If existing file path is different, delete the old one
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

    const updatedAccount = await prisma.insuranceAccount.update({
      where: { id },
      data: {
        holographId,
        uploadedBy,
        policyType,
        updatedBy,
        filePath: filePath || undefined,

        name: encryptedName.encryptedValue,
        nameKey: encryptedName.encryptedKey,
        nameIV: encryptedName.iv,

        provider: encryptedProvider?.encryptedValue,
        providerKey: encryptedProvider?.encryptedKey,
        providerIV: encryptedProvider?.iv,

        notes: encryptedNotes?.encryptedValue || null,
        notesKey: encryptedNotes?.encryptedKey || null,
        notesIV: encryptedNotes?.iv || null,
      },
    });

    debugLog("✅ Insurance account updated:", updatedAccount.id);
    return NextResponse.json(updatedAccount);
  } catch (error) {
    console.error("❌ Error updating insurance account:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: { id: string } }) {
  const session = await getServerSession(await getAuthOptions());
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = context.params.id;
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

    const record = await prisma.insuranceAccount.findUnique({
      where: { id },
      select: { filePath: true, holographId: true },
    });

    if (!record) {
      return NextResponse.json({ error: "Insurance account not found" }, { status: 404 });
    }

    // Ensure the user has permissions to modify this insurance account
    const userAccess = await prisma.holographPrincipal.findFirst({
      where: {
        holographId: record.holographId,
        userId: session.user.id,
      },
    });

    if (!userAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // 🟢 File-only delete mode: Remove file but keep the record
    if (fileOnly) {
      if (!record.filePath) {
        return NextResponse.json({ error: "No file to delete" }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        await deleteFileFromGCS(record.filePath!);
        debugLog(`🗑️ GCS file deleted: ${record.filePath}`);

        await tx.insuranceAccount.update({
          where: { id },
          data: {
            filePath: "", // Force recognition
          },
        });

        await tx.insuranceAccount.update({
          where: { id },
          data: {
            filePath: null,
            uploadedBy: null, 
          },
        });
      });

      debugLog(`✅ File-only delete completed for insurance account ${id}`);
      return NextResponse.json({ success: true, message: "File deleted, record retained" });
    }

    // Step 3: Full deletion
    await prisma.$transaction(async (tx) => {
      if (record.filePath) {
        await deleteFileFromGCS(record.filePath);
        debugLog(`🗑️ GCS file deleted: ${record.filePath}`);
      }

      await tx.insuranceAccount.delete({
        where: { id },
      });

      debugLog(`🗑️ Insurance account ${id} deleted from DB`);
    });

    return NextResponse.json({ success: true, message: "Insurance account deleted" });

  } catch (error) {
    console.error("❌ Error deleting insurance account:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
