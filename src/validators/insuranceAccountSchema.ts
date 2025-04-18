// src/validators/insuranceAccountSchema.ts
import { z } from "zod";

export const insuranceAccountSchema = z.object({
  name: z.string().min(1, "Account name is required"),
  provider: z.string().min(1, "Provider is required"),
  policyType: z.string().min(1, "Policy type is required"),
  notes: z.string().optional(),
});