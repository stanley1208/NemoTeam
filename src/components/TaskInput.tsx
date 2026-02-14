"use client";

import { useState } from "react";
import { Send, Loader2, ArrowRight } from "lucide-react";
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
    <form onSubmit={handleSubmit} className="w-full">
      <div className="glass-card overflow-hidden !rounded-2xl">
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Describe a coding task for the team..."
          rows={4}
          disabled={isLoading}
          className="w-full bg-transparent px-7 pt-6 pb-4 text-base text-white placeholder-zinc-500 focus:outline-none disabled:opacity-50 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleSubmit(e);
            }
          }}
        />
        <div className="flex items-center justify-between px-6 pb-5">
          <p className="text-xs text-zinc-600">
            Ctrl + Enter to submit
          </p>
          <button
            type="submit"
            disabled={!task.trim() || isLoading}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200",
              task.trim() && !isLoading
                ? "bg-nvidia text-black hover:bg-nvidia-light shadow-lg shadow-nvidia/25 hover:shadow-nvidia/40"
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
                Run Team
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {EXAMPLE_TASKS.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setTask(example)}
            disabled={isLoading}
            className="rounded-full bg-white/[0.03] border border-white/[0.06] px-4 py-2 text-xs text-zinc-500 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.12] transition-all disabled:opacity-50"
          >
            {example}
          </button>
        ))}
      </div>
    </form>
  );
}
