import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import GoogleAnalytics from "@/components/GoogleAnalytics";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Love On Dev | Custom Software for Small Businesses & Nonprofits",
  description: "Technical consultant specializing in client portals, database design, and practical solutions for mission-driven organizations. Collaborative, inclusive approach to software development.",
  keywords: ["custom software development", "client portals", "database design", "nonprofit software", "small business technology", "Supabase", "PostgreSQL"],
  authors: [{ name: "Paul Hartman" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LoveOnDev Admin",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Love On Dev | Custom Software for Small Businesses & Nonprofits",
    description: "Technical consultant specializing in client portals, database design, and practical solutions for mission-driven organizations.",
    url: "https://loveondev.com",
    siteName: "Love On Dev",
    locale: "en_US",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#290D47",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
