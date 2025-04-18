// /src/app/dashboard/page.tsx - this is the REAL User Dashboard page, the one that incorporates 
// /_components\UserDashboard.tsx where a user sees all of their owned and delegated holographs, invitations, etc.

import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import React from 'react'
import UserDashboard from "../_components/UserDashboard";
import { debugLog } from "@/utils/debug";
import { buttonIcons } from "@/config/icons";


interface User {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
}

export default async function Dashboard() {
  // checking if session exists if not redirect to login
  const session = await getServerSession(await getAuthOptions());
  if (!session) {
    redirect("/login");
  }
  const user = session.user;  // user logged in 

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-10 bg-gray-50 min-h-screen font-sans">
        <div className="grid grid-cols-1 gap-8">
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            {/* Holograph Dashboard */}
            {user && <UserDashboard userId={user.id} />}
          </div>
        </div>
    </div>
  )
}