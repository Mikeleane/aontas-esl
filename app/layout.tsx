import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import TopNav from "./_components/TopNav";

export const metadata: Metadata = {
  title: "Aontas ESL",
  description: "CEFR-aligned ESL reading, exercise, social-thread and H5P tools with Standard + Supported routes.",
};

export const viewport: Viewport = {
  themeColor: "#0f3d76",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen antialiased">
        <TopNav />
        {children}
      </body>
    </html>
  );
}
