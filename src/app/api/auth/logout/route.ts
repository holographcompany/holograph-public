// /src/api/auth/logout/route.ts

export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { debugLog } from '@/utils/debug'
import { withCors, getCorsHeaders } from "@/utils/withCORS";


export const POST = withCors(async () => {
  const response = NextResponse.json(
    { success: true },
    { status: 200 }
  )

  // Clear the auth cookie
  response.cookies.delete('auth-token')

  return response
});

export function OPTIONS(request: Request) {
  const origin = request.headers.get("origin") || "";
  const headers = getCorsHeaders(origin);
  const res = new Response(null, { status: 204 });

  for (const [key, value] of Object.entries(headers)) {
    res.headers.set(key, value);
  }

  return res;
}
