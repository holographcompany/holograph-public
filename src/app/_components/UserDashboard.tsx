// src/app/_components/UserDashboard.tsx - this is the main user dashboard - shows ALL Holographs for a user

"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Share2, X } from 'lucide-react';
import Link from 'next/link';
import HolographForm from './holograph/HolographForm';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useHolograph } from '@/hooks/useHolograph';
import { format } from "date-fns";
import { userIcons, buttonIcons } from '@/config/icons';
import { debugLog } from '@/utils/debug';
import { apiFetch } from "@/lib/apiClient";


// Define types for our data
interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface Holograph {
  id: string;
  title: string;
  geography?: string;
  updatedAt: string;
  owner?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  principals?: {
    id: string;
    firstName: string;
    lastName: string;
  }[];
  delegates?: {
    id: string;
    firstName: string;
    lastName: string;
  }[];
}



interface Invitation {
  id: string;
  holographId: string;
  role: string;
  inviterId: string;
  status: string;  
  holographTitle?: string;
  inviterFirstName?: string;
  inviterLastName?: string;
}

interface RemovalRequest {
  id: string;
  holographId: string;
  holographTitle: string;
  requestedBy: {
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
}


const UserDashboard = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { setCurrentHolographId } = useHolograph();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeTab, setActiveTab] = useState('owned');
  const [holographs, setHolographs] = useState<{
    owned: Holograph[];
    delegated: Holograph[];
  }>({
    owned: [],
    delegated: []
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [removalRequests, setRemovalRequests] = useState([]);
  const HolographIcon = userIcons["holograph-principals"];
  const DelegatedIcon = userIcons["holograph-delegates"];
  const CreateIcon = buttonIcons["create-holograph"];

  

  // Log session status for debugging
  useEffect(() => {
    debugLog("🔍 Auth Status: debuglog",status);
    debugLog("🔍 Session: debuglog", session);

  }, [status, session]);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      debugLog("⚠️ User not authenticated, redirecting to login");
      router.push('/login');
    }
  }, [status, router]);

  // fetch removal requests
  const fetchRemovalRequests = async () => {
    try {
      const response = await apiFetch(`/api/holograph/principal-removal-requests`);
      if (!response.ok) throw new Error("Failed to fetch removal requests");
      const data = await response.json();
      setRemovalRequests(data);
    } catch (error) {
      console.error("❌ Error fetching removal requests:", error);
    }
  };

  // Fetch Holographs & Invitations after authentication
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return;

    const userId = session.user.id;
    debugLog("✅ User authenticated with ID:", userId);

    const fetchHolographs = async () => {
      try {
        setIsLoading(true);
        debugLog("🔍 Fetching holographs for user:", userId);
        
        const ownedResponse = await apiFetch(`/api/holograph/principals`);
        const delegatedResponse = await apiFetch(`/api/holograph/delegates`);
        
        if (!ownedResponse.ok || !delegatedResponse.ok) {
          throw new Error("Failed to fetch holographs");
        }
        
        let ownedData = await ownedResponse.json();
        let delegatedData = await delegatedResponse.json();

        debugLog("✅ Fetched data - Owned:", ownedData.length, "Delegated:", delegatedData.length);

        setHolographs({
          owned: ownedData.map((holo: Holograph) => ({
            ...holo,
            owner: holo.owner
              ? {
                  id: holo.owner.id,
                  firstName: holo.owner.firstName,
                  lastName: holo.owner.lastName,
                }
              : { id: "unknown", firstName: "Unknown", lastName: "" },
              geography: holo.geography ?? "Not specified", // ✅ Add this line
          })),
          delegated: delegatedData.map((holo: Holograph) => ({
            ...holo,
            owner: holo.owner
              ? {
                  id: holo.owner.id,
                  firstName: holo.owner.firstName,
                  lastName: holo.owner.lastName,
                }
              : { id: "unknown", firstName: "Unknown", lastName: "" },
              geography: holo.geography ?? "Not specified", // ✅ Add this line
          })),
        });
        

        if (holographs.owned.length > 0 || holographs.delegated.length > 0) {
          debugLog("📡 Owned Holographs:", holographs.owned);
          debugLog("📡 Delegated Holographs:", holographs.delegated);
      
          holographs.owned.forEach(holo => debugLog(`📅 Owned Holograph - ${holo.title}:`, holo.updatedAt));
          holographs.delegated.forEach(holo => debugLog(`📅 Delegated Holograph - ${holo.title}:`, holo.updatedAt));
        }
      } catch (err) {
        console.error("❌ Error fetching holographs:", err);
        setError("Failed to load holographs. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };


    const fetchInvitations = async () => {
      debugLog("🔍 Fetching invitations for user:", userId);
      try {
        const response = await apiFetch(`/api/invitations`);
        if (!response.ok) throw new Error("Failed to fetch invitations");

        let invitationsData = await response.json();
        debugLog("✅ Fetched invitations:", invitationsData.length);
        setInvitations(invitationsData);
      } catch (error) {
        console.error("❌ Error fetching invitations:", error);
      }
    };
    fetchHolographs();
    fetchInvitations();
    fetchRemovalRequests();
  }, [status, session, router]);

  const handleCreateSuccess = async (newHolograph: Holograph): Promise<void> => {
    debugLog("🔍 handleCreateSuccess is being executed...");
    debugLog(`✅ Created new Holograph: ${newHolograph.title}`);
  
    debugLog("🚀 Redirecting to dashboard...");
    router.push("/dashboard");
    router.refresh();
  };

  // Handle accepting invitation
  const handleAcceptInvite = async (inviteId: string, holographId: string) => {
    try {
      const response = await apiFetch(`/api/invitations/${inviteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Accepted' }),
      });
      

      if (response.ok) {
        setInvitations(prev => prev.filter(invite => invite.id !== inviteId));
        // Refresh the holographs list
        router.refresh();
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
    }
  };

  // Handle declining invitation
  const handleDeclineInvite = async (inviteId: string) => {
    try {
      const response = await apiFetch(`/api/invitations/${inviteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Declined' }),
      });
      
      if (response.ok) {
        setInvitations(prev => prev.filter(invite => invite.id !== inviteId));
      }
    } catch (error) {
      console.error('Error declining invitation:', error);
    }
  };

  const handleRemovalResponse = async (removalId, holographId, action) => {
    const confirmMsg = action === "accept"
      ? "Accept removal and lose access to this Holograph?"
      : "Decline and remain a Principal?";
    if (!window.confirm(confirmMsg)) return;
  
    try {
      const response = await apiFetch(`/api/holograph/${holographId}/principals/remove/${removalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      
  
      const result = await response.json();
      if (response.ok) {
        alert(result.message);
        fetchRemovalRequests(); // Refresh list
        router.refresh(); // Ensure access updates
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (err) {
      console.error("Error responding to removal:", err);
      alert("Failed to process request.");
    }
  };
  

  // Handle clicking on a holograph - update the current holograph ID in the session
  const handleHolographClick = async (holographId: string) => {
    debugLog("🔍 Clicking on holograph:", holographId);
    
    // Set the current holograph ID in the session
    await setCurrentHolographId(holographId);
    
    // Navigate to the holograph page
    router.push(`/holographs/${holographId}`);
  };

  if (error) {
    return (
      <div className="p-4 text-red-600 bg-red-50 rounded-lg">
        {error}
      </div>
    );
  }

  
  const pendingInvitations = invitations.filter(invite => invite.status === "Pending");
  const hasMessages = pendingInvitations.length > 0 || removalRequests.length > 0;

  return (
    <div className="p-4 max-w-6xl mx-auto">
     {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-lg p-6">
            {/* Close (X) Button */}
            <button
              onClick={() => setShowCreateForm(false)}
              className="absolute right-4 top-4 text-gray-500 hover:text-gray-700 transition"
            >
              <X size={20} />
            </button>

            {/* Modal Content */}
            <HolographForm
              mode="create"
              userId={session?.user?.id}
              onSuccess={() => {
                setShowCreateForm(false);
                router.refresh();
              }}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        </div>
      )}



  
      {hasMessages && (
        <div className="bg-white p-4 rounded-lg shadow border border-purple-300 mb-6">
          <h3 className="text-lg font-semibold mb-4">📩 Messages</h3>
  
          {/* Invitations Section */}
          <h4 className="text-md font-semibold mb-2">Invitations</h4>
          {pendingInvitations.length > 0 ? (
            pendingInvitations.map(invitation => (
              <div key={invitation.id} className="holograph-item flex justify-between items-center mb-2">
                <span>
                  Invitation to "{invitation.holographTitle}" as {invitation.role} by {invitation.inviterFirstName} {invitation.inviterLastName}
                </span>
                <div className='flex gap-2'>
                  <button
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                    onClick={() => handleAcceptInvite(invitation.id)}
                  >
                    Accept
                  </button>
                  <button
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    onClick={() => handleDeclineInvite(invitation.id)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 mb-4">No pending invitations.</p>
          )}
  
          {/* Principal Removal Requests Section */}
          <h4 className="text-md font-semibold mt-4 mb-2">Principal Removal Requests</h4>
          {removalRequests.length > 0 ? (
            removalRequests.map(req => (
              <div key={req.id} className="holograph-item flex justify-between items-center mb-2">
                <span>
                  You are being removed from "{req.holographTitle}" by {req.requestedBy.firstName} {req.requestedBy.lastName}
                </span>
                <div className='flex gap-2'>
                  <button
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    onClick={() => handleRemovalResponse(req.id, req.holographId, 'accept')}
                  >
                    Accept
                  </button>
                  <button
                    className="px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500"
                    onClick={() => handleRemovalResponse(req.id, req.holographId, 'decline')}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500">No pending removal requests.</p>
          )}
        </div>
      )}
  
    {isLoading ? (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    ) : (
      <>
        {/* My Holographs Section */}
        <div className="flex items-center mb-4">
          <h2 className="text-xl font-bold text-blue-800 flex items-center">
            <HolographIcon className="inline-block mr-2" /> My Holographs
          </h2>
          <button onClick={() => setShowCreateForm(true)} className="ml-4 text-black-600 hover:text-black-800 relative group">
            <CreateIcon className="inline-block" />
            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-max px-2 py-1 text-xs bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition">
              Create New Holograph
            </span>
          </button>
        </div>

        {/* Owned Holographs Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {holographs.owned.map(holograph => (
            <div key={holograph.id} onClick={() => handleHolographClick(holograph.id)}
            className="bg-white border-l-8 border-blue-500 p-6 rounded-xl shadow-md hover:bg-blue-50 hover:shadow-lg hover:scale-105 transition-transform cursor-pointer min-h-[200px]">
              <h3 className="text-blue-800 font-bold text-lg mb-2">{holograph.title}</h3>
              <p className="text-sm text-blue-900 font-semibold">Owner: {holograph.owner?.firstName} {holograph.owner?.lastName}</p>
              <p className="text-sm text-blue-900 font-semibold">Location: {holograph.geography}</p>
              <p className="text-sm text-blue-700">
                Principals:{" "}
                {holograph.principals.length > 0
                  ? holograph.principals.map(p => `${p.firstName} ${p.lastName}`).join(", ")
                  : "None"}
              </p>
              <p className="text-sm text-green-700">
                Delegates:{" "}
                {holograph.delegates.length > 0
                  ? holograph.delegates.map(d => `${d.firstName} ${d.lastName}`).join(", ")
                  : "None"}
              </p>
              <p className="text-sm text-gray-600 mb-1">Last modified: {format(new Date(holograph.updatedAt), "MMM d, yyyy")}</p>
            </div>
          ))}
        </div>

        {/* 🤝 Delegated Holographs Section */}
        <h2 className="text-xl font-bold text-green-800 mb-4"> <DelegatedIcon className="inline-block mr-2" /> Delegated Holographs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {holographs.delegated.map(holograph => (
          <div
            key={holograph.id}
            onClick={() => handleHolographClick(holograph.id)}
            className="bg-white border-l-8 border-green-500 p-6 rounded-xl shadow-md hover:bg-green-50 hover:shadow-lg hover:scale-105 transition-transform cursor-pointer min-h-[200px]">
            <h3 className="text-green-800 font-bold text-lg mb-2">{holograph.title}</h3>
            <p className="text-sm text-blue-900 font-semibold">
              Owner: {holograph.owner?.firstName} {holograph.owner?.lastName}
            </p>
            <p className="text-sm text-blue-900 font-semibold">Location: {holograph.geography}</p>
            <p className="text-sm text-blue-700">
              Principals:{" "}
              {holograph.principals?.length > 0
                ? holograph.principals.map(p => `${p.firstName} ${p.lastName}`).join(", ")
                : "None"}
            </p>
            <p className="text-sm text-green-700">
              Delegates:{" "}
              {holograph.delegates?.length > 0
                ? holograph.delegates.map(d => `${d.firstName} ${d.lastName}`).join(", ")
                : "None"}
            </p>
            <p className="text-sm text-gray-600 mb-1">
              Delegated On:{" "}
              {holograph.assignedAt
                ? format(new Date(holograph.assignedAt), "MMM d, yyyy")
                : "Unknown"}
            </p>
          </div>
        ))}
        </div>
      </>
    )}
    </div>
  );  
};

export default UserDashboard;
