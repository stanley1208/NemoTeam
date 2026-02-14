import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NemoTeam — Multi-Agent AI Dev Team",
  description:
    "Watch specialized AI agents collaborate in real-time to architect, code, review, and test your software. Powered by NVIDIA Nemotron.",
  keywords: [
    "NVIDIA",
    "Nemotron",
    "AI agents",
    "multi-agent",
    "code generation",
    "NIM",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-surface text-zinc-200 min-h-screen">
        {children}
      </body>
    </html>
  );
}
