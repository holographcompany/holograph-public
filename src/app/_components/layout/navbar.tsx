// /src/app/_components/layout/navbar.tsx

'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { debugLog } from '@/utils/debug'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  React.useEffect(() => {
    update(); // force refresh the session at mount
  }, []);
  const { data: session, status, update } = useSession();
  
  
  // Log session data for debugging
  React.useEffect(() => {
    debugLog("Navbar - Session Status:", status);
    debugLog("Navbar - Session Data:", session);
  }, [session, status]);

  const handleLogout = async () => {
    try {
      // Use NextAuth's signOut instead of custom API
      await signOut({ redirect: false });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  // Determine if user is authenticated
  const isAuthenticated = status === 'authenticated' && session?.user;
  //const firstName = session?.user?.firstName || "User";

  const firstName = session?.user?.firstName ?? session?.user?.email ?? "User";



  return (
    <nav className="bg-slate-400 shadow-md sticky top-0 z-50 font-sans">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
        <div className="flex justify-between items-center h-16">
        {/* 🔹 Logo on the left */}
        <Link href={isAuthenticated ? "/dashboard" : "/"}>
          <img 
            src="/images/holograph_logo_square.png"
            alt="Holograph Logo"
            className="h-14 w-14 mr-4"
          />
        </Link>
        {isAuthenticated ? (
          <Link 
            href="/dashboard" 
            className="text-2xl font-bold text-gray-800 hover:text-gray-600 transition"
          >
            Welcome {firstName}
          </Link>
        ) : (
          <div className="text-2xl font-bold text-gray-800">Holograph</div>
        )}

          <div className="flex items-center gap-6">
            {isAuthenticated ? (
              <>
                <Link 
                  href="/dashboard" 
                  className={`px-4 py-2 rounded-md text-lg font-medium ${
                    pathname === '/dashboard' 
                      ? 'text-blue-900 border-b-2 border-blue-600' 
                      : 'text-gray-900 hover:text-gray-800'
                  }`}
                >
                  Dashboard
                </Link>
                <Link 
                  href="/documents" 
                  className={`px-4 py-2 rounded-md text-lg font-medium ${
                    pathname === '/documents' 
                      ? 'text-blue-900 border-b-2 border-blue-600' 
                      : 'text-gray-900 hover:text-gray-800'
                  }`}
                >
                  Documents
                </Link>

                {/* 🔹 Profile Link */}
                <Link 
                  href="/dashboard/user-profile"
                  className={`px-4 py-2 rounded-md text-lg font-medium ${
                    pathname === '/dashboard/user-profile'
                      ? 'text-blue-900 border-b-2 border-blue-600'
                      : 'text-gray-900 hover:text-gray-800'
                  }`}
                >
                  Profile
                </Link>

                <Link 
                  href="/dashboard/billing"
                  className={`px-4 py-2 rounded-md text-lg font-medium ${
                    pathname === '/dashboard/billing'
                      ? 'text-blue-900 border-b-2 border-blue-600'
                      : 'text-gray-900 hover:text-gray-800'
                  }`}
                >
                  Billing
                </Link>


                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-lg font-medium text-gray-600 hover:text-red-600 transition"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link 
                  href="/login"
                  className="px-4 py-2 text-lg font-medium text-gray-600 hover:text-gray-800"
                >
                  Login
                </Link>
                <Link 
                  href="/register"
                  className="px-5 py-2 rounded-md text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>

  )
}