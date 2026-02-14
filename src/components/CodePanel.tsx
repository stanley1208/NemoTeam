"use client";

import { CodeBlock } from "@/types";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, FileCode2, FolderOpen, Terminal, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";

interface CodePanelProps {
  codeBlocks: CodeBlock[];
  savedFiles?: string[];
  outputDir?: string;
  executionResult?: {
    success?: boolean;
    output?: string;
    error?: string;
  } | null;
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

  // Determine how to run the first file
  const mainFile = savedFiles[0];
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

export default function CodePanel({ codeBlocks, savedFiles, outputDir, executionResult }: CodePanelProps) {
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
