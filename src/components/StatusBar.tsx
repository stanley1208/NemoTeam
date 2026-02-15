"use client";

import { AGENTS, AGENT_ORDER } from "@/lib/agents";
import { AgentRole, WorkflowStatus } from "@/types";
import AgentAvatar from "./AgentAvatar";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Loader2,
  Circle,
  AlertCircle,
  RefreshCw,
  Cpu,
} from "lucide-react";

interface StatusBarProps {
  activeAgent: AgentRole | null;
  completedAgents: AgentRole[];
  status: WorkflowStatus;
  evolutionCycle?: number;
  maxEvolutionCycles?: number;
  evolutionContent?: string;
  escalationTier?: number;
}

/**
 * Extract a short display name from the full NVIDIA model ID.
 * "nvidia/llama-3.1-nemotron-ultra-253b-v1" → "Ultra-253B"
 */
function shortModelName(model: string): string {
  if (model.includes("253b")) return "Ultra-253B";
  if (model.includes("49b")) return "Super-49B";
  // Fallback: take the last segment
  const parts = model.split("/");
  return parts[parts.length - 1];
}

export default function StatusBar({
  activeAgent,
  completedAgents,
  status,
  evolutionCycle = 0,
  maxEvolutionCycles = 3,
  evolutionContent = "",
  escalationTier = 0,
}: StatusBarProps) {
  const activeAgentDef = activeAgent ? AGENTS[activeAgent] : null;

  return (
    <div className="border-b border-white/5 bg-surface-raised/50 px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        {/* Agent pipeline */}
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {AGENT_ORDER.map((role, index) => {
            const agent = AGENTS[role];
            const isActive = activeAgent === role;
            const isCompleted = completedAgents.includes(role);
            const isPending = !isActive && !isCompleted;

            return (
              <div key={role} className="flex items-center flex-shrink-0">
                <div
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all duration-300",
                    isActive && "bg-nvidia/10 border border-nvidia/20",
                    !isActive && "border border-transparent",
                    isCompleted && "opacity-80",
                    isPending && "opacity-40"
                  )}
                >
                  <AgentAvatar role={role} size="sm" isActive={isActive} />
                  <div className="hidden md:block">
                    <p
                      className={cn(
                        "text-xs font-semibold leading-none",
                        isActive ? agent.color : "text-zinc-400"
                      )}
                    >
                      {agent.name}
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-0.5 leading-none">
                      {agent.title}
                    </p>
                  </div>
                  <div>
                    {isCompleted && (
                      <CheckCircle2 className="h-4 w-4 text-nvidia" />
                    )}
                    {isActive && (
                      <Loader2 className="h-4 w-4 text-nvidia animate-spin" />
                    )}
                    {isPending && (
                      <Circle className="h-4 w-4 text-zinc-700" />
                    )}
                  </div>
                </div>
                {index < AGENT_ORDER.length - 1 && (
                  <div
                    className={cn(
                      "w-6 h-px mx-1",
                      isCompleted ? "bg-nvidia/40" : "bg-white/[0.06]"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Active model indicator */}
          {activeAgentDef && status === "running" && (
            <span className="hidden lg:flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-1">
              <Cpu className="h-3 w-3 text-nvidia/60" />
              {shortModelName(activeAgentDef.model)}
            </span>
          )}
          {evolutionCycle > 0 && (
            <span className={cn(
              "flex items-center gap-2 text-xs rounded-full px-3.5 py-1.5 font-medium",
              escalationTier === 3
                ? (status === "running" ? "text-red-400 bg-red-400/10 border border-red-400/20" : "text-red-400/70 bg-red-400/5 border border-red-400/10")
                : escalationTier === 2
                  ? (status === "running" ? "text-amber-400 bg-amber-400/10 border border-amber-400/20" : "text-amber-400/70 bg-amber-400/5 border border-amber-400/10")
                  : (status === "running" ? "text-orange-400 bg-orange-400/10 border border-orange-400/20" : "text-orange-400/70 bg-orange-400/5 border border-orange-400/10")
            )}>
              <RefreshCw className={cn("h-3.5 w-3.5", status === "running" && "animate-spin")} />
              {escalationTier === 3
                ? `Re-architecting (cycle ${evolutionCycle})`
                : escalationTier === 2
                  ? `Deep review (cycle ${evolutionCycle})`
                  : maxEvolutionCycles === 0
                    ? `Cycle ${evolutionCycle}`
                    : `Cycle ${evolutionCycle}/${maxEvolutionCycles}`}
            </span>
          )}
          {status === "running" && (
            <span className={cn(
              "flex items-center gap-2 text-xs font-medium",
              escalationTier === 3 ? "text-red-400" : evolutionCycle > 0 ? "text-orange-400" : "text-nvidia"
            )}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="hidden sm:inline">
                {escalationTier === 3
                  ? "Re-architecting..."
                  : escalationTier === 2
                    ? "Deep review..."
                    : evolutionCycle > 0
                      ? "Self-debugging..."
                      : "Processing..."}
              </span>
            </span>
          )}
          {status === "completed" && (
            <span className="flex items-center gap-2 text-xs text-nvidia bg-nvidia/10 border border-nvidia/20 rounded-full px-3.5 py-1.5 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {evolutionCycle > 0
                ? `Evolved (${evolutionCycle} cycle${evolutionCycle > 1 ? "s" : ""})`
                : "Complete"}
            </span>
          )}
          {status === "error" && (
            <span className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-full px-3.5 py-1.5 font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              Error
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
