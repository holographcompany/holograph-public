// /src/app/_components/manage-users/DelegatePermissions.tsx

import { useState, useEffect } from "react";
import { useHolograph } from "@/hooks/useHolograph";
import AccessDeniedModalDashboardRedirect from "@/app/_components/AccessDeniedModalDashboardRedirect";
import { debugLog } from "@/utils/debug";
import { apiFetch } from "@/lib/apiClient";


export default function DelegatePermissions({ holographId }) {
  interface Delegate {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }
  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [permissions, setPermissions] = useState({});
  const [sections, setSections] = useState<{ id: string; sectionId: string; name: string }[]>([]);
  const [isPrincipal, setIsPrincipal] = useState(false);
  const { isAuthenticated, isLoading: isSessionLoading, userId } = useHolograph();
  const [isCheckingPrincipal, setIsCheckingPrincipal] = useState(true);


  // Principal check
useEffect(() => {
  if (!holographId || !userId) return;

  const checkPrincipal = async () => {
    try {
      const res = await apiFetch(`/api/holograph/${holographId}`);
      const data = await res.json();
      const principals = data.principals || [];
      const isCurrentPrincipal = principals.some((p) => p.id === userId);
      setIsPrincipal(isCurrentPrincipal);
    } catch (err) {
      console.error("Failed to verify principal status:", err);
    } finally {
      setIsCheckingPrincipal(false);
    }
  };

  checkPrincipal();
}, [holographId, userId]);

  
  
useEffect(() => {
  if (!holographId) return;

  const loadDelegates = async () => {
    try {
      const res = await apiFetch(`/api/holograph/delegates/list?holographId=${holographId}`);
      const data = await res.json();
      console.log("✅ Delegates loaded:", data); // Debug
      setDelegates(data);
    } catch (err) {
      console.error("❌ Failed to load delegates:", err);
    }
  };

  loadDelegates();
}, [holographId]);


useEffect(() => {
  if (!holographId || !userId) return;

  const loadPermissions = async () => {
    try {
      const res = await apiFetch(`/api/holograph/delegate-permissions?holographId=${holographId}`);
      const data = await res.json();

      if (!Array.isArray(data)) {
        console.error("❌ Expected an array but got:", data);
        return;
      }

      const permissionsMap = {};
      data.forEach(({ delegateId, sectionId, accessLevel }) => {
        if (!permissionsMap[delegateId]) {
          permissionsMap[delegateId] = {};
        }
        permissionsMap[delegateId][sectionId] = accessLevel;
      });

      setPermissions(permissionsMap);
      debugLog("🗺️ Permissions Map:", permissionsMap);
    } catch (err) {
      console.error("❌ Error fetching permissions:", err);
    }
  };

  loadPermissions();
}, [holographId, userId]);



useEffect(() => {
  if (!holographId) return;

  const loadSections = async () => {
    try {
      const res = await apiFetch(`/api/holograph/${holographId}/sections`);
      const data = await res.json();
      setSections(data);
      debugLog("📦 Sections Loaded:", data);
    } catch (err) {
      console.error("❌ Error loading sections:", err);
    }
  };

  loadSections();
}, [holographId]);

  

const handlePermissionChange = async (delegateId, sectionId, newLevel) => {
  setPermissions((prev) => ({
    ...prev,
    [delegateId]: { ...prev[delegateId], [sectionId]: newLevel },
  }));

  const payload = {
    holographId,
    delegateId,
    sectionId,
    accessLevel: newLevel,
  };

  debugLog("📤 Sending permission update:", payload);

  try {
    // ✅ Get CSRF token first
    const csrfRes = await apiFetch("/api/csrf-token");
    const { csrfToken } = await csrfRes.json();

    // ✅ Send the update with CSRF token included
    await apiFetch("/api/holograph/delegate-permissions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("❌ Failed to update delegate permission:", err);
    // Optional: revert optimistic state or show a UI error
  }
};


  if (isSessionLoading || isCheckingPrincipal) {
    return <p className="text-center text-gray-500">Loading...</p>;
  }

  if (!isSessionLoading && !isPrincipal) {
    return (
      <AccessDeniedModalDashboardRedirect message="Only Principals can manage Delegate permissions." />
    );
  }
  

  return (
    <div className="bg-white shadow-md rounded-lg p-4 mt-4">
      <h2 className="text-lg font-semibold">Manage Delegate Permissions</h2>

      {(Array.isArray(delegates) ? delegates.slice().sort((a, b) => a.lastName.localeCompare(b.lastName)) : []).map((delegate) => (
      <div key={delegate.id} className="mt-2">
        <h3 className="font-medium">
          {delegate.firstName} {delegate.lastName} ({delegate.email})
        </h3>
        
        <div className="grid grid-cols-3 gap-2 mt-2">
          {sections.map((section) => (
            <div key={section.sectionId} className="flex items-center justify-between bg-gray-100 p-2 rounded">
              <span>{section.name}</span>
              <select
                value={permissions[delegate.id]?.[section.sectionId] || "none"}
                onChange={(e) => handlePermissionChange(delegate.id, section.sectionId, e.target.value)}
                className="border rounded px-2 py-1"
              >
                <option value="none">None</option>
                <option value="view-only">View-Only</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
  );
}
