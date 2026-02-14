"use client";

import { AGENTS } from "@/lib/agents";
import { AgentMessage as AgentMessageType } from "@/types";
import AgentAvatar from "./AgentAvatar";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface AgentMessageProps {
  message: AgentMessageType;
  isActive?: boolean;
}

function formatContent(content: string) {
  // Simple markdown-like formatting for display
  const lines = content.split("\n");
  return lines.map((line, i) => {
    // Headers
    if (line.startsWith("### ")) {
      return (
        <h4 key={i} className="text-sm font-semibold text-white mt-3 mb-1">
          {line.slice(4)}
        </h4>
      );
    }
    if (line.startsWith("## ")) {
      return (
        <h3 key={i} className="text-sm font-bold text-white mt-3 mb-1">
          {line.slice(3)}
        </h3>
      );
    }
    // Bold items
    if (line.startsWith("- **")) {
      const match = line.match(/^- \*\*(.+?)\*\*:?\s*(.*)/);
      if (match) {
        return (
          <div key={i} className="flex gap-2 mt-1">
            <span className="text-zinc-500 mt-0.5">•</span>
            <span>
              <strong className="text-zinc-100">{match[1]}</strong>
              {match[2] && (
                <span className="text-zinc-400">: {match[2]}</span>
              )}
            </span>
          </div>
        );
      }
    }
    // Regular list items
    if (line.startsWith("- ")) {
      return (
        <div key={i} className="flex gap-2 mt-0.5">
          <span className="text-zinc-500">•</span>
          <span className="text-zinc-300">{line.slice(2)}</span>
        </div>
      );
    }
    // Numbered items
    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      return (
        <div key={i} className="flex gap-2 mt-0.5">
          <span className="text-nvidia/60 font-mono text-xs mt-0.5 min-w-[1.2rem] text-right">
            {numMatch[1]}.
          </span>
          <span className="text-zinc-300">{numMatch[2]}</span>
        </div>
      );
    }
    // Inline code blocks (not full code blocks)
    if (line.startsWith("```")) {
      return null; // Skip code fences, handled by CodePanel
    }
    // Empty lines
    if (line.trim() === "") {
      return <div key={i} className="h-2" />;
    }
    // Regular text
    return (
      <p key={i} className="text-zinc-300 leading-relaxed">
        {line}
      </p>
    );
  });
}

export default function AgentMessage({
  message,
  isActive,
}: AgentMessageProps) {
  const agent = AGENTS[message.role];
  const formattedContent = useMemo(
    () => formatContent(message.content),
    [message.content]
  );

  return (
    <div className={cn("fade-in-up flex gap-3 px-4 py-3")}>
      <div className="flex-shrink-0 mt-0.5">
        <AgentAvatar role={message.role} size="sm" isActive={isActive} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn("text-sm font-semibold", agent.color)}>
            {agent.name}
          </span>
          <span className="text-xs text-zinc-600">{agent.title}</span>
        </div>
        <div className="text-sm leading-relaxed space-y-0.5">
          {formattedContent}
          {message.isStreaming && <span className="typing-cursor" />}
        </div>
      </div>
    </div>
  );
}
