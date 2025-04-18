// /src/app/api/personal-properties/route.ts 
// - GET and POST methods

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadEncryptedBufferToGCS, deleteFileFromGCS } from "@/lib/gcs";
import { debugLog } from "@/utils/debug";
import { encryptFieldWithHybridEncryption } from "@/utils/encryption";
import { decryptFieldWithHybridEncryption } from "@/utils/encryption";
import { personalPropertySchema } from "@/validators/personalPropertySchema";
import { ZodError } from "zod";
import { encryptBuffer } from "@/lib/encryption/crypto";
import Tokens from "csrf";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const holographId = searchParams.get("holographId");

  if (!holographId) {
    return NextResponse.json({ error: "Missing holographId" }, { status: 400 });
  }

  const session = await getServerSession(await getAuthOptions());
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const holograph = await prisma.holograph.findUnique({
      where: { id: holographId },
      select: {
        principals: { select: { userId: true } },
        delegates: { select: { userId: true } },
      },
    });

    if (!holograph) {
      return NextResponse.json({ error: "Holograph not found" }, { status: 404 });
    }

    const isPrincipal = holograph.principals.some(p => p.userId === session.user.id);
    const isDelegate = holograph.delegates.some(d => d.userId === session.user.id);

    if (!isPrincipal && !isDelegate) {
      return NextResponse.json({ error: "Forbidden — no access to these properties" }, { status: 403 });
    }

    const accounts = await prisma.personalProperty.findMany({
      where: { holographId },
      orderBy: { createdAt: "asc" },
    });

    const decryptedAccounts = await Promise.all(accounts.map(async (acc) => {
      const decryptedName = await decryptFieldWithHybridEncryption(
        acc.holographId,
        acc.name,
        acc.nameKey,
        acc.nameIV
      );

      const decryptedNotes = acc.notes
        ? await decryptFieldWithHybridEncryption(
            acc.holographId,
            acc.notes,
            acc.notesKey,
            acc.notesIV
          )
        : null;

      return {
        ...acc,
        name: decryptedName || "🔒 Unable to decrypt",
        notes: decryptedNotes || null,
      };
    }));

    debugLog("✅ Decrypted personal properties:", decryptedAccounts);
    return NextResponse.json(decryptedAccounts, { status: 200 });
  } catch (error) {
    console.error("❌ Failed to fetch personal properties:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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

  const userId = session.user.id;

  const BUCKET_NAME = process.env.GCS_BUCKET_NAME!;
  const GCS_PREFIX = `https://storage.googleapis.com/${BUCKET_NAME}/`;


  let holographId: string | null = null;
  let name: string | null = null;
  let notes: string | null = null;
  let uploadedBy: string | null = null; 
  let createdBy: string | null = null; 
  let updatedBy: string | null = null; 
  let filePath: string | null = null;
  let newFilePath: string | null = null;
  let isNewDocument = false;

  try {
    const formData = await req.formData();
    holographId = formData.get("holographId") as string;
    name = formData.get("name") as string;
    notes = formData.get("notes") as string;
    const existingFilePath = formData.get("existingFilePath") as string | null;
    const file = formData.get("file") as File | null;
    const personalPropertyId = formData.get("id") as string | null; 
    const isNewDocument = !personalPropertyId && !existingFilePath;
    createdBy = userId
    updatedBy = userId

    try {
          personalPropertySchema.parse({
            name,
            notes,
          });
        } catch (err) {
          if (err instanceof ZodError) {
            return NextResponse.json({ errors: err.errors }, { status: 400 });
          }
          throw err;
        }


    let existingAccount = null;

    if (personalPropertyId) {
      existingAccount = await prisma.personalProperty.findUnique({
        where: { id: personalPropertyId }, // ✅ Lookup by ID first
      });
    } else if (!isNewDocument) {
      existingAccount = await prisma.personalProperty.findFirst({
        where: { holographId, filePath: existingFilePath || null }, // ✅ Fallback lookup by filePath
      });
    }

    // 🚨 If updating but no record exists, return an error
    if (!isNewDocument && !existingAccount) {
      debugLog("⚠️ No existing property found, preventing accidental duplication.");
      return NextResponse.json({ error: "Personal Property record not found for update." }, { status: 404 });
    }


    debugLog("🟢 Parsed fields:", { holographId, name, notes });

    if (!holographId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const holograph = await prisma.holograph.findUnique({
      where: { id: holographId },
      select: {
        principals: { select: { userId: true } },
        delegates: { select: { userId: true } },
      },
    });

    if (!holograph) {
      return NextResponse.json({ error: "Holograph not found" }, { status: 404 });
    }

    const isPrincipal = holograph.principals.some((p) => p.userId === userId);
    if (!isPrincipal) {
      return NextResponse.json({ error: "Forbidden — no access to this Holograph" }, { status: 403 });
    }

    filePath = existingFilePath;
    newFilePath = filePath;
    let relativeFilePath: string | null = null;

    if (file) {
      uploadedBy = userId; // ✅ Set uploadedBy only if a file exists
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = file.name.split(".").pop();
    
      // ✅ Preserve original name and prepend timestamp
      const safeOriginalName = file.name.replaceAll("/", "_");
      const timestampedFileName = `${Date.now()}-${safeOriginalName}`;
    
      // ✅ New GCS structure: <holographId>/<section>/<timestamped-original-name>
      const section = "personal-properties"; // <- change as needed per section
      const gcsFileName = `${holographId}/${section}/${timestampedFileName}`;
    
      const isAlreadyEncrypted = formData.get("fileEncrypted") === "true";
      debugLog("🟢 Uploading new file:", gcsFileName);
      if (isAlreadyEncrypted) {
        debugLog("🛡️ Skipping server-side encryption — file already encrypted on client");
        await uploadEncryptedBufferToGCS(buffer, gcsFileName, file.type || "application/octet-stream");
      } else {
        const encryptedBuffer = await encryptBuffer(buffer, holographId);
        await uploadEncryptedBufferToGCS(encryptedBuffer, gcsFileName, file.type || "application/octet-stream");
      }
    
      const normalizedExistingFilePath = filePath;
      const normalizedNewFilePath = gcsFileName;
    
      if (!isNewDocument && normalizedExistingFilePath && normalizedExistingFilePath !== normalizedNewFilePath) {
        debugLog("🗑️ Deleting old file from GCS:", normalizedExistingFilePath);
        try {
          await deleteFileFromGCS(normalizedExistingFilePath);
        } catch (err) {
          console.warn("⚠️ Error deleting old file:", err);
        }
      }
      newFilePath = gcsFileName;
      relativeFilePath = newFilePath ? newFilePath.replace(GCS_PREFIX, "") : null;

    } else {
      debugLog("✅ No new file uploaded, keeping existing:", filePath);
      relativeFilePath = filePath ? filePath.replace(GCS_PREFIX, "") : null; // ✅ Ensure relativeFilePath is properly handled
    }
    
    
    // 🔐 Encrypt fields
    const nameEncrypted = await encryptFieldWithHybridEncryption(holographId, name);
    const notesEncrypted = notes
      ? await encryptFieldWithHybridEncryption(holographId, notes)
      : null;
      

    if (isNewDocument) {
      debugLog("🆕 Creating personal property account...");
    
      const created = await prisma.personalProperty.create({
        data: {
          holographId,
          uploadedBy,
          createdBy,
          updatedBy,
          filePath: relativeFilePath || null,


          name: nameEncrypted.encryptedValue,
          nameKey: nameEncrypted.encryptedKey,
          nameIV: nameEncrypted.iv,

          notes: notesEncrypted?.encryptedValue || null,
          notesKey: notesEncrypted?.encryptedKey || null,
          notesIV: notesEncrypted?.iv || null,
        },
      });

      debugLog("✅ Created:", created.id);
      return NextResponse.json(created, { status: 201 });
    } else {
      debugLog("✏️ Updating personal property account...");
      

      const updated = await prisma.personalProperty.update({
        where: { id: personalPropertyId || existingAccount?.id }, // ✅ Lookup by ID first
        data: {
          uploadedBy,
          updatedBy,
          filePath: relativeFilePath || null,

          name: nameEncrypted.encryptedValue,
          nameKey: nameEncrypted.encryptedKey,
          nameIV: nameEncrypted.iv,

          notes: notesEncrypted?.encryptedValue || null,
          notesKey: notesEncrypted?.encryptedKey || null,
          notesIV: notesEncrypted?.iv || null,
        },
      });

      debugLog("✅ Updated:", updated.id);
      return NextResponse.json(updated, { status: 200 });
    }
  } catch (error: any) {
    console.error("❌ Full error during personal property account create/update:", error);
  
    const message =
      error?.response?.data?.error ||
      error?.response?.data ||
      error?.message ||
      "Unknown error";
  
    return NextResponse.json({ error: message }, { status: 500 });
  }  
}
