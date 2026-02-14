"use client";

import { AgentMessage as AgentMessageType, AgentRole } from "@/types";
import AgentMessage from "./AgentMessage";
import { useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";

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
        <div className="text-center px-6">
          <MessageSquare className="h-10 w-10 mx-auto mb-4 text-zinc-700" />
          <p className="text-base font-medium text-zinc-500">
            Waiting for task...
          </p>
          <p className="text-sm mt-2 text-zinc-700 max-w-xs mx-auto leading-relaxed">
            Submit a coding task and watch the agents collaborate in real-time
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
    >
      <div className="divide-y divide-white/[0.04]">
        {messages.map((message) => (
          <AgentMessage
            key={message.id}
            message={message}
            isActive={
              message.isStreaming && activeAgent === message.role
            }
          />
        ))}
      </div>
      <div ref={bottomRef} className="h-4" />
    </div>
  );
}
