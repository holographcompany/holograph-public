// src/validators/homeServiceSchema.ts

import { z } from "zod";

export const homeServiceSchema = z.object({
  name: z.string().min(1, "Home Service name is required"),
  notes: z.string().optional(), // Optional textarea
});
