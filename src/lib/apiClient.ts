// /src/lib/apiClient.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ""; // same-origin if not set

if (!API_BASE_URL) {
  console.warn("⚠️ Warning: NEXT_PUBLIC_API_URL is not defined!");
}

/**
 * Makes a full API call to your backend, including credentials (cookies).
 */
export async function apiFetch(path: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${path}`;

  return fetch(url, {
    ...options,
    credentials: "include", // ✅ always send session cookies
  });
}
