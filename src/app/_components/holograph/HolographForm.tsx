// /src/app/_components/holograph/HolographForm.tsx

"use client";

import React, { useState } from 'react';
import { debugLog } from "../../../utils/debug";
import { buttonIcons } from '@/config/icons';
import { US_STATES } from '@/config/dropdowns';
import { apiFetch } from "@/lib/apiClient";


interface Holograph {
  id: string;
  title: string;
  geography?: string;
  lastModified: string;
  owner?: string;
}

interface HolographFormProps {
  mode: "create" | "edit";
  initialData?: { title: string; geography: string };
  userId: string;
  holographId?: string; // required for edit
  onSuccess?: (updatedHolograph: Holograph) => void | Promise<void>;
  onCancel?: () => void;
}

const HolographForm: React.FC<HolographFormProps> = ({
  mode,
  initialData,
  userId,
  holographId,
  onSuccess,
  onCancel
}) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [geography, setGeography] = useState(initialData?.geography || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const SaveIcon = buttonIcons.save;
  const CloseIcon = buttonIcons.close;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
  
    try {
      const endpoint =
        mode === 'create'
          ? '/api/holograph/create'
          : `/api/holograph/${holographId}/edit`;

      const csrfRes = await apiFetch("/api/csrf-token");
      const { csrfToken } = await csrfRes.json();
  
      // ✅ Use FormData
      const formData = new FormData();
      formData.append("title", title);
      formData.append("geography", geography);
  
      const response = await apiFetch(endpoint, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: {
          "x-csrf-token": csrfToken,
        },
        body: formData,
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Something went wrong. Please try again.");
        console.error("❌ API error:", errorData);
        setIsSubmitting(false);
        return;
      }
  
      const updatedHolograph = await response.json();
      debugLog(`✅ Holograph ${mode === "create" ? "created" : "updated"}:`, updatedHolograph);
  
      if (onSuccess) {
        onSuccess(updatedHolograph);
      }
  
    } catch (err) {
      console.error(`❌ Error ${mode === "create" ? "creating" : "updating"} holograph:`, err);
      setError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };
  

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        {mode === 'create' ? 'Create a new Holograph' : 'Edit Holograph'}
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-xl font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter Holograph title"
            required
          />
        </div>
        <div>
          <label htmlFor="geography" className="block text-xl font-medium text-gray-700 mb-1">
            Location (State or Territory)
          </label>
          <select
            id="geography"
            value={geography}
            onChange={(e) => setGeography(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select a state or territory</option>
            {US_STATES.map(({ label, value }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="btn-cancel"
              disabled={isSubmitting}
            >
              <CloseIcon className="w-4 h-4" />
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="btn-save-conditional"
            disabled={isSubmitting}
          >
            <SaveIcon className="w-4 h-4" />
            {isSubmitting ? (mode === 'create' ? 'Creating...' : 'Updating...') : (mode === 'create' ? 'Save' : 'Update')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default HolographForm;
