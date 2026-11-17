import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "All Downloader — TikTok, RedNote & YouTube Shorts video downloader",
  description:
    "Paste a TikTok, RedNote or YouTube Shorts link, choose a quality and download the video without watermark.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
