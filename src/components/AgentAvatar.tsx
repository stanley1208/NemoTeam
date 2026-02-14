"use client";

import { AGENTS } from "@/lib/agents";
import { AgentRole } from "@/types";
import { cn } from "@/lib/utils";

interface AgentAvatarProps {
  role: AgentRole;
  size?: "sm" | "md" | "lg" | "xl";
  isActive?: boolean;
}

const sizeClasses = {
  sm: "h-7 w-7 text-sm rounded-lg",
  md: "h-10 w-10 text-xl rounded-xl",
  lg: "h-14 w-14 text-2xl rounded-2xl",
  xl: "h-20 w-20 text-4xl rounded-2xl",
};

export default function AgentAvatar({
  role,
  size = "md",
  isActive = false,
}: AgentAvatarProps) {
  const agent = AGENTS[role];

  return (
    <div
      className={cn(
        "relative flex items-center justify-center border transition-all duration-300",
        agent.bgColor,
        agent.borderColor,
        sizeClasses[size],
        isActive && "pulse-glow ring-1 ring-nvidia/40"
      )}
    >
      <span className="leading-none">{agent.icon}</span>
      {isActive && (
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-nvidia border-2 border-surface animate-pulse" />
      )}
    </div>
  );
}
