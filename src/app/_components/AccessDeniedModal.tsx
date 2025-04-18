// /src/app/_components/AccessDeniedModal.tsx

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";


interface AccessDeniedModalProps {
  holographId: string;
  holographTitle: string;
  sectionName: string;
}

export default function AccessDeniedModal({ holographId, holographTitle, sectionName }: AccessDeniedModalProps) {
  const router = useRouter();

  const handleClose = async () => {
    try {
      const res = await apiFetch(`/api/holograph/${holographId}`);
      if (res.ok) {
        router.push(`/holographs/${holographId}`);
      } else {
        router.push("/dashboard");
      }
    } catch {
      router.push("/dashboard");
    }
  };
  

  // Optional: Prevent background scrolling
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-96 text-center">
        <h2 className="text-xl font-semibold text-red-600 mb-4">Access Denied</h2>
        <p className="text-gray-700">
          You are not allowed to view <span className="font-semibold">{sectionName}</span> for <span className="font-semibold">{holographTitle}</span>.
        </p>
        <button
          className="mt-6 btn-primary"
          onClick={handleClose}
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
