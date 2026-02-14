"use client";

import { AgentMessage as AgentMessageType, AgentRole } from "@/types";
import AgentMessage from "./AgentMessage";
import { useEffect, useRef } from "react";

interface AgentChatProps {
  messages: AgentMessageType[];
  activeAgent: AgentRole | null;
}

export default function AgentChat({ messages, activeAgent }: AgentChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, messages[messages.length - 1]?.content]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-600">
        <div className="text-center">
          <p className="text-lg font-medium">Waiting for task...</p>
          <p className="text-sm mt-1">
            Submit a coding task to activate the team
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto divide-y divide-white/5"
    >
      {messages.map((message) => (
        <AgentMessage
          key={message.id}
          message={message}
          isActive={
            message.isStreaming && activeAgent === message.role
          }
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
