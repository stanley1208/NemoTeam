"use client";

import { CodeBlock } from "@/types";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, FileCode2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

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
    <div className="fade-in-up rounded-xl border border-white/5 bg-surface-raised overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <FileCode2 className="h-3.5 w-3.5 text-nvidia" />
          <span className="text-xs font-medium text-zinc-400">
            {block.filename || `code-${index + 1}.${block.language}`}
          </span>
          <span className="text-xs text-zinc-600 px-1.5 py-0.5 bg-white/5 rounded">
            {block.language}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/5"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-nvidia" />
              <span className="text-nvidia">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>
      <div className="max-h-[500px] overflow-auto">
        <SyntaxHighlighter
          language={block.language}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: "16px",
            background: "transparent",
            fontSize: "13px",
          }}
          showLineNumbers
          lineNumberStyle={{
            minWidth: "2.5em",
            paddingRight: "1em",
            color: "#3f3f46",
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
        <div className="text-center">
          <FileCode2 className="h-10 w-10 mx-auto mb-3 text-zinc-700" />
          <p className="text-sm font-medium">No code yet</p>
          <p className="text-xs mt-1 text-zinc-700">
            Code will appear here as the Developer writes it
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
