"use client";

import { Bot, Github } from "lucide-react";
import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-surface/80 backdrop-blur-xl">
      <div className="section-wrapper flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-nvidia/10 border border-nvidia/20 group-hover:bg-nvidia/20 transition-colors">
            <Bot className="h-5 w-5 text-nvidia" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            Nemo<span className="text-nvidia">Team</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <span className="hidden sm:inline-flex items-center gap-2 rounded-full bg-nvidia/10 px-4 py-1.5 text-xs font-medium text-nvidia border border-nvidia/20">
            <span className="h-1.5 w-1.5 rounded-full bg-nvidia animate-pulse" />
            Powered by NVIDIA Nemotron
          </span>
          <a
            href="https://github.com/stanley1208/Nemotron"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Github className="h-[18px] w-[18px]" />
          </a>
        </div>
      </div>
    </header>
  );
}
