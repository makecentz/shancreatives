import type { Metadata } from "next";
import { DM_Sans, Inter } from "next/font/google";
import "./globals.css";
import { siteUrl } from "@/lib/env";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Shagannan Shenanigans | Handmade Gifts, Custom Shirts & Crochet Dolls",
    template: "%s | Shagannan Shenanigans",
  },
  description:
    "Unique crochet creations, custom shirts, and thoughtful handmade gifts designed to bring a little joy to every occasion.",
  icons: { icon: "/brand/logo.svg" },
  openGraph: { siteName: "Shagannan Shenanigans", type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
