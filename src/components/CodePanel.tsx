"use client";

import { CodeBlock } from "@/types";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, FileCode2 } from "lucide-react";
import { useState } from "react";

interface CodePanelProps {
  codeBlocks: CodeBlock[];
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

export default function CodePanel({ codeBlocks }: CodePanelProps) {
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
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      {codeBlocks.map((block, index) => (
        <CodeBlockCard
          key={`${block.filename || index}-${index}`}
          block={block}
          index={index}
        />
      ))}
    </div>
  );
}
