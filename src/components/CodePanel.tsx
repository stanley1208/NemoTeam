"use client";

import { CodeBlock, WorkflowSummary } from "@/types";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, FileCode2, FolderOpen, Terminal, CheckCircle2, XCircle, Cpu, Clock, RefreshCw, Zap, Play, Layers } from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface CodePanelProps {
  codeBlocks: CodeBlock[];
  savedFiles?: string[];
  outputDir?: string;
  executionResult?: {
    success?: boolean;
    output?: string;
    error?: string;
  } | null;
  workflowSummary?: WorkflowSummary | null;
  isExecuting?: boolean;
}

function CodeBlockCard({ block, index }: { block: CodeBlock; index: number }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(block.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fade-in-up rounded-xl border border-white/[0.06] bg-[#0d0d14] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-white/[0.015]">
        <div className="flex items-center gap-3">
          <FileCode2 className="h-4 w-4 text-nvidia" />
          <span className="text-sm font-medium text-zinc-300">
            {block.filename || `code-${index + 1}.${block.language}`}
          </span>
          <span className="text-[11px] text-zinc-500 px-2 py-0.5 bg-white/5 rounded-md font-mono">
            {block.language}
          </span>
          {block.savedPath && (
            <span className="text-[10px] text-nvidia/70 px-2 py-0.5 bg-nvidia/10 rounded-md font-medium">
              Saved
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 text-xs text-zinc-500 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-nvidia" />
              <span className="text-nvidia font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      <div className="max-h-[600px] overflow-auto">
        <SyntaxHighlighter
          language={block.language}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: "20px",
            background: "transparent",
            fontSize: "13px",
          }}
          showLineNumbers
          lineNumberStyle={{
            minWidth: "3em",
            paddingRight: "1.5em",
            color: "#27272a",
            fontSize: "12px",
          }}
        >
          {block.code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

function SavedFilesBanner({
  savedFiles,
  outputDir,
}: {
  savedFiles: string[];
  outputDir: string;
}) {
  const [copied, setCopied] = useState(false);

  // Determine the main runnable file
  const skipPatterns = /^(test_|tests_|utils|helpers|lib|config)/i;
  const mainFile =
    savedFiles.find((f) => /^main\.\w+$/.test(f)) ||
    savedFiles.find((f) => f.toLowerCase().includes("main")) ||
    savedFiles.find((f) => !skipPatterns.test(f) && /\.(py|js|ts)$/.test(f)) ||
    savedFiles[0];
  const ext = mainFile?.split(".").pop()?.toLowerCase();
  let runCommand = "";
  if (ext === "py") runCommand = `python output/${mainFile}`;
  else if (ext === "js") runCommand = `node output/${mainFile}`;
  else if (ext === "ts") runCommand = `npx tsx output/${mainFile}`;
  else if (ext === "go") runCommand = `go run output/${mainFile}`;
  else if (ext === "rb") runCommand = `ruby output/${mainFile}`;
  else if (ext === "sh") runCommand = `bash output/${mainFile}`;

  const handleCopyCommand = async () => {
    if (runCommand) {
      await navigator.clipboard.writeText(runCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="mx-5 mt-5 rounded-xl border border-nvidia/20 bg-nvidia/5 p-5">
      <div className="flex items-center gap-3 mb-3">
        <FolderOpen className="h-5 w-5 text-nvidia" />
        <span className="text-sm font-bold text-nvidia">
          Files Saved to output/
        </span>
      </div>
      <div className="space-y-1.5 mb-4">
        {savedFiles.map((file) => (
          <div key={file} className="flex items-center gap-2 text-sm text-zinc-300">
            <FileCode2 className="h-3.5 w-3.5 text-zinc-500" />
            <span className="font-mono text-xs">output/{file}</span>
          </div>
        ))}
      </div>
      {runCommand && (
        <div className="mt-4 pt-4 border-t border-nvidia/20">
          <p className="text-xs text-zinc-400 mb-2.5 flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5" />
            Run it now:
          </p>
          <button
            onClick={handleCopyCommand}
            className="w-full flex items-center justify-between rounded-lg bg-black/40 border border-white/[0.06] px-4 py-3 text-left font-mono text-sm text-nvidia hover:bg-black/60 transition-colors group"
          >
            <span>$ {runCommand}</span>
            {copied ? (
              <Check className="h-4 w-4 text-nvidia flex-shrink-0" />
            ) : (
              <Copy className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 flex-shrink-0" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function ExecutionResultBanner({
  result,
}: {
  result: { success?: boolean; output?: string; error?: string };
}) {
  const isSuccess = result.success;
  return (
    <div
      className={`mx-5 mt-5 rounded-xl border p-5 ${
        isSuccess
          ? "border-nvidia/20 bg-nvidia/5"
          : "border-red-500/20 bg-red-500/5"
      }`}
    >
      <div className="flex items-center gap-3 mb-3">
        {isSuccess ? (
          <CheckCircle2 className="h-5 w-5 text-nvidia" />
        ) : (
          <XCircle className="h-5 w-5 text-red-400" />
        )}
        <span
          className={`text-sm font-bold ${
            isSuccess ? "text-nvidia" : "text-red-400"
          }`}
        >
          {isSuccess ? "Execution Successful" : "Execution Failed — Auto-debugging..."}
        </span>
      </div>
      {result.output && (
        <pre className="text-xs text-zinc-300 bg-black/30 rounded-lg p-3 mt-3 overflow-x-auto whitespace-pre-wrap max-h-[200px] overflow-y-auto">
          {result.output}
        </pre>
      )}
      {result.error && !isSuccess && (
        <pre className="text-xs text-red-300 bg-black/30 rounded-lg p-3 mt-3 overflow-x-auto whitespace-pre-wrap max-h-[200px] overflow-y-auto">
          {result.error}
        </pre>
      )}
    </div>
  );
}

/**
 * Extract a short display name from the full NVIDIA model ID.
 */
function shortModelName(model: string): string {
  if (model.includes("253b")) return "Ultra-253B";
  if (model.includes("49b")) return "Super-49B";
  const parts = model.split("/");
  return parts[parts.length - 1];
}

/**
 * Format milliseconds into a human-readable duration.
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function ExecutionProgressBanner() {
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div className="mx-5 mt-5 rounded-xl border border-nvidia/30 bg-nvidia/[0.06] p-5 execution-pulse">
      <div className="flex items-center gap-3 mb-3">
        <Play className="h-5 w-5 text-nvidia animate-pulse" />
        <span className="text-sm font-bold text-nvidia">
          Executing on hardware...
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <Clock className="h-4 w-4 text-zinc-500" />
          <span className="font-mono">{formatElapsed(elapsed)}</span>
        </div>
        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full bg-nvidia/60 rounded-full execution-bar" />
        </div>
      </div>
      <p className="text-[11px] text-zinc-500 mt-3">
        Running generated code with real hardware execution (GPU if available)
      </p>
    </div>
  );
}

function WorkflowSummaryBanner({ summary }: { summary: WorkflowSummary }) {
  return (
    <div className={`mx-5 mt-5 rounded-xl border p-5 ${
      summary.executionSuccess
        ? "border-nvidia/40 bg-gradient-to-br from-nvidia/[0.08] to-transparent success-glow"
        : "border-nvidia/30 bg-gradient-to-br from-nvidia/[0.08] to-transparent"
    }`}>
      <div className="flex items-center gap-3 mb-4">
        {summary.executionSuccess ? (
          <CheckCircle2 className="h-5 w-5 text-nvidia" />
        ) : (
          <Zap className="h-5 w-5 text-nvidia" />
        )}
        <span className="text-sm font-bold text-nvidia">
          {summary.executionSuccess
            ? "Completed Successfully — All Systems Go"
            : "Workflow Complete"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Duration */}
        <div className="flex items-center gap-2.5 rounded-lg bg-black/20 px-3 py-2.5">
          <Clock className="h-4 w-4 text-zinc-500 flex-shrink-0" />
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Duration</p>
            <p className="text-sm font-semibold text-white">{formatDuration(summary.durationMs)}</p>
          </div>
        </div>

        {/* Agent calls */}
        <div className="flex items-center gap-2.5 rounded-lg bg-black/20 px-3 py-2.5">
          <Cpu className="h-4 w-4 text-zinc-500 flex-shrink-0" />
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">NIM API Calls</p>
            <p className="text-sm font-semibold text-white">{summary.totalAgentCalls}</p>
          </div>
        </div>

        {/* Evolution cycles */}
        {summary.evolutionCycles > 0 && (
          <div className="flex items-center gap-2.5 rounded-lg bg-black/20 px-3 py-2.5">
            <RefreshCw className="h-4 w-4 text-zinc-500 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Debug Cycles</p>
              <p className="text-sm font-semibold text-white">{summary.evolutionCycles}</p>
            </div>
          </div>
        )}

        {/* Execution attempts */}
        {summary.executionAttempts > 0 && (
          <div className="flex items-center gap-2.5 rounded-lg bg-black/20 px-3 py-2.5">
            <Terminal className="h-4 w-4 text-zinc-500 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Exec Retries</p>
              <p className="text-sm font-semibold text-white">{summary.executionAttempts}</p>
            </div>
          </div>
        )}

        {/* Re-architect count */}
        {summary.rearchitectCount > 0 && (
          <div className="flex items-center gap-2.5 rounded-lg bg-black/20 px-3 py-2.5">
            <Layers className="h-4 w-4 text-zinc-500 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Re-architects</p>
              <p className="text-sm font-semibold text-white">{summary.rearchitectCount}</p>
            </div>
          </div>
        )}
      </div>

      {/* Model breakdown */}
      <div className="mt-4 pt-3 border-t border-white/[0.06]">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Models Used</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.modelCalls).map(([model, count]) => (
            <span
              key={model}
              className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] px-2.5 py-1 text-[11px] font-mono text-zinc-400"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${model.includes("253b") ? "bg-blue-400" : "bg-purple-400"}`} />
              {shortModelName(model)} &times; {count}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CodePanel({ codeBlocks, savedFiles, outputDir, executionResult, workflowSummary, isExecuting }: CodePanelProps) {
  if (codeBlocks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-600">
        <div className="text-center px-6">
          <FileCode2 className="h-10 w-10 mx-auto mb-4 text-zinc-700" />
          <p className="text-sm font-medium text-zinc-500">No code yet</p>
          <p className="text-xs mt-2 text-zinc-700 max-w-xs mx-auto leading-relaxed">
            Code will appear here as the Developer writes it
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pb-5">
      {workflowSummary && <WorkflowSummaryBanner summary={workflowSummary} />}
      {isExecuting && <ExecutionProgressBanner />}
      {executionResult && <ExecutionResultBanner result={executionResult} />}
      {savedFiles && savedFiles.length > 0 && outputDir && (
        <SavedFilesBanner savedFiles={savedFiles} outputDir={outputDir} />
      )}
      <div className="p-5 space-y-5">
        {codeBlocks.map((block, index) => (
          <CodeBlockCard
            key={`${block.filename || index}-${index}`}
            block={block}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
