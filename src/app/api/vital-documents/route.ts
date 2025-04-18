// /src/app/api/vital-documents/route.ts GET and POST Methods

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadEncryptedBufferToGCS, deleteFileFromGCS, bucket } from "@/lib/gcs";
import { debugLog } from "@/utils/debug";
import { Storage } from "@google-cloud/storage";
import { encryptFieldWithHybridEncryption } from "@/utils/encryption";
import { decryptFieldWithHybridEncryption } from "@/utils/encryption";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { vitalDocumentSchema } from "@/validators/vitalDocumentSchema";
import { ZodError } from "zod";
import { encryptBuffer } from "@/lib/encryption/crypto";
import Tokens from "csrf";

const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || "holograph-user-documents";

// ✅ Handle GET Requests for Fetching Vital Documents
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
  const userId = session.user.id;

  try {
   
    // Fetch holograph with user roles
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

    const isPrincipal = holograph.principals.some(p => p.userId === userId);
    const isDelegate = holograph.delegates.some(d => d.userId === userId);

    if (!isPrincipal && !isDelegate) {
      return NextResponse.json({ error: "Forbidden — no access to these documents" }, { status: 403 });
    }
    
    const documents = await prisma.vitalDocument.findMany({
      where: { holographId },
      orderBy: {
        createdAt: "asc", // ✅ Sorts in ascending order (oldest first)
      },
    });

    debugLog("✅ Retrieved documents:", documents);
    // ✅ Decrypt each document before returning
    const decryptedDocuments = await Promise.all(
      documents.map(async (doc) => {
        const decryptedName = await decryptFieldWithHybridEncryption(
          doc.holographId,
          doc.name,
          doc.nameKey,
          doc.nameIV
        );
    
        let decryptedNotes = null;

        // ✅ If notes are empty or missing, set to an empty string
        if (!doc.notes || !doc.notesKey || !doc.notesIV) {
          decryptedNotes = ""; 
        } else {
          try {
            decryptedNotes = await decryptFieldWithHybridEncryption(
              doc.holographId,
              doc.notes,
              doc.notesKey,
              doc.notesIV
            );
          } catch (error) {
            console.error("❌ Error decrypting notes:", error);
            decryptedNotes = "🔒 Unable to decrypt"; // Only show this if decryption fails
          }
        }        
    
        return {
          ...doc,
          name: decryptedName || "🔒 Unable to decrypt",
          notes: decryptedNotes, 
        };
      })
    );
    
    debugLog("✅ Decrypted documents:", decryptedDocuments);
    return NextResponse.json(decryptedDocuments, { status: 200 });

  } catch (error) {
    console.error("❌ Error retrieving documents:", error.message || "Unknown error");
    return NextResponse.json({ error: "Failed to load documents" }, { status: 500 });
  }
}

