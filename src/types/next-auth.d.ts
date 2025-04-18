// types/next-auth.d.ts

import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      firstName: string;           // ✅ Added
      lastName: string;            // ✅ Added
      accessToken?: string; // Optional access token
      currentHolographId?: string; // For storing the current holograph
    }
  }
  interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    name: string; // ✅ Required for NextAuth to pass to jwt()
    accessToken?: string; // Optional access token
  }
}

// This is necessary to add holographId to the JWT token
declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    accessToken?: string;
    currentHolographId?: string;
    csrfSecret?: string;
  }
}