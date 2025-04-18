// /src/app/api/insurance-accounts/route.ts 
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
import { insuranceAccountSchema } from "@/validators/insuranceAccountSchema";
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
      return NextResponse.json({ error: "Forbidden — no access to these insurance accounts" }, { status: 403 });
    }

    const accounts = await prisma.insuranceAccount.findMany({
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

      const decryptedProvider = acc.provider
        ? await decryptFieldWithHybridEncryption(
            acc.holographId,
            acc.provider,
            acc.providerKey,
            acc.providerIV
          )
        : null;

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
        provider: decryptedProvider || null,
        notes: decryptedNotes || null,
      };
    }));

    debugLog("✅ Decrypted insurance accounts:", decryptedAccounts);
    return NextResponse.json(decryptedAccounts, { status: 200 });
  } catch (error) {
    console.error("❌ Failed to fetch insurance accounts:", error);
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
  let provider: string | null = null;
  let policyType: string | null = null;
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
    provider = formData.get("provider") as string;
    policyType = formData.get("policyType") as string;
    notes = formData.get("notes") as string;
    const existingFilePath = formData.get("existingFilePath") as string | null;
    const file = formData.get("file") as File | null;
    const insuranceAccountId = formData.get("id") as string | null; 
    const isNewDocument = !insuranceAccountId && !existingFilePath;
    createdBy = userId
    updatedBy = userId

    // ✅ Zod Validation
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
    
    let existingAccount = null;

    if (insuranceAccountId) {
      existingAccount = await prisma.insuranceAccount.findUnique({
        where: { id: insuranceAccountId }, // ✅ Lookup by ID first
      });
    } else if (!isNewDocument) {
      existingAccount = await prisma.insuranceAccount.findFirst({
        where: { holographId, filePath: existingFilePath || null }, // ✅ Fallback lookup by filePath
      });
    }

    // 🚨 If updating but no record exists, return an error
    if (!isNewDocument && !existingAccount) {
      debugLog("⚠️ No existing insurance account found, preventing accidental duplication.");
      return NextResponse.json({ error: "Insurance account record not found for update." }, { status: 404 });
    }


    debugLog("🟢 Parsed fields:", { holographId, name, provider, policyType, notes });

    if (!holographId) {
      return NextResponse.json({ error: "Missing Holograph ID" }, { status: 400 });
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
      const section = "insurance-accounts"; // <- change as needed per section
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
    const providerEncrypted = provider
      ? await encryptFieldWithHybridEncryption(holographId, provider)
      : null;
    const notesEncrypted = notes
      ? await encryptFieldWithHybridEncryption(holographId, notes)
      : null;
      

    if (isNewDocument) {
      debugLog("🆕 Creating insurance account...");
    
      const created = await prisma.insuranceAccount.create({
        data: {
          holographId,
          uploadedBy,
          policyType,
          createdBy,
          updatedBy,
          filePath: relativeFilePath || null,


          name: nameEncrypted.encryptedValue,
          nameKey: nameEncrypted.encryptedKey,
          nameIV: nameEncrypted.iv,

          provider: providerEncrypted?.encryptedValue,
          providerKey: providerEncrypted?.encryptedKey,
          providerIV: providerEncrypted?.iv,

          notes: notesEncrypted?.encryptedValue || null,
          notesKey: notesEncrypted?.encryptedKey || null,
          notesIV: notesEncrypted?.iv || null,
        },
      });

      debugLog("✅ Created:", created.id);
      return NextResponse.json(created, { status: 201 });
    } else {
      debugLog("✏️ Updating insurance account...");
      

      const updated = await prisma.insuranceAccount.update({
        where: { id: insuranceAccountId || existingAccount?.id }, // ✅ Lookup by ID first
        data: {
          uploadedBy,
          policyType,
          updatedBy,
          filePath: relativeFilePath || null,

          name: nameEncrypted.encryptedValue,
          nameKey: nameEncrypted.encryptedKey,
          nameIV: nameEncrypted.iv,

          provider: providerEncrypted?.encryptedValue,
          providerKey: providerEncrypted?.encryptedKey,
          providerIV: providerEncrypted?.iv,

          notes: notesEncrypted?.encryptedValue || null,
          notesKey: notesEncrypted?.encryptedKey || null,
          notesIV: notesEncrypted?.iv || null,
        },
      });

      debugLog("✅ Updated:", updated.id);
      return NextResponse.json(updated, { status: 200 });
    }
  } catch (error: any) {
    console.error("❌ Full error during insurance account create/update:", error);
  
    const message =
      error?.response?.data?.error ||
      error?.response?.data ||
      error?.message ||
      "Unknown error";
  
    return NextResponse.json({ error: message }, { status: 500 });
  }  
}
