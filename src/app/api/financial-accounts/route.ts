// /src/app/api/financial-accounts/route.ts 
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
import { financialAccountSchema } from "@/validators/financialAccountSchema";
import { ZodError } from "zod"; // ✅ For safe error handling
import { encryptBuffer } from "@/lib/encryption/crypto";
import Tokens from "csrf";
import { withCors, getCorsHeaders } from "@/utils/withCORS";




export const GET = withCors(async (req) => {
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
      return NextResponse.json({ error: "Forbidden — no access to these financial accounts" }, { status: 403 });
    }

    const accounts = await prisma.financialAccount.findMany({
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

      const decryptedInstitution = acc.institution
        ? await decryptFieldWithHybridEncryption(
            acc.holographId,
            acc.institution,
            acc.institutionKey,
            acc.institutionIV
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
        institution: decryptedInstitution || null,
        notes: decryptedNotes || null,
      };
    }));

    debugLog("✅ Decrypted financial accounts:", decryptedAccounts);
    return NextResponse.json(decryptedAccounts, { status: 200 });
  } catch (error) {
    console.error("❌ Failed to fetch financial accounts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const POST = withCors(async (req) => {
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
  let institution: string | null = null;
  let accountType: string | null = null;
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
    institution = formData.get("institution") as string;
    accountType = formData.get("accountType") as string;
    notes = formData.get("notes") as string;
    const existingFilePath = formData.get("existingFilePath") as string | null;
    const file = formData.get("file") as File | null;
    const financialAccountId = formData.get("id") as string | null; 
    const isNewDocument = !financialAccountId && !existingFilePath;
    createdBy = userId;
    updatedBy = userId;

    // ✅ Zod Validation
    try {
      financialAccountSchema.parse({ name, institution, accountType, notes });
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json({ errors: err.errors }, { status: 400 });
      }
      throw err; // Rethrow if it’s not a Zod error
    }

    let existingAccount = null;
    if (financialAccountId) {
      existingAccount = await prisma.financialAccount.findUnique({
        where: { id: financialAccountId },
      });
    } else if (!isNewDocument) {
      existingAccount = await prisma.financialAccount.findFirst({
        where: { holographId, filePath: existingFilePath || null },
      });
    }

    if (!isNewDocument && !existingAccount) {
      debugLog("⚠️ No existing financial account found, preventing accidental duplication.");
      return NextResponse.json({ error: "Financial account record not found for update." }, { status: 404 });
    }

    debugLog("🟢 Parsed fields:", { holographId, name, institution, accountType, notes });

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
      uploadedBy = userId;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = file.name.split(".").pop();
      const safeOriginalName = file.name.replaceAll("/", "_");
      const timestampedFileName = `${Date.now()}-${safeOriginalName}`;
      const section = "financial-accounts";
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
      relativeFilePath = filePath ? filePath.replace(GCS_PREFIX, "") : null;
    }

    // 🔐 Encrypt fields
    const nameEncrypted = await encryptFieldWithHybridEncryption(holographId, name);
    const institutionEncrypted = institution
      ? await encryptFieldWithHybridEncryption(holographId, institution)
      : null;
    const notesEncrypted = notes
      ? await encryptFieldWithHybridEncryption(holographId, notes)
      : null;

    if (isNewDocument) {
      debugLog("🆕 Creating financial account...");
      const created = await prisma.financialAccount.create({
        data: {
          holographId,
          uploadedBy,
          accountType,
          createdBy,
          updatedBy,
          filePath: relativeFilePath || null,
          name: nameEncrypted.encryptedValue,
          nameKey: nameEncrypted.encryptedKey,
          nameIV: nameEncrypted.iv,
          institution: institutionEncrypted?.encryptedValue,
          institutionKey: institutionEncrypted?.encryptedKey,
          institutionIV: institutionEncrypted?.iv,
          notes: notesEncrypted?.encryptedValue || null,
          notesKey: notesEncrypted?.encryptedKey || null,
          notesIV: notesEncrypted?.iv || null,
        },
      });

      debugLog("✅ Created:", created.id);
      return NextResponse.json(created, { status: 201 });
    } else {
      debugLog("✏️ Updating financial account...");
      const updated = await prisma.financialAccount.update({
        where: { id: financialAccountId || existingAccount?.id },
        data: {
          uploadedBy,
          accountType,
          updatedBy,
          filePath: relativeFilePath || null,
          name: nameEncrypted.encryptedValue,
          nameKey: nameEncrypted.encryptedKey,
          nameIV: nameEncrypted.iv,
          institution: institutionEncrypted?.encryptedValue,
          institutionKey: institutionEncrypted?.encryptedKey,
          institutionIV: institutionEncrypted?.iv,
          notes: notesEncrypted?.encryptedValue || null,
          notesKey: notesEncrypted?.encryptedKey || null,
          notesIV: notesEncrypted?.iv || null,
        },
      });

      debugLog("✅ Updated:", updated.id);
      return NextResponse.json(updated, { status: 200 });
    }
  } catch (error: any) {
    console.error("❌ Full error during financial account create/update:", error);

    const message =
      error?.response?.data?.error ||
      error?.response?.data ||
      error?.message ||
      "Unknown error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
});
