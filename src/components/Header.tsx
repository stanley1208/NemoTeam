"use client";

import { Bot, Github } from "lucide-react";
import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-nvidia/10 border border-nvidia/20 group-hover:bg-nvidia/20 transition-colors">
            <Bot className="h-4.5 w-4.5 text-nvidia" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            Nemo<span className="text-nvidia">Team</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-nvidia/10 px-3 py-1 text-xs font-medium text-nvidia border border-nvidia/20">
            <span className="h-1.5 w-1.5 rounded-full bg-nvidia animate-pulse" />
            Powered by NVIDIA Nemotron
          </span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </div>
    </header>
  );
}
