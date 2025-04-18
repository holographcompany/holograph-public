// /scr/app/_components/HelpDialog.tsx

"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/apiClient";

const getCsrfToken = async () => {
  const res = await apiFetch("/api/csrf-token");
  const { csrfToken } = await res.json();
  return csrfToken;
};



export default function HelpDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!question.trim()) return;

    setLoading(true);
    setResponse("");

    try {
      const csrfToken = await getCsrfToken();
      const res = await apiFetch("/api/ai-helper", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ question }),
      });


      const data = await res.json();
      setResponse(data.answer);
    } catch (error) {
      setResponse("Error fetching response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Minimized Help Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg"
        >
          Need Help?
        </button>
      )}

      {/* Expanded Help Window */}
      {isOpen && (
        <div className="w-80 p-4 bg-white border rounded shadow-lg">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">Ask AI Assistant</h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-600">
              ✖
            </button>
          </div>

          <textarea
            className="w-full p-2 border rounded"
            rows={3}
            placeholder="Ask about estate planning..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />

          <button
            onClick={handleSubmit}
            className="mt-2 bg-blue-600 text-white px-4 py-2 rounded w-full"
            disabled={loading}
          >
            {loading ? "Thinking..." : "Ask AI"}
          </button>

          {response && (
            <div className="mt-3 p-2 bg-gray-100 border rounded">
              <strong>AI Response:</strong>
              <p>{response}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
