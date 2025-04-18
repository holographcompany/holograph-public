// /src/app/dashboard/billing/page.tsx

import React from "react";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function BillingPage() {
  const session = await getServerSession(await getAuthOptions());

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-6">Billing & Subscription</h1>

      <div className="bg-white shadow-md rounded-lg p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Current Plan</h2>
          <p className="text-gray-700">You are currently on the <span className="font-medium">Free Plan</span>.</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">Payment Method</h2>
          <p className="text-gray-700 mb-4">No payment method on file.</p>

          {/* Credit Card Logos */}
          <div className="flex items-center gap-4">
            <Image src="/images/visa_logo.svg" alt="Visa" width={60} height={40} />
            <Image src="/images/mastercard_logo.svg" alt="Mastercard" width={60} height={40} />
            <Image src="/images/amex_logo.svg" alt="Amex" width={60} height={40} />
            <Image src="/images/discover_logo.svg" alt="Amex" width={60} height={40} />
          </div>

          <button className="mt-6 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
            Add Payment Method
          </button>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">Manage Subscription</h2>
          <p className="text-gray-700 mb-4">Upgrade to a paid plan to access premium features.</p>
          <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition">
            Upgrade Plan
          </button>
        </div>
      </div>
    </div>
  );
}
