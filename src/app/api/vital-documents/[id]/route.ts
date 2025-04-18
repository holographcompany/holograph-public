// /src/app/api/vital-documents/[id]/route.ts - PUT & DELETE for Updating & Deleting Documents

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteFileFromGCS } from "@/lib/gcs";
import { uploadFileToGCS } from "@/lib/gcs"; // ✅ Ensure this import exists
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { debugLog } from "@/utils/debug";
import { vitalDocumentSchema } from "@/validators/vitalDocumentSchema";
import { ZodError } from "zod";
import { encryptBuffer } from "@/lib/encryption/crypto";
import { uploadEncryptedBufferToGCS } from "@/lib/gcs";
import Tokens from 'csrf';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    
    const session = await getServerSession(await getAuthOptions());
    if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    // csrf check
    const tokens = new Tokens();
    const csrfToken = req.headers.get("x-csrf-token");
    const csrfSecret = req.cookies.get("csrfSecret")?.value;
  
    if (!csrfToken || !csrfSecret || !tokens.verify(csrfSecret, csrfToken)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }

    }
    const userId = session.user.id;
    let updatedBy: string | null = null; 
    
    try {
      const BUCKET_NAME = process.env.GCS_BUCKET_NAME!;
      const GCS_PREFIX = `https://storage.googleapis.com/${BUCKET_NAME}/`;

      // make sure user is authorized to see vital document 
      const document = await prisma.vitalDocument.findUnique({
        where: { id: params.id },
        include: {
            holograph: {
            select: {
                principals: { select: { userId: true } },
                delegates: { select: { userId: true } },
            },
            },
        },
        });
          
        if (!document) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }
        
        const isOwner = document.uploadedBy === userId;
        const isPrincipal = document.holograph.principals.some(p => p.userId === userId);
        const isDelegate = document.holograph.delegates.some(d => d.userId === userId);
        
        if (!(isOwner || isPrincipal )) {
        return NextResponse.json({ error: "Forbidden — no access to this document" }, { status: 403 });
        }         

        const formData = await req.formData();
        const vitalDocumentId = formData.get("id") as string | null; // ✅ Extract the ID
        const name = formData.get("name") as string;
        const type = formData.get("type") as string;
        const notes = formData.get("notes") as string | null; // ✅ Fix: Ensure `notes` can be `null`
        const file = formData.get("file") as File | null;
        updatedBy = session.user.id

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
            
        if (!vitalDocumentId) {
            return NextResponse.json({ error: "Missing document ID" }, { status: 400 });
        }

        // ✅ Standardized file structure <holographId>/<section>/<timestamped-file-name>
        const section = "vital-documents"; // ✅ Define section name
        let updatedData: { 
            name: string; 
            type: string; 
            notes: string | null;
            updatedBy: string; 
            filePath?: string; // ✅ Make `filePath` optional
        } = {
            name,
            type,
            notes: notes || null,
            updatedBy: updatedBy,
        };

        if (file) {
          const safeOriginalName = file.name.replaceAll("/", "_");
          const timestampedFileName = `${Date.now()}-${safeOriginalName}`;
          const gcsFileName = `${document.holographId}/${section}/${timestampedFileName}`;
          const isAlreadyEncrypted = formData.get("fileEncrypted") === "true";
        
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
        
          debugLog("🟢 Uploading updated file:", gcsFileName);
          if (isAlreadyEncrypted) {
            debugLog("🛡️ Skipping server-side encryption — file already encrypted on client");
            await uploadEncryptedBufferToGCS(buffer, gcsFileName, file.type || "application/octet-stream");
          } else {
            const encryptedBuffer = await encryptBuffer(buffer, document.holographId);
            await uploadEncryptedBufferToGCS(encryptedBuffer, gcsFileName, file.type || "application/octet-stream");
          }
        
          // ✅ Normalize file path before storing in DB
          const relativeFilePath = gcsFileName.replace(GCS_PREFIX, "");
          updatedData.filePath = relativeFilePath;
        }

        const updatedDocument = await prisma.vitalDocument.update({
            where: { id: params.id },
            data: updatedData,
        });

        return NextResponse.json(updatedDocument);
    } catch (error) {
        console.error("Error updating document:", error);
        return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
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
  
    try {
      const vitalDocument = await prisma.vitalDocument.findUnique({
          where: { id: params.id },
          include: {
              holograph: {
                  select: {
                      principals: { select: { userId: true } },
                      delegates: { select: { userId: true } },
                  },
              },
          },
      });
      
      if (!vitalDocument) {
          return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
      
      const isOwner = vitalDocument.uploadedBy === userId;
      const isPrincipal = vitalDocument.holograph.principals.some(p => p.userId === userId);
      
      if (!(isOwner || isPrincipal)) {
          return NextResponse.json({ error: "Forbidden — only the owner or a principal can delete this document" }, { status: 403 });
      }
  
      // ✅ Step 1: Delete file and update DB in a transaction
      await prisma.$transaction(async (tx) => {
        if (vitalDocument.filePath) {
          await deleteFileFromGCS(vitalDocument.filePath);
          debugLog("🗑️ GCS file deleted:", vitalDocument.filePath);
        }

        await tx.vitalDocument.delete({
          where: { id: params.id },
        });
      });
      
      debugLog(`✅ Vital Document ${params.id} deleted successfully`);
      return NextResponse.json({ message: "Document deleted successfully" }, { status: 200 });
      
    } catch (error) {
      console.error("Error deleting document:", error);
      return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
    }
  }
  
