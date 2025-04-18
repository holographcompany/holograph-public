// /src/app/holographs/[id]/vital-documents/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import VitalDocumentModal from "@/app/_components/vital-documents/VitalDocumentModal";
import { VITAL_DOCUMENT_TYPES } from "@/config/vitalDocumentType";
import { useSession } from "next-auth/react";
import { useHolograph } from "@/hooks/useHolograph"; // Import useHolograph hook
import SessionDebug from "../../../_components/SessionDebug"; // Optional, for debugging
import { debugLog } from "@/utils/debug";
import { buttonIcons } from "../../../../config/icons"; // ✅ Import standardized icons
import { useSectionAccess } from "@/hooks/useSectionAccess";
import AccessDeniedModal from "@/app/_components/AccessDeniedModal";



interface Document {
  id: string;
  name: string;
  holographId: string;
  type: string;
  filePath: string;
  notes: string | null;
  createdAt: string;
}

export default function VitalDocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { currentHolographId, userId, isAuthenticated, isLoading: isHolographLoading } = useHolograph();
  
  // Use the holographId from the URL params
  const holographId = params.id as string;
  // make sure only authorized users can see this page
  const { isAuthorized, isLoading: isAccessLoading, accessDenied, holographTitle, sectionName } = useSectionAccess("vital-documents");


  const [documents, setDocuments] = useState<Document[]>([]);
  const [signedUrls, setSignedUrls] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPrincipal, setIsPrincipal] = useState<boolean>(false);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);


  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    const checkPrincipalStatus = async () => {
      if (!holographId || !userId) return;
      try {
        const response = await axios.get(`/api/holograph/${holographId}`);
        const holographData = response.data;
        const isUserPrincipal = holographData.principals.some((p: any) => p.id === userId);
        setIsPrincipal(isUserPrincipal);
      } catch (error) {
        console.error("❌ Error verifying principal status:", error);
      }
    };

    checkPrincipalStatus();
  }, [holographId, userId]);
  

  // Fetch documents
  useEffect(() => {
    async function fetchDocuments() {
      if (!holographId || !userId) return;
      
      try {
        debugLog(`🚀 Fetching Vital Documents for Holograph ${holographId}`);
        
        // Use session-based authentication without URL parameters
        const response = await axios.get(`/api/vital-documents?holographId=${holographId}`, {
          withCredentials: true,
        });

        if (response.data.length > 0) {
          debugLog("✅ Retrieved Documents:", response.data);
          setDocuments(response.data);
        } else {
          console.warn("⚠️ No documents found.");
        }
      } catch (error) {
        console.error("❌ Error loading document:", error);
      } finally {
        setIsLoading(false);
      }
    }

    if (userId && holographId) {
      fetchDocuments();
    }
  }, [holographId, userId]);

  // Fetch signed URLs for documents
  useEffect(() => {
    async function fetchSignedUrls() {
      if (documents.length === 0) return;

      debugLog("🚀 Fetching signed URLs for documents...");

      const urls: { [key: string]: string } = {};
      for (const doc of documents) {
        try {
          // Use withCredentials to send authentication cookies
          const response = await axios.get(
            `/api/generate-signed-url?filePath=${encodeURIComponent(doc.filePath)}&holographId=${encodeURIComponent(holographId)}&section=vital-documents`,
            { withCredentials: true }
          );
          urls[doc.id] = response.data.url;
        } catch (error) {
          console.error(`❌ Error fetching signed URL for ${doc.name}:`, error);
        }
      }

      setSignedUrls(urls);
      debugLog("✅ Signed URLs retrieved:", urls);
    }

    if (documents.length > 0) {
      fetchSignedUrls();
    }
  }, [documents, holographId]);

  const openModal = (document: Document | null) => {
    debugLog("🟢 openModal triggered! Document:", document);
    if (document) {
      setSelectedDocument({ 
        ...document, 
        newFile: null,
        filePath: document.filePath || "",
        id: document.id,  // ✅ Explicitly include ID
      } as Document & { newFile?: File | null, filePath?: string });
    } else {
      setSelectedDocument(null);
    }
    setIsModalOpen(true);
    debugLog("🟢 isModalOpen set to TRUE");
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedDocument(null);
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const csrfToken = (await axios.get("/api/csrf-token")).data.csrfToken;
      await axios.delete(`/api/vital-documents/${documentId}`, {
        headers: {
          "x-csrf-token": csrfToken,
        },
      });

      setDocuments((prevDocs) => prevDocs.filter((doc) => doc.id !== documentId));
    } catch (error) {
      console.error("Error deleting document:", error);
    }
  };

  // Function to refresh documents
  const refreshDocuments = async () => {
    try {
      setIsLoading(true);
      debugLog(`🔄 Refreshing Vital Documents for Holograph ${holographId}`);
      
      const response = await axios.get(`/api/vital-documents?holographId=${holographId}`, {
        withCredentials: true,
      });

      if (response.data.length > 0) {
        debugLog("✅ Retrieved Documents:", response.data);
        setDocuments(response.data);
      } else {
        console.warn("⚠️ No documents found.");
      }
    } catch (error) {
      console.error("❌ Error loading documents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (
    status === 'loading' || 
    isHolographLoading || 
    isAccessLoading || 
    (isLoading && documents.length === 0)
  ) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800"></div>
      </div>
    );
  }
  
  if (status === 'unauthenticated') return <p>Please log in</p>;
  if (accessDenied) {
    return (
      <AccessDeniedModal 
        holographId={holographId}
        holographTitle={holographTitle}
        sectionName={sectionName || "this section"}
      />
    );
  }

  return (
    <div className="flex gap-6 p-8 max-w-6xl mx-auto">
      {/* Left Section: Controls & Instructions */}
      <div className="w-1/3 bg-white shadow-lg p-6 rounded-lg">
        <div className="mt-4 flex flex-col gap-4">
          {isPrincipal && (
            <button className="btn-primary" onClick={() => openModal(null)}>
              + Add New Vital Document
            </button>
          )}
          <button className="btn-secondary" onClick={() => router.push(`/holographs/${holographId}`)}>← Back to Holograph</button>
        </div>
        <div className="mt-6 text-gray-700 text-sm space-y-2">
          {isPrincipal ? (
            <>
              <p>Upload a scanned copy of your will, trust, funeral plan, and advance healthcare directive documents.</p>
              <p>You may also upload other important documents such as:</p>
              <ul className="list-disc pl-4">
                <li>Pet information</li>
                <li>Medical care documents</li>
                <li>Other transition-related instructions</li>
              </ul>
            </>
          ) : (
            <p className="italic">
              You can view and download Vital Documents shared with you.
            </p>
          )}
        </div>

      </div>

      {isModalOpen && userId && (
        <VitalDocumentModal 
          userId={userId}
          document={selectedDocument}
          holographId={holographId} 
          onClose={closeModal}
          onSuccess={() => window.location.reload()} // Refresh after modal action
        />
      )}

      {/* Right Section: Document Table */}
      <div className="w-2/3 bg-white shadow-lg p-6 rounded-lg">
        <h2 className="text-xl font-semibold text-gray-800">Vital Documents</h2>
        {isLoading ? (
          <p className="text-gray-600">Loading...</p>
        ) : documents.length === 0 ? (
          <p className="text-gray-500">No documents added yet.</p>
        ) : (
          <table className="w-full mt-4 border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-3 border border-gray-300">Document Name</th>
                <th className="p-3 border border-gray-300">Type</th>
                <th className="p-3 border border-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-t">
                  <td className="p-3 border border-gray-300">{doc.name}</td>
                  <td className="p-3 border border-gray-300">{VITAL_DOCUMENT_TYPES.vitalDocuments.find((d) => d.value === doc.type)?.label || doc.type}</td>
                  <td className="p-3 border border-gray-300 flex gap-3">

                    {/* ✅ Standardized Download Button */}
                    <button className="ml-2 text-blue-600 hover:text-blue-800 text-sm relative group">
                      <a
                        href={`/api/proxy-download?filePath=${encodeURIComponent(doc.filePath)}&holographId=${holographId}&filename=${encodeURIComponent(doc.filePath.split("/").pop() || "document")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        <buttonIcons.link size={18} />
                        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-max px-2 py-1 text-xs bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition">
                          Download Vital Document
                        </span>
                      </a>
                    </button>
                    {doc?.notes && (
                      <button
                        className="ml-2 text-gray-600 hover:text-gray-800 text-sm relative group"
                        onClick={() => setSelectedNote(doc.notes || "No notes available")}
                      >
                        <span><buttonIcons.info size={18} /></span>
                        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-max px-2 py-1 text-xs bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition">
                          View Notes
                        </span>
                      </button>
                    )}

                    {isPrincipal && (
                      <>
                        {/* Edit Button */}
                        <button 
                          className="ml-2 text-yellow-600 hover:text-yellow-800 text-sm relative group" 
                          onClick={() => {
                            debugLog("🟢 Opening modal with document:", doc);  // ✅ Debugging
                            openModal(doc)
                          }}
                        >
                          <span><buttonIcons.edit size={18} /></span>
                          <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-max px-2 py-1 text-xs bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition">
                            Edit Vital Document
                          </span>
                        </button>

                        {/* Delete Button */}
                        <button className="ml-2 text-red-600 hover:text-red-800 text-sm relative group" onClick={() => handleDelete(doc.id)}>
                          <span><buttonIcons.delete size={18} /></span>
                          <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-max px-2 py-1 text-xs bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition">
                            Delete Vital Document
                          </span>
                        </button>
                      </>
                    )}

                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
          {selectedNote !== null && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className={`bg-white p-6 rounded-lg shadow-lg ${isExpanded ? 'max-w-5xl w-full h-[90vh]' : 'max-w-md w-full max-h-[80vh]'} overflow-y-auto relative transition-all duration-300`}>
                <h2 className="text-lg font-semibold mb-4">Document Notes</h2>
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
    </div>
  );
}
