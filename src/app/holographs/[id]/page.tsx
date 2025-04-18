// /src/app/holographs/[id]/page.tsx - Holograph detail page / landing Page
'use client';

import { useEffect, useState } from 'react';
import { useSession } from "next-auth/react";
import { useParams, useRouter } from 'next/navigation';
import InviteUserModal from '@/app/_components/holograph/InviteUserModal';
import Link from 'next/link';
import { useHolograph } from '@/hooks/useHolograph';
import { debugLog } from '@/utils/debug';
import { format } from "date-fns";
import { sectionIcons, buttonIcons } from "@/config/icons"; // Import the dynamic icons
import AccessDeniedModalDashboardRedirect from '@/app/_components/AccessDeniedModalDashboardRedirect';
import HolographForm from "@/app/_components/holograph/HolographForm";
import { apiFetch } from "@/lib/apiClient";



interface HolographUser {
  id: string;
  firstName: string;
  lastName: string;
}

interface Holograph {
  id: string;
  title: string;
  geography?: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string; // ✅ Add this for direct access
  owner?: HolographUser; // Optional: full owner info
  principals: HolographUser[];
  delegates: HolographUser[];
}

interface Section {
  sectionId: string;  // ✅ Add this
  id: string;
  name: string;
  slug: string;
  description: string;
  iconSlug: string;
}

const HolographDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const { currentHolographId, setCurrentHolographId, userId, isAuthenticated, isLoading: isSessionLoading } = useHolograph();
  
  const [holograph, setHolograph] = useState<Holograph | null>(null);
  const [sections, setSections] = useState<Section[]>([]); // Stores dynamic sections
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRole, setInviteRole] = useState<'Principal' | 'Delegate' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [delegatePermissions, setDelegatePermissions] = useState<Record<string, string>>({});
  const [showEditModal, setShowEditModal] = useState(false);
  const { data: session } = useSession();


  const SaveIcon = buttonIcons.save;
  const CloseIcon = buttonIcons.close;


  const [didSetHolographId, setDidSetHolographId] = useState(false);

  useEffect(() => {
    if (!didSetHolographId && params.id && currentHolographId !== params.id) {
      debugLog(`🔄 Setting currentHolographId to ${params.id}`);
      setCurrentHolographId(params.id as string);
      setDidSetHolographId(true);
    }
  }, [params.id, currentHolographId, didSetHolographId, setCurrentHolographId]);


  useEffect(() => {
    if (!isSessionLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isSessionLoading, isAuthenticated, router]);

  useEffect(() => {
    const fetchHolograph = async () => {
      try {
        if (!params.id || !userId) return;
        debugLog(`🚀 Fetching Holograph Details for ID: ${params.id}`);
        const response = await apiFetch(`/api/holograph/${params.id}`);
        
        if (!response.ok) {
          debugLog("⛔ Unauthorized or Holograph not found — redirecting.");
          setError("You are not authorized to view this Holograph.");
          setTimeout(() => router.push("/dashboard"), 3000);
          return;
        }
        const data = await response.json();

        debugLog(`🔍 Checking authorization for user ${userId}`);
        debugLog("✅ Full API Response:", data);  // 🔍 Log the entire response
        debugLog("✅ Holograph Data:", data);
        debugLog("✅ Holograph Principals:", data.principals);
        debugLog("✅ Holograph Delegates:", data.delegates);

        setHolograph(data);
        setNewTitle(data.title);
        setIsAuthorized(true);
      } catch (err) {
        console.error("❌ Error fetching Holograph:", err);
        setError("You are not authorized to view this Holograph");
        setTimeout(() => router.push("/holographs"), 3000);
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) fetchHolograph();
  }, [params.id, userId, router]);

  // Fetch sections dynamically
  useEffect(() => {
    const fetchSections = async () => {
      try {
        if (!params.id || !isAuthorized) return; // ✅ Skip fetch if not authorized
        debugLog(`🚀 Fetching Sections for Holograph ID: ${params.id}`);
        const response = await apiFetch(`/api/holograph/${params.id}/sections`);

        
        if (!response.ok) {
          debugLog("❌ Failed to fetch sections");
          return; // ✅ Don't throw — just exit
        }
        const data = await response.json();
        setSections(data);
      } catch (err) {
        console.error("❌ Error fetching sections:", err);
      }
    };
  
    fetchSections();
  }, [params.id, isAuthorized]);
  

  useEffect(() => {
    const fetchDelegatePermissions = async () => {
      if (!params.id || !userId) return;
      try {
        debugLog("🟡 Fetching delegate permissions with:", {
          userId,
          holographId: params.id,
        });
        const response = await fetch(`/api/holograph/delegate-permissions?userId=${userId}&holographId=${params.id}`, {
          credentials: "include",
        });
        
        if (!response.ok) throw new Error("Failed to fetch delegate permissions");
        const data = await response.json(); // Expected: [{ sectionId, accessLevel }]
        debugLog("✅ Delegate Permissions Fetched:", data);
        const permissionsMap: Record<string, string> = {};
        data.forEach(({ sectionId, accessLevel }) => {
          permissionsMap[sectionId] = accessLevel;
        });
        setDelegatePermissions(permissionsMap);
        debugLog("✅ Delegate Permissions Fetched:", permissionsMap);
      } catch (err) {
        console.error("❌ Error loading delegate permissions:", err);
        // Show detailed response if available
        if (err instanceof Error) {
          debugLog("❌ Fetch Error Message:", err.message);
        }
      }
    };
  
    // Only fetch permissions if user is not a Principal
    const isPrincipal = holograph?.principals?.some(p => p.id === userId) || false;
    if (!isPrincipal && userId) {
      fetchDelegatePermissions();
    }
  }, [params.id, userId, holograph]);
  

  const handleEdit = async () => {
    if (!holograph) return;
    await apiFetch(`/api/holograph/${holograph.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
       
    setHolograph((prev) => prev ? { ...prev, title: newTitle } : prev);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!holograph) return;
    if (
      !confirm("Are you sure you want to delete this Holograph? Deleting this Holograph will also delete all sections, and this action cannot be undone.")
    ) return;

    try {
      const response = await apiFetch(`/api/holograph/${holograph.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 403) {
          alert("You are not authorized to delete this Holograph.");
          router.push("/dashboard");
          return;
        }
        console.error("❌ Failed to delete Holograph:", errorData);
        alert("Failed to delete Holograph: " + errorData.error);
        return;
      }

      console.log("✅ Holograph deleted successfully.");
      router.push("/dashboard");
    } catch (err) {
      console.error("❌ Unexpected error:", err);
      alert("Unexpected error occurred while deleting the Holograph.");
    }
  };

  if (isSessionLoading || isLoading) return <p className="text-center text-gray-500 text-lg">Loading...</p>;
  if (!isAuthenticated) return <p className="text-center text-red-500 text-lg">Please log in</p>;
  if (!isAuthorized) {
    return (
      <AccessDeniedModalDashboardRedirect message={error || "You are not authorized to view this Holograph."} />
    );
  }
  if (!holograph) return <p className="text-center text-gray-600 text-lg">No Holograph found.</p>;

  const isPrincipal = holograph?.principals?.some(p => p.id === userId) || false;
  const isOwner = holograph?.ownerId === userId;

  debugLog("👑 Holograph Principals:", holograph?.principals);
  debugLog("🧑‍💻 Current User ID:", userId);
  debugLog("🧑‍💻 Current Owner:", holograph?.owner?.firstName);
  debugLog("🔐 delegatePermissions Map:", delegatePermissions);
  debugLog("🕵️ isPrincipal?", isPrincipal);
  debugLog("📦 Sections Loaded:", sections);
  debugLog("🛡️ isOwner?", isOwner); // Add this debug too

  return (
    <div className="p-8 max-w-full mx-auto bg-stone-50 text-black min-h-screen">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-4xl font-bold text-gray-800">
          {holograph.title}
        </h1>

        {/* Info Icon */}
        <span className="text-sm relative group cursor-pointer">
          <span className="text-lg">ℹ️</span>
          <div className="absolute left-0 mt-2 w-64 bg-white text-sm text-gray-700 p-3 border border-gray-300 shadow-lg rounded hidden group-hover:block z-50">
            <p>
            <span className="font-semibold">Owner:</span> {holograph.owner?.firstName} {holograph.owner?.lastName}
            </p>
            <p>
            <span className="font-semibold">Geography:</span> {holograph.geography}
            </p>
            <p>
              <span className="font-semibold">Principals:</span>{" "}
              {holograph.principals?.length > 0
                ? holograph.principals.map((p) => `${p.firstName} ${p.lastName}`).join(", ")
                : "None"}
            </p>
            <p>
              <span className="font-semibold">Delegates:</span>{" "}
              {holograph.delegates?.length > 0
                ? holograph.delegates.map((d) => `${d.firstName} ${d.lastName}`).join(", ")
                : "None"}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Created: {format(new Date(holograph.createdAt), "MMM d, yyyy")}
            </p>
            <p className="text-xs text-gray-500">
              Last Updated: {format(new Date(holograph.updatedAt), "MMM d, yyyy")}
            </p>
          </div>
        </span>

        {isPrincipal && (
          <>
            {/* Edit Holograph Name */}
            <button
              className="ml-2 text-yellow-600 text-sm relative group"
              onClick={() => setShowEditModal(true)}
            >
              <span><buttonIcons.edit size={18} /></span>
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-max px-2 py-1 text-xs bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition">
                Edit Holograph Name or Location
              </span>
            </button>

            {/* Manage Users */}
            <button
              className="ml-2 text-blue-600 text-sm relative group"
              onClick={() => router.push(`/holographs/${holograph.id}/manage-users`)}
            >
              <span><buttonIcons.users size={18} /></span>
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-max px-2 py-1 text-xs bg-blue-600 text-white rounded opacity-0 group-hover:opacity-100 transition">
                Manage Users for this Holograph
              </span>
            </button>

            {/* Delete Holograph */}
            {isOwner && (
              <button
                className="ml-2 text-red-600 text-sm relative group"
                onClick={handleDelete}
              >
                <span><buttonIcons.delete size={18} /></span>
                <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-max px-2 py-1 text-xs bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition">
                  Delete Holograph (Caution!)
                </span>
              </button>
            )}
          </>
        )}
      </div>
      <div className="flex gap-4">
          <button
            onClick={() => router.push(`/dashboard`)}
            className="btn-secondary"
          >
            ← Back to Dashboard
          </button>
          <div className="mt-6 flex gap-4">
       </div>
      </div>

      {showInviteModal && inviteRole && (
        <InviteUserModal holographId={holograph.id} role={inviteRole} onClose={() => setShowInviteModal(false)} />
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-md w-[90%] max-w-xl">
            <HolographForm
              mode="edit"
              userId={session?.user?.id || ""}
              holographId={holograph.id}
              initialData={{
                title: holograph.title,
                geography: holograph.geography || "",
              }}
              onSuccess={async (updated) => {
                debugLog("✅ Holograph updated:", updated);
              
                const res = await apiFetch(`/api/holograph/${holograph.id}`);
                const fresh = await res.json();
                setHolograph(fresh); // ✅ update local state with new data
              
                setShowEditModal(false);
              }}              
              onCancel={() => setShowEditModal(false)}
            />
          </div>
        </div>
      )}


      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8">
      {sections.map((section) => {
        const IconComponent = sectionIcons[section.iconSlug] || sectionIcons["vital_documents"];
        
        let canAccess = true; // Default for Principals

        if (!isPrincipal) {
          const accessLevel = delegatePermissions[section.sectionId] || "none";
          canAccess = accessLevel === "view-only";
        }

        return (
          <div
            key={section.id}
            className={`block border border-gray-400 shadow-md rounded-lg p-4 
              ${canAccess ? "bg-gray-200 hover:bg-gray-100 cursor-pointer" : "bg-gray-100 cursor-not-allowed opacity-50"}`}
          >
            {canAccess ? (
              <Link href={`/holographs/${holograph.id}/${section.slug}`} className="no-underline">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 no-underline">
                  <IconComponent size={24} /> {section.name}
                </h2>
                <p className="text-gray-700 mt-1 text-sm no-underline">{section.description}</p>
              </Link>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <IconComponent size={24} /> {section.name}
                </h2>
                <p className="text-gray-700 mt-1 text-sm">{section.description}</p>
                <p className="text-red-500 text-xs mt-1 italic">Access Restricted</p>
              </>
            )}
          </div>
        );
      })}

      </div>
    </div>
  );
};

export default HolographDetailPage;