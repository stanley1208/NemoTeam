import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "NemoTeam — Self-Debugging Multi-Agent AI Dev Team",
  description:
    "5 AI agents powered by NVIDIA Nemotron Ultra 253B & Super 49B collaborate to architect, code, review, test, execute on real GPU hardware, and auto-debug until it works. Built with NVIDIA NIM.",
  keywords: [
    "NVIDIA",
    "Nemotron",
    "NIM",
    "AI agents",
    "multi-agent",
    "code generation",
    "self-debugging",
    "GPU",
    "CUDA",
    "GTC",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className={`${inter.className} antialiased bg-surface text-zinc-200 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
