// src/hooks/useHolograph.ts
"use client";

import { useSession } from "next-auth/react";
import { useCallback, useState, useEffect } from "react";
import { debugLog } from "@/utils/debug";

export function useHolograph() {
  const { data: session, update, status } = useSession();

  // ✅ Add hydration detection
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
    debugLog("🧠 Client has hydrated. Session status:", status);
  }, []);

  const setCurrentHolographId = useCallback(async (holographId: string) => {
    debugLog("🔄 Setting currentHolographId in session:", holographId);
    try {
      await update({
        currentHolographId: holographId,
      });
      debugLog("✅ Successfully updated session with currentHolographId");
    } catch (error) {
      console.error("❌ Error updating session:", error);
    }
  }, [update]);

  return {
    currentHolographId: isHydrated ? session?.user?.currentHolographId : null,
    userId: isHydrated ? session?.user?.id : null,
    isLoading: !isHydrated || status === "loading",
    isAuthenticated: isHydrated && status === "authenticated",
    setCurrentHolographId
  };  
}