// src/app/_components/SessionDebug.tsx
"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { debugLog } from "@/utils/debug";
import { apiFetch } from "@/lib/apiClient";


export default function SessionDebugger() {
  const { data: session, status } = useSession();
  const [visible, setVisible] = useState(false);
  const [serverSession, setServerSession] = useState(null);

  // Read environment variable
  const showDebugger = process.env.NEXT_PUBLIC_SHOW_DEBUGGER === "true";

  useEffect(() => {
    if (!showDebugger) return; // Prevent logging if debugger is disabled

    debugLog("=== SESSION DEBUGGER ===");
    debugLog("Status:", status);
    debugLog("Session:", session);
    debugLog("======================");

    // Also check server-side session
    const checkServerSession = async () => {
      try {
        const response = await apiFetch("/api/debug-session");
        if (response.ok) {
          const data = await response.json();
          debugLog("Server session:", data.session);
          setServerSession(data.session);
        }
      } catch (error) {
        console.error("Error fetching server session:", error);
      }
    };

    checkServerSession();
  }, [session, status, showDebugger]);

  if (!showDebugger || process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setVisible(!visible)}
        className="bg-gray-800 text-white px-4 py-2 rounded shadow"
      >
        {visible ? "Hide" : "Show"} Session Debug
      </button>

      {visible && (
        <div className="mt-2 p-4 bg-white border rounded shadow w-96 max-h-96 overflow-auto">
          <h3 className="font-bold mb-2">Client Session</h3>
          <div className="mb-4">
            <div>
              <strong>Status:</strong> {status}
            </div>
            <div>
              <strong>User ID:</strong> {session?.user?.id || "Not set"}
            </div>
            <div>
              <strong>Email:</strong> {session?.user?.email || "Not set"}
            </div>
            <div>
              <strong>Current Holograph ID:</strong>{" "}
              {session?.user?.currentHolographId || "Not set"}
            </div>
          </div>

          <h3 className="font-bold mb-2">Server Session</h3>
          <div>
            {serverSession ? (
              <>
                <div>
                  <strong>User ID:</strong> {serverSession.user?.id || "Not set"}
                </div>
                <div>
                  <strong>Email:</strong> {serverSession.user?.email || "Not set"}
                </div>
                <div>
                  <strong>Current Holograph ID:</strong>{" "}
                  {serverSession.user?.currentHolographId || "Not set"}
                </div>
              </>
            ) : (
              <p>No server session data</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
