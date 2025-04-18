// src/authmiddleware.ts

import { withAuth } from "next-auth/middleware";
import type { NextRequest } from "next/server";

export default withAuth({
  callbacks: {
    authorized: ({ token }) => {
      if (!token) return false;

      const now = Math.floor(Date.now() / 1000);
      const exp = (token as any).exp; // safely cast token.exp

      return typeof exp === "number" ? exp > now : false;
    },
  },
});


// Protect all routes that should require authentication
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/holographs/:path*",
    // Add any other protected routes
  ],
};