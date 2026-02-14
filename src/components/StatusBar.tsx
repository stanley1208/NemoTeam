"use client";

import { AGENTS, AGENT_ORDER } from "@/lib/agents";
import { AgentRole, WorkflowStatus } from "@/types";
import AgentAvatar from "./AgentAvatar";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, Circle, AlertCircle } from "lucide-react";

interface StatusBarProps {
  activeAgent: AgentRole | null;
  completedAgents: AgentRole[];
  status: WorkflowStatus;
}

export default function StatusBar({
  activeAgent,
  completedAgents,
  status,
}: StatusBarProps) {
  return (
    <div className="border-b border-white/5 bg-surface-raised/50 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {AGENT_ORDER.map((role, index) => {
            const agent = AGENTS[role];
            const isActive = activeAgent === role;
            const isCompleted = completedAgents.includes(role);
            const isPending = !isActive && !isCompleted;

            return (
              <div key={role} className="flex items-center">
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 transition-all duration-300",
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
                  <div className="ml-1">
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
                      "w-6 h-px mx-1",
                      isCompleted ? "bg-nvidia/40" : "bg-white/5"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {status === "running" && (
            <span className="flex items-center gap-1.5 text-xs text-nvidia">
              <Loader2 className="h-3 w-3 animate-spin" />
              Processing
            </span>
          )}
          {status === "completed" && (
            <span className="flex items-center gap-1.5 text-xs text-nvidia">
              <CheckCircle2 className="h-3 w-3" />
              Complete
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
