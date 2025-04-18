// /src/hooks/useSectionAccess.ts
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useHolograph } from "./useHolograph";
import { debugLog } from "@/utils/debug";

export function useSectionAccess(sectionSlug: string) {
  const params = useParams();
  const { userId } = useHolograph();

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [holographTitle, setHolographTitle] = useState("");
  const [sectionName, setSectionName] = useState("");

  useEffect(() => {
    const checkAccess = async () => {
      const holographId = params.id;
      if (!holographId || !userId) return;

      debugLog("🔐 Checking access for section:", sectionSlug);

      try {
        // 1. Fetch sections to get sectionId + name
        const sectionsRes = await fetch(`/api/holograph/${holographId}/sections`);
        const sectionsData = await sectionsRes.json();
        const currentSection = sectionsData.find(sec => sec.slug === sectionSlug);

        if (!currentSection) {
          debugLog("❌ Section not found:", sectionSlug);
          setAccessDenied(true);
          setIsLoading(false);
          return;
        }

        const sectionId = currentSection.sectionId;
        setSectionName(currentSection.name); // Store for modal

        // 2. Fetch Holograph for Principal check and title
        const holographRes = await fetch(`/api/holograph/${holographId}`);
        const holographData = await holographRes.json();
        setHolographTitle(holographData.title); // Store for modal

        const isPrincipal = holographData.principals.some(p => p.id === userId);
        debugLog("👑 Is Principal?", isPrincipal);

        if (isPrincipal) {
          setIsAuthorized(true);
          setIsLoading(false);
          return;
        }

        // 3. Fetch Delegate Permissions for user
        const permRes = await fetch(`/api/holograph/delegate-permissions?holographId=${holographId}&userId=${userId}`);
        const permData = await permRes.json();

        const permissionsMap: Record<string, string> = {};
        permData.forEach(({ sectionId, accessLevel }) => {
          permissionsMap[sectionId] = accessLevel;
        });

        const accessLevel = permissionsMap[sectionId] || "none";
        debugLog("📜 Delegate Access Level:", accessLevel);

        if (accessLevel === "view-only") {
          setIsAuthorized(true);
        } else {
          setAccessDenied(true);
        }
      } catch (err) {
        console.error("❌ Error in access check:", err);
        setAccessDenied(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [params.id, userId, sectionSlug]);

  return { isAuthorized, isLoading, accessDenied, holographTitle, sectionName };
}
