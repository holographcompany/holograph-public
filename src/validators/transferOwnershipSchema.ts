// /src/validators/transferOwnershipSchema.ts

import { z } from "zod";

export const transferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid(),
});
