"use client";

import { AgentMessage as AgentMessageType, AgentRole } from "@/types";
import AgentMessage from "./AgentMessage";
import { useEffect, useRef } from "react";
import { MessageSquare, Sparkles, Workflow } from "lucide-react";

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
        {messages.map((message) => {
          // System messages: task echo and phase labels
          if (message.isSystem) {
            const isTaskEcho = message.id.startsWith("task-");
            return (
              <div key={message.id} className="px-5 py-3">
                {isTaskEcho ? (
                  <div className="flex items-start gap-3 rounded-xl bg-nvidia/[0.06] border border-nvidia/20 px-4 py-3.5">
                    <Sparkles className="h-4 w-4 text-nvidia flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-nvidia/70 uppercase tracking-wider font-semibold mb-1">Task</p>
                      <p className="text-sm text-zinc-200 leading-relaxed">{message.content}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2.5 py-1">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap px-2">
                      <Workflow className="h-3 w-3 text-zinc-600" />
                      {message.content}
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                  </div>
                )}
              </div>
            );
          }

          return (
            <AgentMessage
              key={message.id}
              message={message}
              isActive={
                message.isStreaming && activeAgent === message.role
              }
            />
          );
        })}
      </div>
      <div ref={bottomRef} className="h-4" />
    </div>
  );
}
