// src/validators/propertySchema.ts
import { z } from "zod";

export const propertySchema = z.object({
  name: z.string().min(1, "Property name is required"),
  propertyType: z.string().min(1, "Property type is required"),
  notes: z.string().optional(),
});
