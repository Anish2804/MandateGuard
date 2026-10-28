import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "MandateGuard — AI-Agent Payment Authorization & Smart Account Security Console",
  description: "Cryptographic human authorization boundaries, EIP-712 payment verdicts, and smart account runtime security for autonomous AI payment agents.",
  keywords: ["AI Agent Security", "Payment Authorization", "Smart Accounts", "EIP-712", "Web3 Security"],
  authors: [{ name: "MandateGuard Security Team" }],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
