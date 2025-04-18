// src/validators/financialAccountSchema.ts

import { z } from "zod";

export const financialAccountSchema = z.object({
  name: z.string().min(1, "Account name is required"),
  institution: z.string().min(1, "Institution name is required"),
  accountType: z.string().min(1, "Account type is required"),
  notes: z.string().optional(), // Optional textarea
});
