"use client";

import { useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import AgentChat from "@/components/AgentChat";
import CodePanel from "@/components/CodePanel";
import StatusBar from "@/components/StatusBar";
import TaskInput from "@/components/TaskInput";
import {
  AgentMessage,
  AgentRole,
  CodeBlock,
  SSEEvent,
  WorkflowStatus,
  WorkflowSummary,
} from "@/types";
import { Code2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Suspense } from "react";

function WorkspaceContent() {
  const searchParams = useSearchParams();
  const initialTask = searchParams.get("task") || "";

  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [codeBlocks, setCodeBlocks] = useState<CodeBlock[]>([]);
  const [activeAgent, setActiveAgent] = useState<AgentRole | null>(null);
  const [completedAgents, setCompletedAgents] = useState<AgentRole[]>([]);
  const [status, setStatus] = useState<WorkflowStatus>("idle");
  const [activeTab, setActiveTab] = useState<"chat" | "code">("chat");
  const [evolutionCycle, setEvolutionCycle] = useState(0);
  const [maxEvolutionCycles, setMaxEvolutionCycles] = useState(3);
  const [savedFiles, setSavedFiles] = useState<string[]>([]);
  const [outputDir, setOutputDir] = useState<string>("");
  const [executionResult, setExecutionResult] = useState<{
    success?: boolean;
    output?: string;
    error?: string;
  } | null>(null);
  const [workflowSummary, setWorkflowSummary] = useState<WorkflowSummary | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [evolutionContent, setEvolutionContent] = useState<string>("");
  const [escalationTier, setEscalationTier] = useState(0);

  const currentMessageId = useRef<string | null>(null);
  const agentStartTime = useRef<number>(0);
  const hasAutoRun = useRef(false);

  const runWorkflow = useCallback(async (task: string) => {
    // Reset state
    setMessages([]);
    setCodeBlocks([]);
    setActiveAgent(null);
    setCompletedAgents([]);
    setStatus("running");
    setEvolutionCycle(0);
    setSavedFiles([]);
    setOutputDir("");
    setExecutionResult(null);
    setWorkflowSummary(null);
    setIsExecuting(false);
    setEvolutionContent("");
    setEscalationTier(0);
    currentMessageId.current = null;
    agentStartTime.current = 0;

    // Echo the task as the first message so judges always see it
    setMessages([
      {
        id: `task-${Date.now()}`,
        role: "architect" as AgentRole,
        content: task,
        timestamp: Date.now(),
        isSystem: true,
      },
    ]);

    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);

          let event: SSEEvent;
          try {
            event = JSON.parse(jsonStr);
          } catch {
            continue;
          }

          switch (event.type) {
            case "agent_start": {
              const msgId = `${event.role}-${Date.now()}`;
              currentMessageId.current = msgId;
              agentStartTime.current = Date.now();
              setActiveAgent(event.role!);
              setMessages((prev) => [
                ...prev,
                {
                  id: msgId,
                  role: event.role!,
                  content: "",
                  timestamp: event.timestamp,
                  isStreaming: true,
                },
              ]);
              break;
            }

            case "agent_chunk": {
              setMessages((prev) => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg && lastMsg.role === event.role) {
                  updated[updated.length - 1] = {
                    ...lastMsg,
                    content: lastMsg.content + (event.content || ""),
                  };
                }
                return updated;
              });
              break;
            }

            case "agent_complete": {
              const elapsed = agentStartTime.current > 0
                ? Date.now() - agentStartTime.current
                : undefined;
              agentStartTime.current = 0;
              setMessages((prev) => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg && lastMsg.role === event.role) {
                  updated[updated.length - 1] = {
                    ...lastMsg,
                    isStreaming: false,
                    durationMs: elapsed,
                  };
                }
                return updated;
              });
              setCompletedAgents((prev) =>
                prev.includes(event.role!)
                  ? prev
                  : [...prev, event.role!]
              );
              setActiveAgent(null);
              break;
            }

            case "code_update": {
              if (event.code) {
                setCodeBlocks((prev) => {
                  // Replace blocks if from same session, add otherwise
                  const existing = prev.find(
                    (b) => b.filename === event.code!.filename
                  );
                  if (existing) {
                    return prev.map((b) =>
                      b.filename === event.code!.filename ? event.code! : b
                    );
                  }
                  return [...prev, event.code!];
                });
                setActiveTab("code");
              }
              break;
            }

            case "evolution_cycle": {
              setEvolutionCycle(event.cycle || 0);
              if (event.maxCycles !== undefined) setMaxEvolutionCycles(event.maxCycles);
              if (event.content) setEvolutionContent(event.content);
              if (event.tier !== undefined) setEscalationTier(event.tier);
              // Reset completed agents for the new cycle
              setCompletedAgents([]);
              // Insert a phase separator in chat
              const cycleLabel = event.content || `Debug Cycle ${event.cycle}`;
              setMessages((prev) => [
                ...prev,
                {
                  id: `cycle-${Date.now()}`,
                  role: "debugger" as AgentRole,
                  content: cycleLabel,
                  timestamp: event.timestamp,
                  isSystem: true,
                },
              ]);
              break;
            }

            case "files_saved": {
              if (event.savedFiles) setSavedFiles(event.savedFiles);
              if (event.outputDir) setOutputDir(event.outputDir);
              // Phase separator: entering execution phase
              setMessages((prev) => [
                ...prev,
                {
                  id: `phase-exec-${Date.now()}`,
                  role: "tester" as AgentRole,
                  content: "Phase 3: Executing on hardware...",
                  timestamp: event.timestamp,
                  isSystem: true,
                },
              ]);
              break;
            }

            case "execution_start": {
              setExecutionResult(null);
              setIsExecuting(true);
              break;
            }

            case "execution_result": {
              setIsExecuting(false);
              const success = event.executionSuccess;
              const output = event.executionOutput || "";
              const error = event.executionError || "";
              setExecutionResult({ success, output, error });

              const resultContent = success
                ? `**Execution successful!**\n\n\`\`\`\n${output}\n\`\`\``
                : `**Execution failed!**\n\n\`\`\`\n${error}\n\`\`\`${output ? `\n\nPartial output:\n\`\`\`\n${output}\n\`\`\`` : ""}`;

              setMessages((prev) => [
                ...prev,
                {
                  id: `exec-result-${Date.now()}`,
                  role: "tester" as AgentRole,
                  content: resultContent,
                  timestamp: event.timestamp,
                  isStreaming: false,
                },
              ]);
              break;
            }

            case "workflow_complete": {
              setStatus("completed");
              setActiveAgent(null);
              setIsExecuting(false);
              if (event.cycle !== undefined) setEvolutionCycle(event.cycle);
              if (event.summary) setWorkflowSummary(event.summary);
              break;
            }

            case "workflow_error": {
              setStatus("error");
              setActiveAgent(null);
              setMessages((prev) => [
                ...prev,
                {
                  id: `error-${Date.now()}`,
                  role: "architect",
                  content: `Error: ${event.error}`,
                  timestamp: event.timestamp,
                  isStreaming: false,
                },
              ]);
              break;
            }
          }
        }
      }
    } catch (error) {
      setStatus("error");
      setActiveAgent(null);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "architect",
          content: `Connection error: ${error instanceof Error ? error.message : "Unknown error"}. Please check your NVIDIA_NIM_API_KEY and try again.`,
          timestamp: Date.now(),
          isStreaming: false,
        },
      ]);
    }
  }, []);

  // Auto-run if task was passed via URL
  if (initialTask && !hasAutoRun.current && status === "idle") {
    hasAutoRun.current = true;
    // Use setTimeout to avoid calling during render
    setTimeout(() => runWorkflow(initialTask), 100);
  }

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <StatusBar
        activeAgent={activeAgent}
        completedAgents={completedAgents}
        status={status}
        evolutionCycle={evolutionCycle}
        maxEvolutionCycles={maxEvolutionCycles}
        evolutionContent={evolutionContent}
        escalationTier={escalationTier}
      />

      {/* Mobile tab switcher */}
      <div className="flex lg:hidden border-b border-white/5">
        <button
          onClick={() => setActiveTab("chat")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors",
            activeTab === "chat"
              ? "text-nvidia border-b-2 border-nvidia"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <MessageSquare className="h-4 w-4" />
          Agent Chat
        </button>
        <button
          onClick={() => setActiveTab("code")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors",
            activeTab === "code"
              ? "text-nvidia border-b-2 border-nvidia"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <Code2 className="h-4 w-4" />
          Code Output
          {codeBlocks.length > 0 && (
            <span className="bg-nvidia/20 text-nvidia text-xs px-2 py-0.5 rounded-full font-medium">
              {codeBlocks.length}
            </span>
          )}
        </button>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Agent Chat Panel */}
        <div
          className={cn(
            "flex flex-col border-r border-white/[0.06]",
            "lg:w-1/2",
            activeTab === "chat" ? "flex w-full" : "hidden lg:flex"
          )}
        >
          <div className="flex items-center gap-2.5 px-5 py-3 border-b border-white/[0.06] bg-white/[0.015]">
            <MessageSquare className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-400">Team Chat</h2>
            {messages.length > 0 && (
              <span className="text-[11px] text-zinc-600 bg-white/5 px-2 py-0.5 rounded-md">
                {messages.length} messages
              </span>
            )}
          </div>
          <AgentChat messages={messages} activeAgent={activeAgent} />
          <TaskInput
            onSubmit={runWorkflow}
            isLoading={status === "running"}
            variant="compact"
          />
        </div>

        {/* Code Output Panel */}
        <div
          className={cn(
            "flex flex-col",
            "lg:w-1/2",
            activeTab === "code" ? "flex w-full" : "hidden lg:flex"
          )}
        >
          <div className="flex items-center gap-2.5 px-5 py-3 border-b border-white/[0.06] bg-white/[0.015]">
            <Code2 className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-400">Code Output</h2>
            {codeBlocks.length > 0 && (
              <span className="text-[11px] text-zinc-600 bg-white/5 px-2 py-0.5 rounded-md">
                {codeBlocks.length} file{codeBlocks.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <CodePanel codeBlocks={codeBlocks} savedFiles={savedFiles} outputDir={outputDir} executionResult={executionResult} workflowSummary={workflowSummary} isExecuting={isExecuting} />
        </div>
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-surface">
          <div className="text-zinc-500">Loading workspace...</div>
        </div>
      }
    >
      <WorkspaceContent />
    </Suspense>
  );
}
