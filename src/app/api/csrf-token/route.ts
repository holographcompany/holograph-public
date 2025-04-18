// /src/app/api/csrf-token/route.ts

export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import Tokens from 'csrf';
import { debugLog } from '@/utils/debug';
import { withCors } from "@/utils/withCORS";


const tokens = new Tokens();

export const GET = withCors(async () => {
  const csrfSecret = await tokens.secret();
  const csrfToken = tokens.create(csrfSecret);

  const response = NextResponse.json({ csrfToken });

  response.cookies.set('csrfSecret', csrfSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60, // 1 hour
  });

  debugLog("🛡️ CSRF secret + token generated");

  return response;
});
