// src/lib/auth.ts

import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
// import { prisma } from "@/lib/db"; // loading prisma later
import { debugLog } from "@/utils/debug";
import bcrypt from "bcryptjs"; // ✅ Import bcryptjs
import Tokens from "csrf";

debugLog("AUTH OPTIONS LOADING");
const SESSION_MAX_AGE_SECONDS = 3600; // ← set to 60 for dev test, then 3600 for prod
debugLog("session length is", SESSION_MAX_AGE_SECONDS);

// ✅ Convert to a function that builds the options object
export async function getAuthOptions(): Promise<NextAuthOptions> {

  debugLog("get auth options called session max seconds = ", SESSION_MAX_AGE_SECONDS);

  const { prisma } = await import("@/lib/db");

  return {
    adapter: PrismaAdapter(prisma),
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      }),
      CredentialsProvider({
        name: "Credentials",
        credentials: {
          email: { label: "Email", type: "text" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          if (!credentials?.email) throw new Error("Invalid credentials");
          const { prisma } = await import("@/lib/db");
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });
          if (!user) throw new Error("No user found");

          const isValid = await bcrypt.compare(credentials.password, user.password);
          if (!isValid) throw new Error("Invalid password");

          return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            //name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(), // ✅ Trim to avoid "undefined undefined"
          };          
        },
      }),
    ],
    session: {
      strategy: "jwt",
      maxAge: SESSION_MAX_AGE_SECONDS, //1 min timeout test.
      updateAge: 0, //15 * 60,    // session is extended on activity
    },
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
      async jwt({ token, user, trigger, session }) {
        debugLog("✅ JWT Callback Triggered");
        const now = Math.floor(Date.now() / 1000);
        token.exp = now + SESSION_MAX_AGE_SECONDS;
        debugLog("token exp = ", token.exp);
      
        if (user) {
          debugLog("🧠 JWT user object received:", user);
          
          const firstName = user.firstName || "Missing";
          const lastName = user.lastName || "";
      
          token.userId = user.id;
          token.email = user.email;
          token.firstName = firstName;
          token.lastName = lastName;
          token.csrfSecret = new Tokens().secretSync();
      
          debugLog("📦 token after login set:", token);
        }
      
        // ✅ Always log current token state
        debugLog("📦 token returning:", token);
        return token;
      },
      async session({ session, token }) {
        debugLog("✅ Session Callback Triggered");
        debugLog("📦 token received in session():", token);
      
        session.user = {
          id: token.userId as string,
          email: token.email as string,
          firstName: token.firstName || "MISSING",
          lastName: token.lastName || "MISSING",
          //name: `${token.firstName ?? ""} ${token.lastName ?? ""}`,
        };
      
        if (token.currentHolographId) {
          session.user.currentHolographId = token.currentHolographId;
        }
      
        session.csrfSecret = token.csrfSecret;
        return session;
      }
      
    },
    cookies: {
      sessionToken: {
        name:
          process.env.NODE_ENV === "production"
            ? "__Secure-next-auth.session-token"
            : "next-auth.session-token",
        options: {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        },
      },
    },
    debug: process.env.NODE_ENV !== "production",
  };
}

debugLog("AUTH OPTIONS LOADED SUCCESSFULLY");

