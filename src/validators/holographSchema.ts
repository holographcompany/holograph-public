// /src/validators/holographSchema.ts

import { z } from "zod";

export const holographSchema = z.object({
  title: z.string().min(1, "Title is required"),
  geography: z.string().min(1, "Geography is required"),
});
