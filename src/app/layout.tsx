// /src/app/layout.tsx - layout page

import "./globals.css";
import Navbar from "./_components/layout/navbar";
import Footer from "./_components/layout/footer";
import { Providers } from "./providers";
import SessionDebugger from "./_components/SessionDebug";
import HelpDialog from "./_components/HelpDialog"; // ✅ Import Help Dialog
import { debugLog } from "@/utils/debug";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SessionDebugger />
          <Navbar />
          {children}
          <Footer />
          <HelpDialog /> {/* ✅ Add HelpDialog at the bottom, outside children */}
        </Providers>
      </body>
    </html>
  );
}
