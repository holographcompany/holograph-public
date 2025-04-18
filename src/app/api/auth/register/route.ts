// /src/app/api/auth/register/route.ts

export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { hash } from 'bcrypt'
import { prisma } from '@/lib/db'
import { debugLog } from '@/utils/debug'
import { userRegistrationSchema } from '@/validators/userSchema';
import { ZodError } from "zod";
import { withCors, getCorsHeaders } from "@/utils/withCORS";

debugLog("🧪 /api/auth/register handler file loaded");

export const POST = withCors(async (req: Request) => {
  try {
    const body = await req.json();

    // ✅ Validate with Zod
    try {
      userRegistrationSchema.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json({ errors: err.errors }, { status: 400 });
      }
      throw err;
    }

    const { email, password, firstName, lastName } = body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await hash(password, 12)

    // Create user with firstName and lastName
    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        password: hashedPassword
      }
    })

    debugLog("🔐 Registering user:", { email, firstName, lastName });
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }
    })

  } catch (error: any) {
    console.error('❌ Registration error:', error)
  
    // Log known Prisma issue, if any
    if (error.code) {
      console.error('🧠 Prisma Error Code:', error.code)
    }
  
    // Full stack (in case it's a logic or connection issue)
    console.error('📛 Stack trace:', error.stack)
  
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    )
  }
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
