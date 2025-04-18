// /validators/delegatePermissionsSchema.ts

import { z } from "zod";

export const updateDelegatePermissionSchema = z.object({
  holographId: z.string().uuid(),
  delegateId: z.string().uuid(),
  sectionId: z.string().uuid(),
  accessLevel: z.enum(["none", "view-only"]),
});

export type UpdateDelegatePermissionInput = z.infer<typeof updateDelegatePermissionSchema>;
