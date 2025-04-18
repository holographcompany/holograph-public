// /src/utils/withCors.ts

import { NextRequest, NextResponse } from "next/server";

export const allowedOrigins = [
  "http://localhost:3000",                // ✅ Local development
  "https://www.holographcompany.com",     // ✅ Production custom domain
];

export function getCorsHeaders(origin: string): Record<string, string> {
  const isAllowed =
    allowedOrigins.includes(origin) ||
    origin?.endsWith(".vercel.app") ||
    origin === "https://www.holographcompany.com" ||
    origin === "https://holographcompany.com";

  const allowOrigin = isAllowed ? origin : "http://localhost:3000";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-csrf-token",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}


export function withCors<T extends Request | NextRequest>(
  handler: (...args: any[]) => Promise<Response | NextResponse>
) {
  return async function wrappedHandler(...args: any[]): Promise<Response | NextResponse> {
    const req = args[0]; // First argument is always the request
    const res = await handler(...args);
    const origin = req.headers.get("origin") || "";
    const headers = getCorsHeaders(origin);

    for (const [key, value] of Object.entries(headers)) {
      res.headers.set(key, value);
    }

    return res;
  };
}
