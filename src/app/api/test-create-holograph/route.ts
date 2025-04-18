// /src/app/api/test-create-holograph/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import Tokens from "csrf";
import { withCors, getCorsHeaders } from "@/utils/withCORS";

export const POST = withCors(async (req: NextRequest) => {
  console.log("✅ POST hit at /api/test-create-holograph");

  // 🔐 Step 1: CSRF check
  const csrfToken = req.headers.get("x-csrf-token");
  const cookie = req.cookies.get("csrfSecret")?.value;

  if (!csrfToken || !cookie) {
    console.log("❌ Missing CSRF token or cookie");
    return NextResponse.json({ error: "Missing CSRF token or cookie" }, { status: 403 });
  }

  const tokens = new Tokens();
  const valid = tokens.verify(cookie, csrfToken);

  if (!valid) {
    console.log("❌ Invalid CSRF token");
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  // 🔐 Step 2: Session validation
  const session = await getServerSession(await getAuthOptions());
  if (!session) {
    console.log("❌ No session found");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ✅ If we get here, both CSRF and session passed
  const body = await req.text();
  return NextResponse.json({
    success: true,
    message: "✅ All security checks passed.",
    user: session.user.email,
    body,
  });
});

export async function GET() {
  return NextResponse.json({
    message: "✅ GET test route reached",
    timestamp: new Date().toISOString(),
  });
}

export function OPTIONS(request: Request) {
  const origin = request.headers.get("origin") || "";
  const headers = getCorsHeaders(origin);
  const res = new Response(null, { status: 204 });
  for (const [key, value] of Object.entries(headers)) {
    res.headers.set(key, value);
  }
  return res;
}
