// /src/app/holographs/[id]/home-services/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import axios from "axios";
import HomeServiceModal from "@/app/_components/home-services/HomeServiceModal";
import { useHolograph } from "@/hooks/useHolograph";
import { useSectionAccess } from "@/hooks/useSectionAccess";
import AccessDeniedModal from "@/app/_components/AccessDeniedModal";
import { buttonIcons } from "@/config/icons";
import { debugLog } from "@/utils/debug";
import { apiFetch } from "@/lib/apiClient";

interface HomeService {
  id: string;
  name: string;
  filePath?: string;
  notes?: string | null;
}

export default function HomeServicePage() {
  const { id: holographId } = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { userId, isAuthenticated, isLoading: isHolographLoading } = useHolograph();

  const { isAuthorized, accessDenied, holographTitle, sectionName, isLoading: isAccessLoading } = useSectionAccess("home-services");

  const [accounts, setAccounts] = useState<HomeService[]>([]);
  const [signedUrls, setSignedUrls] = useState<{ [key: string]: string }>({});
  const [selectedAccount, setSelectedAccount] = useState<HomeService | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPrincipal, setIsPrincipal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);


  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const response = await apiFetch(`/api/home-services?holographId=${holographId}`);
        const data = await response.json();
        setAccounts(data);
      } catch (err) {
        console.error("❌ Failed to load Home Services", err);
      } finally {
        setIsLoading(false);
      }
    }

    if (userId && holographId) fetchAccounts();
  }, [holographId, userId]);

  useEffect(() => {
    const fetchUrls = async () => {
      const urls: { [key: string]: string } = {};
      for (const acc of accounts) {
        if (acc.filePath) {
          try {
            const res = await apiFetch(`/api/generate-signed-url?filePath=${encodeURIComponent(acc.filePath)}&holographId=${encodeURIComponent(holographId)}&section=home-services`);
            const data = await res.json();
            urls[acc.id] = data.url;

          } catch (err: any) {
            const message =
              err?.response?.data?.error ||
              err?.response?.data ||
              err?.message ||
              "Unknown error";
          
            console.error("❌ Error getting signed URL for", acc.name, message);
          }
          
        }
      }
      setSignedUrls(urls);
    };

    if (accounts.length > 0) fetchUrls();
  }, [accounts, holographId]);

  useEffect(() => {
    const checkPrincipal = async () => {
      if (!holographId || !userId) return;
      try {
        const response = await axios.get(`/api/holograph/${holographId}`);
        const isUserPrincipal = response.data.principals.some((p: any) => p.id === userId);
        setIsPrincipal(isUserPrincipal);
      } catch (err) {
        console.error("Error checking principal status:", err);
      }
    };
    checkPrincipal();
  }, [holographId, userId]);

  const openModal = (account: HomeService | null) => {
    setSelectedAccount(account);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedAccount(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this Home Service?")) return;
    try {
      const csrfToken = (await axios.get("/api/csrf-token")).data.csrfToken;
      await apiFetch(`/api/home-services/${id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken }
      });      
      
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("❌ Failed to delete", err);
    }
  };

  const refresh = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`/api/home-services?holographId=${holographId}`, { withCredentials: true });
      setAccounts(response.data);
    } catch (err) {
      console.error("❌ Refresh error", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (
    status === "loading" ||
    isHolographLoading ||
    isAccessLoading ||
    (isLoading && accounts.length === 0)
  ) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800"></div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <AccessDeniedModal
        holographId={holographId as string}
        holographTitle={holographTitle}
        sectionName={sectionName || "this section"}
      />
    );
  }

  return (
    <div className="flex gap-6 p-8 max-w-6xl mx-auto">
      {/* Left: Actions and Info */}
      <div className="w-1/3 bg-white shadow-lg p-6 rounded-lg">
        <div className="flex flex-col gap-4">
          {isPrincipal && <button className="btn-primary" onClick={() => openModal(null)}>+ Add Home Service</button>}
          <button className="btn-secondary" onClick={() => router.push(`/holographs/${holographId}`)}>← Back to Holograph</button>
        </div>
        <div className="mt-6 text-gray-700 text-sm space-y-2">
          {isPrincipal ? (
            <>
              <p>Use this section to list Home Services such as landscaper, plumber, electrician, house cleaning and others for each property you own or rent.</p>
              <p>You may also upload a document for each home service with additional information. </p>
              <p>Be sure to include a phone number and/or website for your home service providers. </p>
            </>
          ) : (
            <p className="italic">
              You can view Home Services shared with you.
            </p>
          )}
        </div>
      </div>

      {/* Right: Table of accounts */}
      <div className="w-2/3 bg-white shadow-lg p-6 rounded-lg">
        <h2 className="text-xl font-semibold text-gray-800">Home Services</h2>
        {isLoading ? (
          <p>Loading...</p>
        ) : accounts.length === 0 ? (
          <p className="text-gray-500">No home services added yet.</p>
        ) : (
          <table className="w-full mt-4 border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-3 border border-gray-300">Home Service Name</th>
                <th className="p-3 border border-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.id} className="border-t">
                  <td className="p-3 border border-gray-300">{acc.name}</td>
                  <td className="p-3 border border-gray-300 flex gap-3">
                    {acc.filePath && (
                      <a
                        href={`/api/proxy-download?filePath=${encodeURIComponent(acc.filePath)}&holographId=${holographId}&filename=${encodeURIComponent(acc.filePath.split("/").pop() || "document")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        <buttonIcons.link size={18} />
                      </a>           
                    )}

                    {acc?.notes && (
                      <button
                        className="ml-2 text-gray-600 hover:text-gray-800 text-sm relative group"
                        onClick={() => setSelectedNote(acc.notes || "No notes available")}
                      >
                        <span>{buttonIcons.info && <buttonIcons.info size={18} />}</span>
                        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-max px-2 py-1 text-xs bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition">
                          View Notes
                        </span>
                      </button>
                    )}   

                    {isPrincipal && (
                      <>
                        <button className="text-yellow-600" onClick={() => openModal(acc)}>
                          <buttonIcons.edit size={18} />
                        </button>
                        <button className="text-red-600" onClick={() => handleDelete(acc.id)}>
                          <buttonIcons.delete size={18} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && userId && (
        <HomeServiceModal
          userId={userId}
          account={selectedAccount}
          holographId={holographId as string}
          onClose={closeModal}
          onSuccess={refresh}
        />
      )}

      {selectedNote !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`bg-white p-6 rounded-lg shadow-lg ${isExpanded ? 'max-w-5xl w-full h-[90vh]' : 'max-w-md w-full max-h-[80vh]'} overflow-y-auto relative transition-all duration-300`}>
            <h2 className="text-lg font-semibold mb-4">Home Service Notes</h2>
            <p className="text-sm whitespace-pre-wrap">{selectedNote}</p>

            {/* Toggle Buttons */}
            <div className="mt-6 flex justify-between items-center">
              <button
                className="btn-save"
                onClick={() => setSelectedNote(null)}
              >
                Close
              </button>
              <button
                className="btn-cancel"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? "Shrink" : "Expand"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
