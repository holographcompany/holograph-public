// /src/utils/principalHelpers.ts

import { prisma } from '@/lib/db';
import { debugLog } from './debug'

/**
 * Removes a Principal from a Holograph, ensuring rules are enforced.
 * @param holographId - ID of the Holograph
 * @param userIdToRemove - ID of the Principal being removed
 * @param initiatorId - ID of the user initiating the removal (for security checks)
 * @returns success status or error message
 */
export async function removePrincipal(holographId: string, userIdToRemove: string, initiatorId: string) {
  // Fetch Holograph to check owner
  const holograph = await prisma.holograph.findUnique({
    where: { id: holographId },
    select: { ownerId: true },
  });

  if (!holograph) {
    return { error: 'Holograph not found' };
  }

  // Prevent removal of Owner
  if (userIdToRemove === holograph.ownerId) {
    return { error: 'Cannot remove the Holograph Owner' };
  }

  // Security check: initiator must be removing themselves OR be a Principal
  if (initiatorId !== userIdToRemove) {
    const isInitiatorPrincipal = await prisma.holographPrincipal.findUnique({
      where: {
        holographId_userId: {
          holographId,
          userId: initiatorId,
        },
      },
    });

    if (!isInitiatorPrincipal) {
      return { error: 'Unauthorized to remove this user' };
    }
  }

  // Check if user is a Principal
  const isPrincipal = await prisma.holographPrincipal.findUnique({
    where: {
      holographId_userId: {
        holographId,
        userId: userIdToRemove,
      },
    },
  });

  if (!isPrincipal) {
    return { error: 'User is not a Principal' };
  }

  // Check if this is the last Principal
  const principalCount = await prisma.holographPrincipal.count({
    where: { holographId },
  });

  if (principalCount <= 1) {
    return { error: 'Cannot remove the last Principal' };
  }

  // Delete Principal
  await prisma.holographPrincipal.delete({
    where: {
      holographId_userId: {
        holographId,
        userId: userIdToRemove,
      },
    },
  });

  debugLog(`🗑 Removed principal ${userIdToRemove} from Holograph ${holographId}`);

   // ✅ Delete invitations for this user in this Holograph
   await prisma.invitation.deleteMany({
    where: {
      holographId,
      inviteeId: userIdToRemove,
    },
  });

  debugLog(`🗑 Deleted invitations for ${userIdToRemove} in Holograph ${holographId}`);

  return { success: true };
}
