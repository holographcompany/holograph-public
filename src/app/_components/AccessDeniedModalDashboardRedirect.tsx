// /src/app/_components/AccessDeniedModalDashboardRedirect.tsx

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface AccessDeniedModalDashboardRedirectProps {
  message?: string;
}

export default function AccessDeniedModalDashboardRedirect({ message }: AccessDeniedModalDashboardRedirectProps) {
  const router = useRouter();

  const handleClose = () => {
    router.push("/dashboard");
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-96 text-center">
        <h2 className="text-xl font-semibold text-red-600 mb-4">Access Denied</h2>
        <p className="text-gray-700">{message || "You are not authorized to view this Holograph."}</p>
        <button
          className="mt-6 btn-primary"
          onClick={handleClose}
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
