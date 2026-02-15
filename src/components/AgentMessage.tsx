"use client";

import { AGENTS } from "@/lib/agents";
import { AgentMessage as AgentMessageType } from "@/types";
import AgentAvatar from "./AgentAvatar";
import { cn } from "@/lib/utils";
import { useMemo, ReactNode } from "react";
import { Clock } from "lucide-react";

interface AgentMessageProps {
  message: AgentMessageType;
  isActive?: boolean;
}

/**
 * Parse inline markdown formatting within a single line of text.
 * Handles: **bold**, `inline code`, and plain text segments.
 */
function parseInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  // Match **bold** or `code` segments
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Push plain text before this match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // **bold**
      parts.push(
        <strong key={key++} className="text-zinc-100 font-semibold">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // `inline code`
      parts.push(
        <code
          key={key++}
          className="bg-white/[0.06] text-nvidia/90 px-1.5 py-0.5 rounded text-[12px] font-mono"
        >
          {match[3]}
        </code>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * Format agent message content with markdown-like rendering.
 * Handles: headers, bold list items, regular lists, numbered items,
 * code blocks (fenced), inline bold/code, and regular text.
 */
function formatContent(content: string): ReactNode[] {
  const lines = content.split("\n");
  const elements: ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = "";
  let codeKey = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ── Code fence handling ──
    if (line.startsWith("```")) {
      if (!inCodeBlock) {
        // Opening fence
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
        continue;
      } else {
        // Closing fence — render the code block
        inCodeBlock = false;
        elements.push(
          <div key={`code-${codeKey++}`} className="my-3 rounded-lg overflow-hidden border border-white/[0.06]">
            {codeLang && (
              <div className="px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.06] text-[10px] text-zinc-500 font-mono">
                {codeLang}
              </div>
            )}
            <pre className="px-4 py-3 overflow-x-auto bg-[#0d0d14]">
              <code className="text-[12px] leading-relaxed font-mono text-zinc-300">
                {codeLines.join("\n")}
              </code>
            </pre>
          </div>
        );
        continue;
      }
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // ── Headers ──
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={i} className="text-sm font-semibold text-white mt-4 mb-2">
          {parseInline(line.slice(4))}
        </h4>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="text-sm font-bold text-white mt-4 mb-2">
          {parseInline(line.slice(3))}
        </h3>
      );
      continue;
    }

    // ── Bold list items: - **Label**: description ──
    if (line.startsWith("- **")) {
      const match = line.match(/^- \*\*(.+?)\*\*:?\s*(.*)/);
      if (match) {
        elements.push(
          <div key={i} className="flex gap-2.5 mt-1.5">
            <span className="text-zinc-500 mt-0.5 leading-none select-none">•</span>
            <span>
              <strong className="text-zinc-100 font-semibold">{match[1]}</strong>
              {match[2] && (
                <span className="text-zinc-400">: {parseInline(match[2])}</span>
              )}
            </span>
          </div>
        );
        continue;
      }
    }

    // ── Regular list items ──
    if (line.startsWith("- ")) {
      elements.push(
        <div key={i} className="flex gap-2.5 mt-1">
          <span className="text-zinc-500 leading-none select-none">•</span>
          <span className="text-zinc-300">{parseInline(line.slice(2))}</span>
        </div>
      );
      continue;
    }

    // ── Numbered items ──
    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      elements.push(
        <div key={i} className="flex gap-2.5 mt-1.5">
          <span className="text-nvidia/60 font-mono text-xs mt-0.5 min-w-[1.5rem] text-right select-none">
            {numMatch[1]}.
          </span>
          <span className="text-zinc-300">{parseInline(numMatch[2])}</span>
        </div>
      );
      continue;
    }

    // ── Empty lines ──
    if (line.trim() === "") {
      elements.push(<div key={i} className="h-3" />);
      continue;
    }

    // ── Regular text with inline formatting ──
    elements.push(
      <p key={i} className="text-zinc-300 leading-relaxed">
        {parseInline(line)}
      </p>
    );
  }

  // Handle unclosed code block (streaming — fence not closed yet)
  if (inCodeBlock && codeLines.length > 0) {
    elements.push(
      <div key={`code-${codeKey}`} className="my-3 rounded-lg overflow-hidden border border-white/[0.06]">
        {codeLang && (
          <div className="px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.06] text-[10px] text-zinc-500 font-mono">
            {codeLang}
          </div>
        )}
        <pre className="px-4 py-3 overflow-x-auto bg-[#0d0d14]">
          <code className="text-[12px] leading-relaxed font-mono text-zinc-300">
            {codeLines.join("\n")}
          </code>
        </pre>
      </div>
    );
  }

  return elements;
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
    <div className={cn("fade-in-up flex gap-4 px-5 py-5")}>
      <div className="flex-shrink-0 mt-0.5">
        <AgentAvatar role={message.role} size="md" isActive={isActive} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2.5 mb-2">
          <span className={cn("text-sm font-bold", agent.color)}>
            {agent.name}
          </span>
          <span className="text-xs text-zinc-600 font-medium">{agent.title}</span>
          {!message.isStreaming && message.durationMs != null && (
            <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 font-mono bg-white/[0.03] border border-white/[0.06] rounded-md px-1.5 py-0.5">
              <Clock className="h-2.5 w-2.5" />
              {message.durationMs < 1000
                ? `${message.durationMs}ms`
                : `${(message.durationMs / 1000).toFixed(1)}s`}
            </span>
          )}
        </div>
        <div className="text-[13px] leading-relaxed space-y-1">
          {formattedContent}
          {message.isStreaming && <span className="typing-cursor" />}
        </div>
      </div>
    </div>
  );
}
