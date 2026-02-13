import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aontas 10 - Kilgobnet N.S.",
  description: "Inclusive reading packs (Standard + Adapted) for one class, two streams.",
};

// Next.js App Router: themeColor belongs in `viewport`, not `metadata`.
export const viewport: Viewport = {
  themeColor: "#0f3d76",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
