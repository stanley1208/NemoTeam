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
  RefreshCw,
  ChevronRight,
  Cpu,
  Terminal,
} from "lucide-react";
import { AgentRole } from "@/types";

/* ─── Pipeline step connector ─── */
function PipelineStep({
  role,
  index,
  total,
}: {
  role: AgentRole;
  index: number;
  total: number;
}) {
  const agent = AGENTS[role];
  return (
    <div className="flex items-center gap-4 lg:gap-6">
      <div className="flex flex-col items-center gap-3 min-w-[90px]">
        <AgentAvatar role={role} size="xl" />
        <div className="text-center">
          <p className={`text-sm font-bold ${agent.color}`}>{agent.name}</p>
          <p className="text-xs text-zinc-500 mt-1">{agent.title}</p>
        </div>
      </div>
      {index < total - 1 && (
        <ChevronRight className="h-5 w-5 text-zinc-700 flex-shrink-0 hidden sm:block" />
      )}
    </div>
  );
}

/* ─── Feature card ─── */
function FeatureCard({
  icon,
  title,
  description,
  accentColor,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accentColor: string;
}) {
  return (
    <div className="glass-card group relative overflow-hidden" style={{ padding: "36px 32px" }}>
      {/* Accent glow */}
      <div
        className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 blur-3xl transition-opacity group-hover:opacity-20"
        style={{ background: accentColor }}
      />
      <div className="relative">
        <div
          className="flex items-center justify-center w-14 h-14 rounded-2xl mb-7"
          style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}30` }}
        >
          {icon}
        </div>
        <h3 className="text-lg font-bold text-white mb-3">{title}</h3>
        <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

/* ─── Agent detail card for "How It Works" ─── */
function AgentCard({ role, index }: { role: AgentRole; index: number }) {
  const agent = AGENTS[role];
  return (
    <div className="glass-card relative overflow-hidden" style={{ padding: "32px 28px" }}>
      {/* Step number watermark */}
      <span className="absolute top-4 right-5 text-5xl font-black text-white/[0.03] select-none">
        {String(index + 1).padStart(2, "0")}
      </span>

      <div className="relative">
        <AgentAvatar role={role} size="lg" />
        <h3 className={`mt-5 text-base font-bold ${agent.color}`}>{agent.name}</h3>
        <p className="text-xs text-zinc-500 mt-1 font-medium uppercase tracking-wider">
          {agent.title}
        </p>
        <p className="mt-5 text-sm text-zinc-400 leading-relaxed">
          {agent.description}
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════ */
export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (task: string) => {
    setIsLoading(true);
    router.push(`/workspace?task=${encodeURIComponent(task)}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1">
        {/* ── HERO ── */}
        <section className="relative overflow-hidden">
          {/* Background effects */}
          <div className="absolute inset-0 grid-bg opacity-40" />
          <div className="glow-orb bg-nvidia/8 w-[600px] h-[600px] -top-40 left-1/4" />
          <div className="glow-orb bg-cyan-500/5 w-[500px] h-[500px] top-20 right-1/4" />

          <div className="relative section-wrapper" style={{ paddingTop: "100px", paddingBottom: "120px" }}>
            {/* Badge */}
            <div className="flex justify-center" style={{ marginBottom: "48px" }}>
              <div className="inline-flex items-center gap-2.5 rounded-full bg-nvidia/10 border border-nvidia/20 px-5 py-2.5 text-sm">
                <Sparkles className="h-4 w-4 text-nvidia" />
                <span className="text-nvidia font-medium">
                  Powered by NVIDIA Nemotron Ultra 253B &amp; Super 49B via NIM
                </span>
              </div>
            </div>

            {/* Heading */}
            <h1
              className="text-center font-bold tracking-tight leading-[1.05]"
              style={{ fontSize: "clamp(2.8rem, 6vw, 5rem)" }}
            >
              Your AI Dev Team,
              <br />
              <span className="gradient-text">Ready to Build</span>
            </h1>

            <p
              className="mx-auto text-center text-zinc-400 leading-relaxed"
              style={{ maxWidth: "620px", fontSize: "1.125rem", marginTop: "32px" }}
            >
              Five AI agents — each powered by the right NVIDIA Nemotron model
              for their role — collaborate in real-time to architect, code,
              review, test, and auto-debug your software via NIM.
            </p>

            {/* Agent Pipeline */}
            <div
              className="flex justify-center flex-wrap gap-3"
              style={{ marginTop: "72px", marginBottom: "80px" }}
            >
              {AGENT_ORDER.map((role, index) => (
                <PipelineStep
                  key={role}
                  role={role}
                  index={index}
                  total={AGENT_ORDER.length}
                />
              ))}
            </div>

            {/* Task Input */}
            <div style={{ maxWidth: "680px", marginLeft: "auto", marginRight: "auto", width: "100%" }}>
              <TaskInput onSubmit={handleSubmit} isLoading={isLoading} />
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="relative" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.015] to-transparent pointer-events-none" />
          <div className="relative section-wrapper" style={{ paddingTop: "100px", paddingBottom: "100px" }}>
            <div className="text-center" style={{ marginBottom: "64px" }}>
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-nvidia/80 mb-4">
                The Pipeline
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white">
                How It Works
              </h2>
              <p
                className="mx-auto text-zinc-400 leading-relaxed"
                style={{ maxWidth: "540px", marginTop: "20px", fontSize: "1rem" }}
              >
                Five specialized agents work through a structured pipeline
                with a self-evolving debug loop — just like a real dev team.
              </p>
            </div>

            <div
              className="grid gap-6"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              {AGENT_ORDER.map((role, index) => (
                <AgentCard key={role} role={role} index={index} />
              ))}
            </div>

            {/* Pipeline flow indicator */}
            <div className="flex items-center justify-center gap-3 text-xs text-zinc-600" style={{ marginTop: "48px" }}>
              <span>Architect</span>
              <ArrowRight className="h-3 w-3" />
              <span>Developer</span>
              <ArrowRight className="h-3 w-3" />
              <span>Reviewer</span>
              <ArrowRight className="h-3 w-3" />
              <span>Tester</span>
              <ArrowRight className="h-3 w-3" />
              <span className="text-red-400/60">Debug Loop</span>
              <RefreshCw className="h-3 w-3 text-red-400/60" />
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="section-wrapper" style={{ paddingTop: "100px", paddingBottom: "100px" }}>
            <div className="text-center" style={{ marginBottom: "64px" }}>
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-nvidia/80 mb-4">
                Capabilities
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white">
                Built for Real Development
              </h2>
            </div>

            <div
              className="grid gap-6"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              }}
            >
              <FeatureCard
                icon={<Cpu className="h-7 w-7" style={{ color: "#76B900" }} />}
                title="Multi-Model Architecture"
                description="Different NVIDIA Nemotron models for different roles: Ultra-253B for deep reasoning (Architect, Debugger) and Super-49B for fast code generation and analysis (Developer, Reviewer, Tester)."
                accentColor="#76B900"
              />
              <FeatureCard
                icon={<Terminal className="h-7 w-7" style={{ color: "#22d3ee" }} />}
                title="Real GPU Execution"
                description="Generated code is saved to disk and executed on your actual GPU/CPU. Not just 'looks correct' — it runs, and output quality is validated automatically."
                accentColor="#22d3ee"
              />
              <FeatureCard
                icon={<RefreshCw className="h-7 w-7" style={{ color: "#f87171" }} />}
                title="Self-Debugging Loop"
                description="When code crashes, real error output feeds back to the Debugger for full code audit. Tracks error patterns and escalates when the same bug repeats."
                accentColor="#f87171"
              />
              <FeatureCard
                icon={<Shield className="h-7 w-7" style={{ color: "#fb923c" }} />}
                title="Output Quality Validation"
                description="Catches NaN values, low accuracy, GPU slower than CPU, stuck training — even if the code doesn't crash. Bad results trigger another debug cycle."
                accentColor="#fb923c"
              />
              <FeatureCard
                icon={<Zap className="h-7 w-7" style={{ color: "#c084fc" }} />}
                title="Real-Time Streaming"
                description="Watch all 5 agents think and write live via SSE. Every architectural decision, code line, review comment, and debug trace streams as it happens."
                accentColor="#c084fc"
              />
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "40px 0" }}>
          <div className="section-wrapper flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-zinc-600">
              Built with NVIDIA Nemotron Ultra 253B &amp; Super 49B via NIM API &middot; Open Source
            </p>
            <div className="flex items-center gap-8">
              <a
                href="https://build.nvidia.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-zinc-500 hover:text-nvidia transition-colors"
              >
                NVIDIA NIM
              </a>
              <a
                href="https://www.nvidia.com/gtc/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-zinc-500 hover:text-nvidia transition-colors"
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
