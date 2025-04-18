// /utils/delegateHelpers.ts

import { prisma } from '@/lib/db';
import { debugLog } from './debug';

// Removes a delegate and cleans up related data (invitations, etc.)
export async function removeDelegate(
  holographId: string,
  userIdToRemove: string,
  requestedById: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    // Check if the user is actually a delegate
    const delegate = await prisma.holographDelegate.findUnique({
      where: {
        holographId_userId: {
          holographId,
          userId: userIdToRemove,
        },
      },
    });

    if (!delegate) {
      return { error: 'User is not a delegate of this Holograph.' };
    }

    // Delete delegate entry
    await prisma.holographDelegate.delete({
      where: {
        holographId_userId: {
          holographId,
          userId: userIdToRemove,
        },
      },
    });

    debugLog(`🗑 Removed delegate ${userIdToRemove} from Holograph ${holographId}`);

    // ✅ Delete invitations for this user in this Holograph
    await prisma.invitation.deleteMany({
      where: {
        holographId,
        inviteeId: userIdToRemove,
      },
    });

    debugLog(`🗑 Deleted invitations for delegate ${userIdToRemove} in Holograph ${holographId}`);

    return { success: true };
  } catch (error) {
    console.error('Error in removeDelegate helper:', error);
    return { error: 'Failed to remove delegate.' };
  }
}
