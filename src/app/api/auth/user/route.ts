// /src/app/api/auth/user/route.ts

export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { debugLog } from "../../../../utils/debug";

export async function GET() {
  try {
    debugLog("API Request: /api/auth/user");
    
    // Get session using NextAuth
    const session = await getServerSession(await getAuthOptions());
    
    if (!session || !session.user) {
      console.error("❌ No authenticated session found");
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    
    debugLog("Session found:", session.user);
    
    // Fetch user from database using the session user ID
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });
    
    if (!user) {
      console.error("❌ User not found in database:", session.user.id);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    debugLog("✅ User found:", user.id);
    return NextResponse.json({ user });
  } catch (error) {
    console.error('User fetch error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
