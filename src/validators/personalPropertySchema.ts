// src/validators/personalPropertySchema.ts

import { z } from "zod";

export const personalPropertySchema = z.object({
  name: z.string().min(1, "Property name is required"),
  notes: z.string().optional(),
});
