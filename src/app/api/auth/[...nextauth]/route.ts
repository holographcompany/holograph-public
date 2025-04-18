// src/app/api/auth/[...nextauth]/route.ts

import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcrypt"; // ensure it's installed: `npm install bcrypt`

export const dynamic = "force-dynamic";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("⚡ authorize called with:", credentials?.email);

        if (!credentials?.email || !credentials?.password) {
          console.log("❌ Missing email or password");
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          console.log("❌ No user found for:", credentials.email);
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          console.log("❌ Invalid password for:", credentials.email);
          return null;
        }

        console.log("✅ Authentication succeeded for:", user.email);

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          firstName: user.firstName,  // Add this line
          lastName: user.lastName,    // Add this line
        };
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || "test-secret",
  session: { strategy: "jwt" },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.email = user.email;
        token.firstName = user.firstName; // Add this line
        token.lastName = user.lastName;   // Add this line
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.userId) {
        session.user = {
          id: token.userId,
          email: token.email,
          firstName: token.firstName, // Add this line
          lastName: token.lastName,   // Add this line
        };
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };
