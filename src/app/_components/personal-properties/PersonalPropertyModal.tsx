// /src/app/_components/personal-properties/PersonalPropertyModal.tsx

"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import { createPortal } from "react-dom";
import { debugLog } from "@/utils/debug";
import { buttonIcons } from "@/config/icons";
import { encryptFileInBrowser } from "@/utils/encryptionClient"; // ✅
import { fetchAesKey } from "@/utils/fetchAesKey";

interface PersonalProperty {
  id?: string;
  name: string;
  notes?: string | null;
  filePath?: string;
}

interface PersonalPropertyModalProps {
  userId: string;
  personalProperty?: PersonalProperty | null;
  holographId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PersonalPropertyModal({
  userId,
  personalProperty,
  holographId,
  onClose,
  onSuccess,
}: PersonalPropertyModalProps) {
  const [mounted, setMounted] = useState(false);

  const SaveIcon = buttonIcons.save;
  const CloseIcon = buttonIcons.close;

  const [formData, setFormData] = useState({
    name: personalProperty?.name || "",
    notes: personalProperty?.notes || "",
    file: null as File | null,
    filePath: personalProperty?.filePath || "",
  });

  const [errors, setErrors] = useState<{ name?: string; }>({});


  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }
    setFormData((prev) => ({ ...prev, file: files[0] }));
  };

  // allows the user to delete a file attached to a personal property record without deleting the whole record.
  const handleFileDelete = async () => {
    if (!personalProperty?.id) return;
  
    const isConfirmed = window.confirm("Are you sure you want to delete this file? This action cannot be undone.");
    if (!isConfirmed) return;
  
    try {
      const csrfToken = (await axios.get("/api/csrf-token")).data.csrfToken;
      await axios.delete(`/api/personal-properties/${personalProperty.id}?fileOnly=true`, {
        headers: {
          "x-csrf-token": csrfToken,
        },
      });
  
      // ✅ Clear local file and filePath state
      setFormData((prev) => ({
        ...prev,
        file: null,
        filePath: "",
      }));
      
      // ✅ Trigger parent page refresh
      onSuccess(); 
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };
  

  const handleSubmit = async () => {
    const validationErrors: { name?: string; } = {};
    if (!formData.name.trim()) {
      validationErrors.name = "Personal Property name is required.";
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    const formDataToSend = new FormData();
    formDataToSend.append("holographId", holographId);
    formDataToSend.append("name", formData.name);
    formDataToSend.append("notes", formData.notes || "");

    if (personalProperty?.id) {
      formDataToSend.append("id", personalProperty.id); // ✅ Ensure ID is sent for updates
    }

    if (formData.filePath) {
      formDataToSend.append("existingFilePath", formData.filePath);
    }    

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
      console.error("❌ No userId found.");
      return;
    }

    debugLog("🟢 Sending Personal Property FormData:", Object.fromEntries(formDataToSend.entries()));

    try {
      const csrfToken = (await axios.get("/api/csrf-token")).data.csrfToken;
      await axios.post(`/api/personal-properties`, formDataToSend, {
        headers: {
          "Content-Type": "multipart/form-data",
          "x-csrf-token": csrfToken,
        },
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error("❌ Error saving personal property:", error);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          {personalProperty ? "Edit Personal Property" : "Add New Personal Property"}
        </h2>

        {/* Personal Property Name */}
        <label className="block text-gray-700 font-medium">Property Name *</label>
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

        {/* Notes */}
        <label className="block text-gray-700 font-medium mt-4">Notes</label>
        <textarea
          className="w-full p-3 border border-gray-300 rounded-lg"
          value={formData.notes || ""}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />

        {/* File Upload */}
        <label className="block text-gray-700 font-medium mt-4">Upload File</label>
        <input type="file" className="w-full border p-2" onChange={handleFileChange} />
        {!formData.file && formData.filePath && (
          <div className="flex items-center justify-between mt-2">
            <p className="text-sm text-gray-500 mt-1">
              Existing file: {formData.filePath.split("/").pop()}
            </p>
            <button
              onClick={handleFileDelete}
              className="text-red-500 hover:text-red-700 text-sm ml-2"
            >
              Delete File
            </button>
          </div>
        )}

        {/* Buttons */}
        <div className="mt-6 flex justify-end gap-4">
          <button onClick={handleSubmit} className="btn-save">
            <SaveIcon className="w-4 h-4" />
            {personalProperty ? "Update" : "Save"}
          </button>
          <button onClick={onClose} className="btn-cancel">
            <CloseIcon className="w-4 h-4" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