// ✅ Handle POST Requests for Uploading & Updating Vital Documents
export async function POST(req: Request) {

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

  // Define variables at the top level of the function scope
  let holographId = null;
  let name = null;
  let type = null;
  let notes = null;
  let uploadedBy = null;
  let createdBy: string | null = null; 
  let updatedBy: string | null = null; 
  let filePath = null;
  let newFilePath = null;
  let encryptedName = null;
  let encryptedNotes = null;
  let isNewDocument = false;
  let relativeFilePath: string | null = null;


  try {
    // Get form data from the request
    const formData = await req.formData();

    // Extract values safely
    const holographId = formData.get("holographId") as string;
    const name = formData.get("name") as string;
    const type = formData.get("type") as string;
    const notes = formData.get("notes") as string | null;
    const file = formData.get("file") as File | null;
    const existingFilePath = formData.get("existingFilePath") as string | null;
    const vitalDocumentId = formData.get("id") as string | null;
    createdBy = userId
    updatedBy = userId

    try {
        vitalDocumentSchema.parse({
          name,
          type,
          notes,
        });
      } catch (err) {
        if (err instanceof ZodError) {
          return NextResponse.json({ errors: err.errors }, { status: 400 });
        }
        throw err;
      }

    debugLog("🟢 Parsed Form Data:", { vitalDocumentId, holographId, name, type, notes, file });

    // Validate required fields
    if (!holographId) {
      console.error("❌ Missing required fields:", { holographId });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Fetch holograph with user roles
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

    const isPrincipal = holograph.principals.some(p => p.userId === userId);
    const isDelegate = holograph.delegates.some(d => d.userId === userId);

    if (!isPrincipal) {
      return NextResponse.json({ error: "Forbidden — no access to this Holograph" }, { status: 403 });
    }

    filePath = existingFilePath;

    if (!file && !filePath) {
      console.error("❌ No new file uploaded and no existing file provided.");
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // ✅ Check if SSL certificate exists for this holograph
    debugLog("🔍 Checking if SSL certificate exists for holograph:", holographId);
    const certPath = `ssl-keys/${holographId}/current/public.crt`;
    const [certExists] = await bucket.file(certPath).exists();

    
    if (!certExists) {
      debugLog("❌ SSL certificate not found for holograph:", holographId);
      return NextResponse.json(
        { error: "Encryption certificate not found. Please set up encryption for this holograph first." },
        { status: 400 }
      );
    }
    
    debugLog("✅ SSL certificate found for holograph:", holographId);

    if (!filePath) {
      // ✅ Check for update vs new document
      debugLog("🔍 Checking document creation type...");
      
      // Check if this is an update (existingFilePath provided) or a new document
      if (existingFilePath) {
        // User is updating an existing document, regardless of whether a new file is uploaded
        debugLog("✏️ Updating existing document with path:", existingFilePath);
        isNewDocument = false;
        filePath = existingFilePath;
      } else if (file) {
        // No existing path but a new file - this is a new document
        debugLog("🆕 New file uploaded without existingFilePath, creating a new document.");
        isNewDocument = true;
      } else {
        // No file and no existing path - this is an error
        debugLog("❌ No file uploaded and no existing file path provided.");
        return NextResponse.json({ error: "Either a file or an existing file path must be provided" }, { status: 400 });
      }
    }

    newFilePath = filePath;

    if (file) {
      uploadedBy = userId;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const safeOriginalName = file.name.replaceAll("/", "_");
      const timestampedFileName = `${Date.now()}-${safeOriginalName}`;
      const section = "vital-documents";
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
    
      // ✅ Match financial-accounts pattern
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

    if (!newFilePath) {
      console.error("❌ No valid file path available.");
      return NextResponse.json({ error: "File path missing" }, { status: 400 });
    }

    // ✅ Normalize file path - making sure we only store the relative path in the database
    const normalizedFilePath = newFilePath.replace("https://storage.googleapis.com/holograph-user-documents/", "");
    debugLog("📁 Normalized file path for storage:", normalizedFilePath);

    // ✅ Encrypt name and notes using hybrid encryption
    debugLog("🔐 Encrypting document name and notes with hybrid encryption...");
    let nameEncryptionResult = null;
    let notesEncryptionResult = null;

    try {
      // Encrypt name (required)
      nameEncryptionResult = await encryptFieldWithHybridEncryption(holographId, name);
      debugLog("✅ Name encrypted successfully");

      // Encrypt notes (optional)
      if (notes) {
        notesEncryptionResult = await encryptFieldWithHybridEncryption(holographId, notes);
        debugLog("✅ Notes encrypted successfully");
      }
    } catch (encryptionError) {
      debugLog("❌ Encryption failed:", encryptionError.message || "Unknown error");
      return NextResponse.json({ error: `Encryption failed: ${encryptionError.message || "Unknown error"}` }, { status: 500 });
    }


    if (isNewDocument) {
      // ✅ Create a new document
      debugLog("🆕 Creating a new document...");
      
      try {
        const newDocument = await prisma.vitalDocument.create({
          data: {
            holographId,
            name: nameEncryptionResult.encryptedValue,
            nameKey: nameEncryptionResult.encryptedKey,
            nameIV: nameEncryptionResult.iv,
            type,
            notes: notesEncryptionResult?.encryptedValue || null,
            notesKey: notesEncryptionResult?.encryptedKey ?? null,
            notesIV: notesEncryptionResult?.iv ?? null,
            filePath: normalizedFilePath,
            uploadedBy: userId, 
            createdBy,
            updatedBy,
          },
        });        

        debugLog("✅ New document created with ID:", newDocument.id);
        return NextResponse.json(newDocument, { status: 201 });
      } catch (dbError) {
        debugLog("❌ Error creating document in database:", dbError.message || "Unknown error");
        return NextResponse.json({ error: `Database error: ${dbError.message || "Unknown error"}` }, { status: 500 });
      }
    } else {
      // ✅ Update an existing document
      debugLog("✏️ Updating existing document...");

      // Normalize existing file path for lookup
      const normalizedExistingFilePath = filePath.replace("https://storage.googleapis.com/holograph-user-documents/", "");
      debugLog("🔍 Looking up document with:", { holographId, filePath: normalizedExistingFilePath });

      try {

        // ✅ Ensure the document exists before updating
        const existingDocument = await prisma.vitalDocument.findUnique({
            where: { id: vitalDocumentId },
        });

        if (!existingDocument) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        const updatedDocument = await prisma.vitalDocument.update({
            where: { id: vitalDocumentId }, // ✅ Lookup by primary key (faster & safer)
            data: {
                name: nameEncryptionResult.encryptedValue,
                nameKey: nameEncryptionResult.encryptedKey,
                nameIV: nameEncryptionResult.iv,
                type,
                notes: notesEncryptionResult?.encryptedValue || null,
                notesKey: notesEncryptionResult?.encryptedKey ?? null,
                notesIV: notesEncryptionResult?.iv ?? null,
                ...(file ? { filePath: normalizedFilePath } : {}), // ✅ Update filePath only if a new file is uploaded
                uploadedBy: userId, // ✅ Use session user ID
                updatedBy,
            },
        });

        debugLog("✅ Document successfully updated:", updatedDocument.id);
        return NextResponse.json(updatedDocument, { status: 200 });
      } catch (dbError) {
        debugLog("❌ Error updating document in database:", dbError.message || "Unknown error");
        return NextResponse.json({ error: `Database error: ${dbError.message || "Unknown error"}` }, { status: 500 });
      }
    }

  } catch (error) {
    // Safe error logging
    const errorMessage = error && typeof error === 'object' && 'message' in error ? error.message : 'Unknown error';
    console.error("❌ Error processing document update:", errorMessage);
    
    // Debug logging
    debugLog("🔍 Debugging variables:");
    debugLog("📌 holographId:", holographId);
    debugLog("📌 encryptedName:", encryptedName ? "Set" : "Not set");
    debugLog("📌 encryptedNotes:", encryptedNotes ? "Set" : "Not set");
    debugLog("📌 filePath:", filePath);
    debugLog("📌 newFilePath:", newFilePath);
    debugLog("📌 isNewDocument:", isNewDocument);
    
    return NextResponse.json({ error: `Failed to update document: ${errorMessage}` }, { status: 500 });
  }
}
