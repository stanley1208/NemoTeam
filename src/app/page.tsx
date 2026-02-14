"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import TaskInput from "@/components/TaskInput";
import AgentAvatar from "@/components/AgentAvatar";
import { AGENTS, AGENT_ORDER } from "@/lib/agents";
import {
  Zap,
  Shield,
  GitBranch,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (task: string) => {
    setIsLoading(true);
    router.push(`/workspace?task=${encodeURIComponent(task)}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          {/* Background gradient effects */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-nvidia/5 rounded-full blur-[120px]" />
            <div className="absolute top-20 right-1/4 w-72 h-72 bg-blue-500/5 rounded-full blur-[100px]" />
          </div>

          <div className="relative mx-auto max-w-screen-xl px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
            {/* Badge */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-nvidia/10 border border-nvidia/20 px-4 py-1.5 text-sm">
                <Sparkles className="h-3.5 w-3.5 text-nvidia" />
                <span className="text-nvidia font-medium">
                  Powered by NVIDIA Nemotron via NIM
                </span>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-center text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
              Your AI Dev Team,
              <br />
              <span className="gradient-text">Ready to Build</span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-center text-base sm:text-lg text-zinc-400 leading-relaxed">
              Watch specialized AI agents collaborate in real-time to architect,
              code, review, and test your software — all powered by NVIDIA
              Nemotron.
            </p>

            {/* Agent Roster */}
            <div className="flex justify-center gap-3 sm:gap-4 mt-10 mb-12">
              {AGENT_ORDER.map((role, index) => {
                const agent = AGENTS[role];
                return (
                  <div key={role} className="flex items-center gap-3 sm:gap-4">
                    <div className="flex flex-col items-center gap-2 group">
                      <AgentAvatar role={role} size="lg" />
                      <div className="text-center">
                        <p
                          className={`text-xs sm:text-sm font-semibold ${agent.color}`}
                        >
                          {agent.name}
                        </p>
                        <p className="text-[10px] sm:text-xs text-zinc-600">
                          {agent.title}
                        </p>
                      </div>
                    </div>
                    {index < AGENT_ORDER.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-zinc-700 -mt-5 hidden sm:block" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Task Input */}
            <TaskInput onSubmit={handleSubmit} isLoading={isLoading} />
          </div>
        </section>

        {/* Features Section */}
        <section className="border-t border-white/5 bg-surface-raised/30">
          <div className="mx-auto max-w-screen-xl px-4 sm:px-6 py-16 sm:py-20">
            <h2 className="text-center text-2xl sm:text-3xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-center text-zinc-500 mb-12 max-w-lg mx-auto">
              Four specialized agents work together through a structured
              pipeline, just like a real development team.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {AGENT_ORDER.map((role, index) => {
                const agent = AGENTS[role];
                return (
                  <div
                    key={role}
                    className="relative rounded-2xl border border-white/5 bg-surface-raised p-5 hover:border-white/10 transition-all group"
                  >
                    <div className="absolute top-4 right-4 text-3xl font-bold text-white/[0.03]">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <AgentAvatar role={role} size="md" />
                    <h3
                      className={`mt-4 text-sm font-semibold ${agent.color}`}
                    >
                      {agent.name} — {agent.title}
                    </h3>
                    <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
                      {agent.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Tech Section */}
        <section className="border-t border-white/5">
          <div className="mx-auto max-w-screen-xl px-4 sm:px-6 py-16 sm:py-20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-2xl border border-white/5 bg-surface-raised p-6">
                <Zap className="h-8 w-8 text-nvidia mb-4" />
                <h3 className="text-base font-semibold text-white mb-2">
                  Real-Time Streaming
                </h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Watch agents think and write in real-time via SSE streaming.
                  Every thought, every line of code, as it happens.
                </p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-surface-raised p-6">
                <Shield className="h-8 w-8 text-orange-400 mb-4" />
                <h3 className="text-base font-semibold text-white mb-2">
                  Built-In Code Review
                </h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  The Reviewer agent catches bugs, security issues, and quality
                  problems — triggering automatic revisions before delivery.
                </p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-surface-raised p-6">
                <GitBranch className="h-8 w-8 text-purple-400 mb-4" />
                <h3 className="text-base font-semibold text-white mb-2">
                  Iterative Refinement
                </h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  If code doesn&apos;t pass review, the Developer revises
                  automatically. You get production-ready code, not a first
                  draft.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 py-8">
          <div className="mx-auto max-w-screen-xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-zinc-600">
              Built with NVIDIA Nemotron via NIM API &middot; Open Source
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://build.nvidia.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-500 hover:text-nvidia transition-colors"
              >
                NVIDIA NIM
              </a>
              <a
                href="https://www.nvidia.com/gtc/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-500 hover:text-nvidia transition-colors"
              >
                GTC 2026
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
