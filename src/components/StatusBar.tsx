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
} from "lucide-react";

interface StatusBarProps {
  activeAgent: AgentRole | null;
  completedAgents: AgentRole[];
  status: WorkflowStatus;
  evolutionCycle?: number;
  maxEvolutionCycles?: number;
}

export default function StatusBar({
  activeAgent,
  completedAgents,
  status,
  evolutionCycle = 0,
  maxEvolutionCycles = 3,
}: StatusBarProps) {
  return (
    <div className="border-b border-white/5 bg-surface-raised/50 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 overflow-x-auto">
          {AGENT_ORDER.map((role, index) => {
            const agent = AGENTS[role];
            const isActive = activeAgent === role;
            const isCompleted = completedAgents.includes(role);
            const isPending = !isActive && !isCompleted;

            return (
              <div key={role} className="flex items-center flex-shrink-0">
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-all duration-300",
                    isActive && "bg-nvidia/10 border border-nvidia/20",
                    isCompleted && "opacity-80",
                    isPending && "opacity-40"
                  )}
                >
                  <AgentAvatar role={role} size="sm" isActive={isActive} />
                  <div className="hidden sm:block">
                    <p
                      className={cn(
                        "text-xs font-medium",
                        isActive ? agent.color : "text-zinc-400"
                      )}
                    >
                      {agent.name}
                    </p>
                  </div>
                  <div className="ml-0.5">
                    {isCompleted && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-nvidia" />
                    )}
                    {isActive && (
                      <Loader2 className="h-3.5 w-3.5 text-nvidia animate-spin" />
                    )}
                    {isPending && (
                      <Circle className="h-3.5 w-3.5 text-zinc-600" />
                    )}
                  </div>
                </div>
                {index < AGENT_ORDER.length - 1 && (
                  <div
                    className={cn(
                      "w-4 h-px mx-0.5",
                      isCompleted ? "bg-nvidia/40" : "bg-white/5"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0 ml-2">
          {evolutionCycle > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-orange-400 bg-orange-400/10 border border-orange-400/20 rounded-full px-2.5 py-1">
              <RefreshCw className={cn("h-3 w-3", status === "running" && "animate-spin")} />
              Cycle {evolutionCycle}/{maxEvolutionCycles}
            </span>
          )}
          {status === "running" && (
            <span className="flex items-center gap-1.5 text-xs text-nvidia">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="hidden sm:inline">
                {evolutionCycle > 0 ? "Evolving" : "Processing"}
              </span>
            </span>
          )}
          {status === "completed" && (
            <span className="flex items-center gap-1.5 text-xs text-nvidia">
              <CheckCircle2 className="h-3 w-3" />
              {evolutionCycle > 0
                ? `Evolved (${evolutionCycle} cycle${evolutionCycle > 1 ? "s" : ""})`
                : "Complete"}
            </span>
          )}
          {status === "error" && (
            <span className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="h-3 w-3" />
              Error
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
