// /src/app/_components/holograph/ManageUsers.tsx

"use client";

import { useState, useEffect } from "react";
import { useHolograph } from "@/hooks/useHolograph";
import InviteUserModal from "./InviteUserModal";
import TransferOwnershipModal from "./TransferOwnershipModal";
import DelegatePermissions from "./DelegatePermissions";
import { useRouter, useParams } from "next/navigation";
import AccessDeniedModalDashboardRedirect from "@/app/_components/AccessDeniedModalDashboardRedirect";
import { userIcons, buttonIcons } from "@/config/icons";
import { debugLog } from "@/utils/debug";
import { apiFetch } from "@/lib/apiClient";

const getCsrfToken = async () => {
  const res = await apiFetch("/api/csrf-token");
  const { csrfToken } = await res.json();
  return csrfToken;
};



// ✅ Define a type for users
interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export default function ManageUsers() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isSessionLoading } = useHolograph();

  useEffect(() => {
    if (!isSessionLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isSessionLoading, isAuthenticated, router]);

  const { currentHolographId: sessionHolographId } = useHolograph(); // ✅ Get Holograph ID from session
  const params = useParams(); // ✅ Get Holograph ID from the URL
  // ✅ Use `params.id` as a fallback if sessionHolographId is missing
  const currentHolographId = sessionHolographId || (params.id as string);
  const [users, setUsers] = useState<User[]>([]); // ✅ Now TypeScript knows it's an array of Users
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inviteRole, setInviteRole] = useState<'Principal' | 'Delegate' | null>(null);

  const { userId } = useHolograph(); // Get current userId
  const [isPrincipal, setIsPrincipal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [isOwnershipModalOpen, setIsOwnershipModalOpen] = useState(false);
  
  useEffect(() => {
    if (!currentHolographId) {
      setError("No Holograph selected.");
      return;
    }
  
    const loadUsers = async () => {
      try {
        const res = await apiFetch(`/api/holograph/users?holographId=${currentHolographId}`);
        const data: User[] = await res.json();
  
        if (Array.isArray(data)) {
          setUsers(data);
        } else {
          console.error("Unexpected API response:", data);
          setUsers([]);
        }
      } catch (err) {
        console.error("Error fetching users:", err);
        setError("Failed to load users.");
      }
    };
  
    loadUsers();
  }, [currentHolographId]);
  

  // checks whether or not the user has access to this page
  useEffect(() => {
    if (!currentHolographId || !userId) return;
  
    const checkPrincipalStatus = async () => {
      try {
        const res = await apiFetch(`/api/holograph/${currentHolographId}`);
        const data = await res.json();
  
        const principals = data.principals || [];
        const isCurrentPrincipal = principals.some((p: any) => p.id === userId);
        setIsPrincipal(isCurrentPrincipal);
        debugLog("Fetched ownerId:", data.ownerId);
        setOwnerId(data.owner?.id);
      } catch (err) {
        console.error("Failed to verify user role:", err);
        setError("Failed to verify user role.");
      } finally {
        setIsLoading(false);
      }
    };
  
    checkPrincipalStatus();
  }, [currentHolographId, userId]);
  

  const handleRemoveDelegate = async (delegateId: string) => {
    // Confirm the removal action
    const confirmation = window.confirm("Are you sure you want to remove this delegate?");
    if (!confirmation) return;

    try {
      const csrfToken = await getCsrfToken();
      const response = await apiFetch(
        `/api/holograph/delegates?holographId=${currentHolographId}&delegateId=${delegateId}`,
        {
          method: 'DELETE',
          headers: {
            'x-csrf-token': csrfToken,
          },
        }
      );

      if (response.ok) {
        // Remove the delegate from the UI
        setUsers((prevUsers) => prevUsers.filter((user) => user.id !== delegateId));
        alert('Delegate removed successfully');
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error("Error removing delegate:", error);
      alert("Failed to remove delegate");
    }
  };

  const handleRemovePrincipal = async (principalId: string) => {
    const isSelf = principalId === userId;
  
    const confirmationMsg = isSelf
      ? "Are you sure you want to remove yourself from this Holograph? You will lose access."
      : "Are you sure you want to request removal of this Principal? They will need to approve it.";
  
    if (!window.confirm(confirmationMsg)) return;
  
    try {
      if (isSelf) {
        // Self-removal → DELETE
        const csrfToken = await getCsrfToken();
        const response = await apiFetch(
          `/api/holograph/principals?holographId=${currentHolographId}&userId=${userId}`,
          {
            method: 'DELETE',
            headers: {
              'x-csrf-token': csrfToken,
            },
          }
        );

  
        if (response.ok) {
          alert("You have been removed from the Holograph.");
          router.push('/dashboard');
        } else {
          const errorData = await response.json();
          alert(`Error: ${errorData.error}`);
        }
      } else {
        // Remove another Principal → POST pending removal
        const csrfToken = await getCsrfToken();
        const response = await apiFetch(`/api/holograph/${currentHolographId}/principals/remove`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
          },
          body: JSON.stringify({ targetUserId: principalId }),
        });

  
        if (response.ok) {
          alert("Removal request sent successfully.");
        } else {
          const errorData = await response.json();
          alert(`Error: ${errorData.error}`);
        }
      }
    } catch (error) {
      console.error("Error removing principal:", error);
      alert("Failed to process request.");
    }
  };
  
  const handleTransferOwnership = async (newOwnerId: string) => {
    const confirmTransfer = window.confirm("Confirm ownership transfer?");
    if (!confirmTransfer) return;
  
    try {
      const csrfToken = await getCsrfToken();
      const response = await apiFetch(`/api/holograph/${currentHolographId}/transfer-ownership`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ newOwnerId }),
      });

  
      if (response.ok) {
        alert("Ownership transferred.");
        setOwnerId(newOwnerId);
        setIsOwnershipModalOpen(false);
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error("Error transferring ownership:", error);
      alert("Failed to transfer ownership.");
    }
  };
  
  
  if (isLoading) return <p className="text-center text-gray-500">Loading...</p>;

  if (!isPrincipal) {
    return (
      <AccessDeniedModalDashboardRedirect
        message="You do not have permission to manage users for this Holograph."
      />
    );
  }

  if (isSessionLoading || isLoading) return <p className="text-center text-gray-500">Loading...</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Manage Users</h1>
  
      {error && <p className="text-red-500">{error}</p>}
  
      <button
        className="btn-secondary mb-4"
        onClick={() => router.push(`/holographs/${currentHolographId}`)}
      >
        ← Back to Holograph
      </button>
  
      {/* User Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        {/* Principals Section */}
        <div className="bg-white shadow-md rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span>Principals</span>
            <button
              className="text-green-600 hover:text-green-800 relative group"
              onClick={() => {
                setInviteRole("Principal");
                setIsModalOpen(true);
              }}
            >
              <userIcons.addPrincipal size={18} />
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-max px-2 py-1 text-xs bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition">
                Add Principal
              </span>
            </button>
            {userId === ownerId && (
              <button
                className="text-red-600 hover:text-red-800 relative group ml-4"
                onClick={() => setIsOwnershipModalOpen(true)}
              >
                <userIcons.transferOwnership size={18} />
                <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-max px-2 py-1 text-xs bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition">
                  Transfer Ownership
                </span>
              </button>
            )}

          </h2>

          <div className="space-y-4">
            {users
              .filter(user => user.role === "Principal")
              .sort((a, b) => a.lastName.localeCompare(b.lastName))
              .map(user => (
                <div
                  key={user.id}
                  className={`bg-white shadow-md rounded-lg p-4 flex justify-between items-center ${
                    user.id === userId
                      ? "border-2 border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                      : "border border-gray-300"
                  }`}                  
                > 
                <p className="font-medium text-gray-800">
                  {user.firstName} {user.lastName}{" "}
                  <span className="text-gray-500">({user.email})</span>
                  <span className="text-sm ml-2 text-gray-600">
                  
                  {user.id === ownerId && (
                    <span className="text-sm ml-2 text-gray-600">(Owner)</span>
                  )}

                  </span>
                </p>

                {user.id !== ownerId && (
                  <button
                    className="text-red-600 hover:text-red-800 relative group"
                    onClick={() => handleRemovePrincipal(user.id)}
                  >
                    <buttonIcons.delete size={18} />
                    <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-max px-2 py-1 text-xs bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition">
                      {user.id === userId ? "Remove Yourself" : "Request Removal"}
                    </span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Delegates Section */}
        <div className="bg-white shadow-md rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span>Delegates</span>
            <button
              className="text-blue-600 hover:text-blue-800 relative group"
              onClick={() => {
                setInviteRole("Delegate");
                setIsModalOpen(true);
              }}
            >
              <userIcons.addDelegate size={18} />
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-max px-2 py-1 text-xs bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition">
                Add Delegate
              </span>
            </button>
          </h2>
          <div className="space-y-4">
            {users
              .filter(user => user.role === "Delegate")
              .sort((a, b) => a.lastName.localeCompare(b.lastName))
              .map(user => (
                <div
                  key={user.id}
                  className={`bg-white shadow-md rounded-lg p-4 flex justify-between items-center ${
                    user.id === userId ? "border-2 border-blue-500" : "border border-gray-300"
                  }`}
                >

                <p className="font-medium text-gray-800">
                  {user.firstName} {user.lastName}{" "}
                  <span className="text-gray-500">({user.email})</span>
                </p>
                <button
                  className="text-red-600 hover:text-red-800 relative group"
                  onClick={() => handleRemoveDelegate(user.id)}
                >
                  <buttonIcons.delete size={18} />
                  <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-max px-2 py-1 text-xs bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition">
                    Remove this Delegate
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

  
      {/* ✅ InviteUserModal */}
      {isModalOpen && inviteRole && (
        <InviteUserModal
          holographId={currentHolographId}
          role={inviteRole}
          onClose={() => {
            setIsModalOpen(false);
            setInviteRole(null);
          }}
        />
      )}

      {/* ✅ TransferOwnershipModal */}
      {isOwnershipModalOpen && (
        <TransferOwnershipModal
          principals={users.filter(user => user.role === "Principal")}
          ownerId={ownerId}
          onClose={() => setIsOwnershipModalOpen(false)}
          onTransfer={handleTransferOwnership}
        />
      )}

  
      <hr className="my-6 border-t border-gray-300" />
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Delegate Permissions</h2>
  
      <DelegatePermissions holographId={currentHolographId} useSectionIds={true} />
    </div>
  );
}