// src/validators/utilitySchema.ts

import { z } from "zod";

export const utilitySchema = z.object({
  name: z.string().min(1, "Utility name is required"),
  notes: z.string().optional(), // Optional textarea
});
