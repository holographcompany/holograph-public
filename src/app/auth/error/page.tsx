// src/app/auth/error/page.tsx

"use client";

export const dynamic = "force-dynamic";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function ErrorContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) setError(errorParam);
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white shadow-lg rounded-xl p-6 max-w-md w-full border border-red-200">
        <h1 className="text-2xl font-bold text-red-600 mb-2">Login Failed</h1>
        <p className="text-gray-700 mb-4">
          There was an issue signing in. Please try again or contact support.
        </p>
        {error && (
          <div className="text-sm text-gray-500">
            <strong>Error code:</strong> <code>{error}</code>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <ErrorContent />
    </Suspense>
  );
}
