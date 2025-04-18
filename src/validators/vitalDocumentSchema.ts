import { z } from "zod";

export const vitalDocumentSchema = z.object({
  name: z.string().min(1, "Document name is required"),
  type: z.string().min(1, "Document type is required"),
  notes: z.string().optional(),
});
