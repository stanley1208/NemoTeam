"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskInputProps {
  onSubmit: (task: string) => void;
  isLoading: boolean;
  variant?: "landing" | "compact";
}

const EXAMPLE_TASKS = [
  "Build a REST API for a todo app with Express.js",
  "Create a Python function that solves the N-Queens problem",
  "Implement a React hook for infinite scrolling",
  "Write a rate limiter middleware in Go",
];

export default function TaskInput({
  onSubmit,
  isLoading,
  variant = "landing",
}: TaskInputProps) {
  const [task, setTask] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (task.trim() && !isLoading) {
      onSubmit(task.trim());
    }
  };

  if (variant === "compact") {
    return (
      <form onSubmit={handleSubmit} className="border-t border-white/[0.06] p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Describe a new task..."
            disabled={isLoading}
            className="flex-1 rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-nvidia/30 focus:border-nvidia/30 disabled:opacity-50 transition-all"
          />
          <button
            type="submit"
            disabled={!task.trim() || isLoading}
            className="flex items-center justify-center rounded-xl bg-nvidia px-5 py-2.5 text-sm font-semibold text-black hover:bg-nvidia-light disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Describe a coding task for the team..."
            rows={4}
            disabled={isLoading}
            className="w-full rounded-2xl bg-surface-raised border border-white/10 px-5 py-4 text-base text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-nvidia/30 focus:border-nvidia/30 disabled:opacity-50 resize-none transition-all"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSubmit(e);
              }
            }}
          />
          <div className="absolute bottom-3 right-3">
            <button
              type="submit"
              disabled={!task.trim() || isLoading}
              className={cn(
                "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
                task.trim() && !isLoading
                  ? "bg-nvidia text-black hover:bg-nvidia-light shadow-lg shadow-nvidia/20"
                  : "bg-white/5 text-zinc-600 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Run Team
                </>
              )}
            </button>
          </div>
        </div>
        <p className="text-xs text-zinc-600 mt-2 text-center">
          Press Ctrl+Enter to submit
        </p>
      </form>

      <div className="mt-6">
        <p className="text-xs text-zinc-500 text-center mb-3">
          Try an example:
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {EXAMPLE_TASKS.map((example) => (
            <button
              key={example}
              onClick={() => setTask(example)}
              disabled={isLoading}
              className="rounded-lg bg-white/[0.03] border border-white/5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/[0.06] hover:border-white/10 transition-all disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
