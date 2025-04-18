// /src/app/_components/vital-documents/VitalDocumentsModal.tsx

"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { createPortal } from "react-dom";
import React from "react"; // ✅ Ensure React is imported
import { VITAL_DOCUMENT_TYPES } from "@/config/dropdowns";
import { debugLog } from "@/utils/debug";
import { buttonIcons } from '@/config/icons';
import { encryptFileInBrowser } from "@/utils/encryptionClient"; // ✅
import { fetchAesKey } from "@/utils/fetchAesKey";


interface VitalDocument {
  id: string;
  name: string;
  type: string;
  filePath?: string;
  notes?: string | null;
}

interface VitalDocumentModalProps {
  userId: string; // ✅ Changed from session to userId
  document?: VitalDocument | null;
  holographId: string;
  onClose: () => void;
  onSuccess: () => void;  // adding to make sure page refreshes when changes to vital document are made
}

export default function VitalDocumentModal({ userId, document: docData, holographId, onClose, onSuccess }: 
  VitalDocumentModalProps) { // adding onClose and onSuccess handlers  
  debugLog("🟢 VitalDocumentModal is rendering!"); // ✅ Debug log added

  const [mounted, setMounted] = useState(false); 
  // Only run on client-side after component mounts
  
  const SaveIcon = buttonIcons.save;
  const CloseIcon = buttonIcons.close;
  const sectionKey = "vitalDocuments"; //for the contents of the Vital Document Type drop-down list
  
  const [formData, setFormData] = useState({
    name: docData?.name || "",
    type: docData?.type || VITAL_DOCUMENT_TYPES.vitalDocuments[0].value, // Set default to first option
    notes: docData?.notes || "",
    file: null as File | null,
    filePath: docData?.filePath || "",  // ✅ Ensure existing file path is included
  });

  const [errors, setErrors] = useState<{ name?: string; file?: string }>({});

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  
  

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      console.warn("❌ No file selected or input was cleared.");
      return;
    }
    setFormData((prev) => ({ ...prev, file: files[0] }));
  };

  const handleSubmit = async () => {

    debugLog("📌 Document being edited:", docData);
    debugLog("📌 Document ID being sent:", docData?.id);

    const validationErrors: { name?: string; file?: string } = {};
    if (!formData.name.trim()) {
      validationErrors.name = "Document name is required.";
    }
    if (!formData.file && !formData.filePath) {
      validationErrors.file = "A file is required.";
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});  

    const formDataToSend = new FormData();
    formDataToSend.append("holographId", holographId);
    formDataToSend.append("name", formData.name);
    formDataToSend.append("type", formData.type);

    // ✅ Fix: Ensure notes are sent as null if empty
    if (formData.notes.trim() === "") {
        formDataToSend.append("notes", ""); // Store empty string instead of undefined/null
    } else {
        formDataToSend.append("notes", formData.notes);
    }

    // ✅ Fix: Ensure `id` is included when editing
    if (docData && docData.id) {
        formDataToSend.append("id", docData.id);
        debugLog("✅ Including document ID in FormData:", docData.id);
    } else {
        debugLog("⚠️ No document ID found, this might be a new document.");
    }
  
    // ✅ IMPORTANT FIX: Always include the existing file path if this is an edit operation
    if (docData && docData.filePath) {
      // Always send the existing file path when editing, regardless of whether a new file is selected
      formDataToSend.append("existingFilePath", docData.filePath);
      debugLog("✅ Including existingFilePath in FormData:", docData.filePath);
    }
  
    // ✅ If a new file is selected, send it
    if (formData.file) {
      try {
        const aesKey = await fetchAesKey(holographId);
        const encryptedBlob = await encryptFileInBrowser(formData.file, aesKey);
      
        formDataToSend.append("file", encryptedBlob, formData.file.name);
        formDataToSend.append("fileEncrypted", "true"); // 👈 tell the server it's already encrypted
      } catch (encryptionError) {
        console.error("❌ Failed to encrypt file in browser:", encryptionError);
        return;
      }
    }
  
    if (userId) {
      formDataToSend.append("uploadedBy", userId);
    } else {
      console.error("❌ No userId found, cannot upload document.");
      return;
    }
  
    debugLog("🟢 Sending Vital Document FormData:", Object.fromEntries(formDataToSend.entries()));
  
    try {
      const csrfToken = (await axios.get("/api/csrf-token")).data.csrfToken;
      await axios.post(`/api/vital-documents`, formDataToSend, {
        headers: {
          "Content-Type": "multipart/form-data",
          "x-csrf-token": csrfToken,
        },
      });
      if (onSuccess) {  // Add this check
        onSuccess();
      }
      onClose();
    } catch (error) {
      console.error("❌ Error uploading document:", error);
    }
  };
  

// Create modal content
// Create modal content with explicit styling
const modalContent = (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          {document ? "Edit Vital Document" : "Add New Vital Document"}
        </h2>
        
        {/* Document Name */}
        <label className="block text-gray-700 font-medium">Document Name *</label>
        <input
          type="text"
          className={`w-full p-3 border ${errors.name ? "border-red-500" : "border-gray-300"} rounded-lg`}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          onFocus={() => setErrors((prev) => ({ ...prev, name: undefined }))}
        />
        {errors.name && (
          <p className="text-sm text-red-500 mt-1">{errors.name}</p>
        )}

        {/* Document Type Dropdown */}
        <label className="block text-gray-700 font-medium mt-4">Document Type</label>
        <select
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
        >
          {VITAL_DOCUMENT_TYPES[sectionKey].map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        {/* Notes Input */}
        <label className="block text-gray-700 font-medium mt-4">Notes</label>
        <textarea
          className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Enter notes (optional)"
          value={formData.notes || ""}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />

        {/* File Upload */}
        <label className="block text-gray-700 font-medium mt-4">Upload File</label>
        <input
          type="file"
          className="w-full border border-gray-300 rounded-lg p-2"
          onChange={handleFileChange}
        />
        {!formData.file && formData.filePath && (
          <p className="text-gray-600 mt-2">Existing file: {formData.filePath.split('/').pop()}</p>
        )}
        {errors.file && (
          <p className="text-sm text-red-500 mt-1">{errors.file}</p>
        )}

        {/* Buttons */}
        <div className="mt-6 flex justify-end gap-4">
          <button
            onClick={handleSubmit}
            className="btn-save"
          >
            <SaveIcon className="w-4 h-4" />
            {docData ? "Update" : "Upload"}
          </button>
          <button
            onClick={onClose}
            className="btn-cancel"
          >
            <CloseIcon className="w-4 h-4" />
            Cancel
          </button>
        </div>
      </div>
    </div>
);
  
  if (!mounted || typeof window === "undefined" || !document.body) return null;
  return createPortal(modalContent, document.body);

}