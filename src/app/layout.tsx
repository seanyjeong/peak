import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToasterProvider } from "@/components/ToasterProvider";

export const metadata: Metadata = {
  title: "P-EAK | 피크",
  description: "Physical Excellence Achievement Keeper - 체육 실기 수업 관리",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#10b981",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className="antialiased bg-background"
      >
        {children}
        <ToasterProvider />
      </body>
    </html>
  );
}
