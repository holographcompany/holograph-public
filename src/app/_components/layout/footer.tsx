// /src/app/_components/layout/Footer.tsx

'use client'
import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-slate-100 text-gray-700 py-6 border-t border-gray-300 mt-10 text-sm">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 flex flex-col sm:flex-row justify-between items-center">
        <div className="mb-4 sm:mb-0">
          © {new Date().getFullYear()} Holograph Company, LLC. All rights reserved.
        </div>
        <div className="flex gap-6">
          <Link href="/privacy-policy" className="hover:underline">Privacy Policy</Link>
          <Link href="/terms" className="hover:underline">Terms & Conditions</Link>
          <Link href="/faq" className="hover:underline">FAQ</Link>
        </div>
      </div>
    </footer>
  )
}
