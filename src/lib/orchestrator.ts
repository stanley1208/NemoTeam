import { AGENTS } from "./agents";
import { streamNemotronChat, ChatMessage } from "./nemotron";
import { AgentRole, SSEEvent, CodeBlock } from "@/types";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const MAX_EVOLUTION_CYCLES = 3;
const MAX_EXECUTION_RETRIES = 3;
const EXECUTION_TIMEOUT_MS = 30000; // 30 second timeout
const OUTPUT_DIR = path.join(process.cwd(), "output");

/**
 * Language to file extension mapping.
 */
const LANG_EXTENSIONS: Record<string, string> = {
  python: "py",
  javascript: "js",
  typescript: "ts",
  go: "go",
  rust: "rs",
  java: "java",
  cpp: "cpp",
  c: "c",
  ruby: "rb",
  php: "php",
  swift: "swift",
  kotlin: "kt",
  bash: "sh",
  shell: "sh",
  sql: "sql",
  html: "html",
  css: "css",
  json: "json",
  yaml: "yml",
  toml: "toml",
  plaintext: "txt",
};

/**
 * Clear and prepare the output directory.
 */
function prepareOutputDir(): void {
  if (fs.existsSync(OUTPUT_DIR)) {
    // Remove old generated files
    const files = fs.readdirSync(OUTPUT_DIR);
    for (const file of files) {
      const filePath = path.join(OUTPUT_DIR, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    }
  } else {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Save code blocks to the output directory.
 * Returns the list of saved file paths.
 */
function saveCodeBlocks(blocks: CodeBlock[]): string[] {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const savedPaths: string[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const ext = LANG_EXTENSIONS[block.language] || block.language || "txt";

    // Use the filename from the code block, or generate one
    let filename = block.filename;
    if (!filename) {
      filename = blocks.length === 1
        ? `main.${ext}`
        : `file_${i + 1}.${ext}`;
    }

    // Clean the filename (remove path separators for safety)
    const safeName = filename.replace(/[/\\]/g, "_").replace(/[^a-zA-Z0-9._-]/g, "_");

    // Remove the "// filename: ..." comment line from the code before saving
    const cleanCode = block.code.replace(
      /^(?:\/\/|#|--|\/\*)\s*filename:\s*.+?(?:\s*\*\/)?[\r\n]+/m,
      ""
    );

    const filePath = path.join(OUTPUT_DIR, safeName);
    fs.writeFileSync(filePath, cleanCode, "utf-8");

    block.savedPath = filePath;
    savedPaths.push(safeName);
  }

  return savedPaths;
}

/**
 * Build the environment variables for execution (includes CUDA DLL paths).
 */
function getExecEnv(): Record<string, string> {
  const cudaPaths = [
    "C:\\Users\\user\\anaconda3\\Lib\\site-packages\\torch\\lib",
    "C:\\Users\\user\\anaconda3\\Lib\\site-packages\\nvidia\\cuda_nvrtc\\bin",
  ].join(path.delimiter);

  return {
    ...process.env as Record<string, string>,
    PATH: `${cudaPaths}${path.delimiter}${process.env.PATH || ""}`,
    PYTHONPATH: OUTPUT_DIR,
  };
}

/**
 * Execute a saved code file and return the result.
 */
function executeCode(filename: string): {
  success: boolean;
  output: string;
  error: string;
} {
  const ext = path.extname(filename).toLowerCase();
  const filePath = path.join(OUTPUT_DIR, filename);
  let cmd: string;

  switch (ext) {
    case ".py":
      cmd = `python "${filePath}"`;
      break;
    case ".js":
      cmd = `node "${filePath}"`;
      break;
    case ".ts":
      cmd = `npx tsx "${filePath}"`;
      break;
    default:
      return { success: false, output: "", error: `No known runner for ${ext} files` };
  }

  try {
    const output = execSync(cmd, {
      timeout: EXECUTION_TIMEOUT_MS,
      encoding: "utf-8",
      cwd: OUTPUT_DIR,
      env: getExecEnv(),
      maxBuffer: 1024 * 1024, // 1MB
      windowsHide: true,
    });
    return { success: true, output: output.trim(), error: "" };
  } catch (err: unknown) {
    const execErr = err as { stderr?: string; stdout?: string; message?: string; status?: number };
    const stderr = execErr.stderr || "";
    const stdout = execErr.stdout || "";
    const msg = execErr.message || "Unknown execution error";

    // Extract just the meaningful error (last part of traceback)
    let cleanError = stderr || msg;
    const lines = cleanError.split("\n");
    if (lines.length > 20) {
      // Keep first 3 lines + last 12 lines for traceback
      cleanError = [
        ...lines.slice(0, 3),
        "  ...",
        ...lines.slice(-12),
      ].join("\n");
    }

    return {
      success: false,
      output: stdout.trim(),
      error: cleanError.trim(),
    };
  }
}

/**
 * Find the main runnable file from saved files.
 */
function findMainFile(savedFiles: string[]): string | null {
  const runnableExts = [".py", ".js", ".ts"];

  // Priority 1: file named "main.*"
  const mainFile = savedFiles.find(
    (f) => f.match(/^main\.\w+$/) && runnableExts.includes(path.extname(f).toLowerCase())
  );
  if (mainFile) return mainFile;

  // Priority 2: file with "main" in the name (e.g. "spiral_main.py")
  const mainish = savedFiles.find(
    (f) => f.toLowerCase().includes("main") && runnableExts.includes(path.extname(f).toLowerCase())
  );
  if (mainish) return mainish;

  // Priority 3: skip files that look like tests, utils, or helpers
  const skipPatterns = /^(test_|tests_|utils|helpers|lib|config)/i;
  const appFile = savedFiles.find(
    (f) => !skipPatterns.test(f) && runnableExts.includes(path.extname(f).toLowerCase())
  );
  if (appFile) return appFile;

  // Fallback: first runnable file
  return savedFiles.find((f) => runnableExts.includes(path.extname(f).toLowerCase())) || null;
}

/**
 * Extract code blocks from markdown-formatted text.
 */
function extractCodeBlocks(text: string): CodeBlock[] {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: CodeBlock[] = [];
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const language = match[1] || "plaintext";
    const code = match[2].trim();

    const filenameMatch = code.match(
      /^(?:\/\/|#|--|\/\*)\s*filename:\s*(.+?)(?:\s*\*\/)?$/m
    );

    blocks.push({
      language,
      code,
      filename: filenameMatch?.[1]?.trim(),
    });
  }

  return blocks;
}

/**
 * Run a single agent: stream its response and yield SSE events.
 * Returns the full response text.
 */
async function* runAgent(
  role: AgentRole,
  messages: ChatMessage[]
): AsyncGenerator<SSEEvent, string> {
  const agent = AGENTS[role];

  yield {
    type: "agent_start",
    role,
    timestamp: Date.now(),
  };

  let fullResponse = "";
  try {
    for await (const chunk of streamNemotronChat(messages)) {
      fullResponse += chunk;
      yield {
        type: "agent_chunk",
        role,
        content: chunk,
        timestamp: Date.now(),
      };
    }
  } catch (error) {
    yield {
      type: "workflow_error",
      error: `Agent ${agent.name} encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`,
      timestamp: Date.now(),
    };
    return fullResponse;
  }

  yield {
    type: "agent_complete",
    role,
    content: fullResponse,
    timestamp: Date.now(),
  };

  return fullResponse;
}

/**
 * Build the context message from conversation history.
 */
function buildContext(
  task: string,
  history: { role: AgentRole; content: string }[],
  extraNote?: string
): string {
  let context = `Original task: ${task}\n\n--- Team Conversation ---\n`;
  for (const msg of history) {
    const a = AGENTS[msg.role];
    context += `\n[${a.name} - ${a.title}]:\n${msg.content}\n`;
  }
  if (extraNote) {
    context += `\n--- Additional Instructions ---\n${extraNote}\n`;
  }
  return context;
}

/**
 * OpenEvolve-inspired orchestration pipeline.
 *
 * Phase 1 (Initial): Architect → Developer → Reviewer (with revision) → Tester
 * Phase 2 (Evolution Loop):
 *   If Tester finds failures →
 *     Debugger diagnoses → Developer fixes → Reviewer re-checks → Tester re-tests
 *   Repeat until Tester says ALL TESTS PASS or max cycles reached.
 */
export async function* runOrchestration(
  task: string
): AsyncGenerator<SSEEvent> {
  const history: { role: AgentRole; content: string }[] = [];
  let latestCode = "";

  // Clear old output files
  prepareOutputDir();

  // ──────────────────────────────────────────
  // PHASE 1: Initial pipeline
  // ──────────────────────────────────────────

  // 1. Architect
  const architectMsgs: ChatMessage[] = [
    { role: "system", content: AGENTS.architect.systemPrompt },
    { role: "user", content: `Here is the coding task:\n\n${task}` },
  ];

  let response = "";
  for await (const event of runAgent("architect", architectMsgs)) {
    if (typeof event === "string") { response = event; continue; }
    yield event;
    if (event.type === "agent_complete") response = event.content || "";
  }
  history.push({ role: "architect", content: response });

  // 2. Developer (initial implementation)
  const devMsgs: ChatMessage[] = [
    { role: "system", content: AGENTS.developer.systemPrompt },
    { role: "user", content: buildContext(task, history) },
  ];

  response = "";
  for await (const event of runAgent("developer", devMsgs)) {
    if (typeof event === "string") { response = event; continue; }
    yield event;
    if (event.type === "agent_complete") response = event.content || "";
  }
  history.push({ role: "developer", content: response });
  latestCode = response;

  // Emit code blocks
  const initialBlocks = extractCodeBlocks(latestCode);
  for (const block of initialBlocks) {
    yield { type: "code_update", role: "developer", code: block, timestamp: Date.now() };
  }

  // 3. Reviewer (initial review)
  const reviewMsgs: ChatMessage[] = [
    { role: "system", content: AGENTS.reviewer.systemPrompt },
    { role: "user", content: buildContext(task, history) },
  ];

  response = "";
  for await (const event of runAgent("reviewer", reviewMsgs)) {
    if (typeof event === "string") { response = event; continue; }
    yield event;
    if (event.type === "agent_complete") response = event.content || "";
  }
  history.push({ role: "reviewer", content: response });

  // 3b. If reviewer needs revision, developer revises once
  if (response.includes("NEEDS REVISION")) {
    const revMsgs: ChatMessage[] = [
      { role: "system", content: AGENTS.developer.systemPrompt },
      {
        role: "user",
        content: buildContext(
          task,
          history,
          "The Reviewer found issues. Please revise your code to address ALL the feedback. Output the complete revised code."
        ),
      },
    ];

    response = "";
    for await (const event of runAgent("developer", revMsgs)) {
      if (typeof event === "string") { response = event; continue; }
      yield event;
      if (event.type === "agent_complete") response = event.content || "";
    }
    history.push({ role: "developer", content: response });
    latestCode = response;

    const revisedBlocks = extractCodeBlocks(latestCode);
    for (const block of revisedBlocks) {
      yield { type: "code_update", role: "developer", code: block, timestamp: Date.now() };
    }
  }

  // 4. Tester (initial test)
  const testMsgs: ChatMessage[] = [
    { role: "system", content: AGENTS.tester.systemPrompt },
    { role: "user", content: buildContext(task, history) },
  ];

  response = "";
  for await (const event of runAgent("tester", testMsgs)) {
    if (typeof event === "string") { response = event; continue; }
    yield event;
    if (event.type === "agent_complete") response = event.content || "";
  }
  history.push({ role: "tester", content: response });

  // ──────────────────────────────────────────
  // PHASE 2: Evolution loop (OpenEvolve-inspired)
  //
  // If tests fail → Debugger → Developer → Reviewer → Tester
  // Repeat until PASS or max cycles
  // ──────────────────────────────────────────

  let cycle = 0;

  while (
    cycle < MAX_EVOLUTION_CYCLES &&
    !response.includes("ALL TESTS PASS") &&
    response.includes("TESTS FAILING")
  ) {
    cycle++;

    // Signal a new evolution cycle
    yield {
      type: "evolution_cycle",
      cycle,
      maxCycles: MAX_EVOLUTION_CYCLES,
      timestamp: Date.now(),
    };

    // A. Debugger — diagnose the failures
    const debugMsgs: ChatMessage[] = [
      { role: "system", content: AGENTS.debugger.systemPrompt },
      {
        role: "user",
        content: buildContext(
          task,
          history,
          `This is evolution cycle ${cycle}/${MAX_EVOLUTION_CYCLES}. Analyze the test failures above and provide precise fix specifications.`
        ),
      },
    ];

    response = "";
    for await (const event of runAgent("debugger", debugMsgs)) {
      if (typeof event === "string") { response = event; continue; }
      yield event;
      if (event.type === "agent_complete") response = event.content || "";
    }
    history.push({ role: "debugger", content: response });

    // If debugger says code is clean, we're done
    if (response.includes("CODE IS CLEAN")) {
      break;
    }

    // B. Developer — apply the fixes
    const fixMsgs: ChatMessage[] = [
      { role: "system", content: AGENTS.developer.systemPrompt },
      {
        role: "user",
        content: buildContext(
          task,
          history,
          `Evolution cycle ${cycle}/${MAX_EVOLUTION_CYCLES}: The Debugger has identified specific bugs. Apply ALL fixes precisely as specified. Output the complete fixed code.`
        ),
      },
    ];

    response = "";
    for await (const event of runAgent("developer", fixMsgs)) {
      if (typeof event === "string") { response = event; continue; }
      yield event;
      if (event.type === "agent_complete") response = event.content || "";
    }
    history.push({ role: "developer", content: response });
    latestCode = response;

    const fixedBlocks = extractCodeBlocks(latestCode);
    for (const block of fixedBlocks) {
      yield { type: "code_update", role: "developer", code: block, timestamp: Date.now() };
    }

    // C. Reviewer — quick re-check
    const reReviewMsgs: ChatMessage[] = [
      { role: "system", content: AGENTS.reviewer.systemPrompt },
      {
        role: "user",
        content: buildContext(
          task,
          history,
          `Evolution cycle ${cycle}: This is a re-review of fixed code. Focus on whether the Debugger's identified bugs have been properly addressed.`
        ),
      },
    ];

    response = "";
    for await (const event of runAgent("reviewer", reReviewMsgs)) {
      if (typeof event === "string") { response = event; continue; }
      yield event;
      if (event.type === "agent_complete") response = event.content || "";
    }
    history.push({ role: "reviewer", content: response });

    // If reviewer still wants revision, developer fixes inline
    if (response.includes("NEEDS REVISION")) {
      const quickFixMsgs: ChatMessage[] = [
        { role: "system", content: AGENTS.developer.systemPrompt },
        {
          role: "user",
          content: buildContext(
            task,
            history,
            "Quick fix pass: address the remaining review issues. Output the complete code."
          ),
        },
      ];

      response = "";
      for await (const event of runAgent("developer", quickFixMsgs)) {
        if (typeof event === "string") { response = event; continue; }
        yield event;
        if (event.type === "agent_complete") response = event.content || "";
      }
      history.push({ role: "developer", content: response });
      latestCode = response;

      const quickFixBlocks = extractCodeBlocks(latestCode);
      for (const block of quickFixBlocks) {
        yield { type: "code_update", role: "developer", code: block, timestamp: Date.now() };
      }
    }

    // D. Tester — re-test
    const reTestMsgs: ChatMessage[] = [
      { role: "system", content: AGENTS.tester.systemPrompt },
      {
        role: "user",
        content: buildContext(
          task,
          history,
          `Evolution cycle ${cycle}: Re-test the latest code. Check if previous failures are fixed and look for any new issues.`
        ),
      },
    ];

    response = "";
    for await (const event of runAgent("tester", reTestMsgs)) {
      if (typeof event === "string") { response = event; continue; }
      yield event;
      if (event.type === "agent_complete") response = event.content || "";
    }
    history.push({ role: "tester", content: response });
  }

  // ──────────────────────────────────────────
  // PHASE 3: Save, Execute, and Auto-Debug
  //
  // Save code → Run it → If error, Debugger
  // fixes → Re-save → Re-run until success
  // or max retries.
  // ──────────────────────────────────────────

  let executionSuccess = false;
  let executionAttempt = 0;

  while (executionAttempt < MAX_EXECUTION_RETRIES) {
    // Save the latest code
    const blocks = extractCodeBlocks(latestCode);
    if (blocks.length === 0) break;

    const savedFiles = saveCodeBlocks(blocks);

    // Emit updated code blocks
    for (const block of blocks) {
      yield { type: "code_update", role: "developer", code: block, timestamp: Date.now() };
    }

    yield {
      type: "files_saved",
      savedFiles,
      outputDir: OUTPUT_DIR,
      timestamp: Date.now(),
    };

    // Find the main file to run
    const mainFile = findMainFile(savedFiles);
    if (!mainFile) {
      // No runnable file, just finish
      break;
    }

    // Execute the code
    yield {
      type: "execution_start",
      content: `Running ${mainFile}...`,
      timestamp: Date.now(),
    };

    const result = executeCode(mainFile);

    yield {
      type: "execution_result",
      executionSuccess: result.success,
      executionOutput: result.output,
      executionError: result.error,
      timestamp: Date.now(),
    };

    if (result.success) {
      executionSuccess = true;
      break;
    }

    // Execution failed — feed real error to Debugger → Developer loop
    executionAttempt++;
    if (executionAttempt >= MAX_EXECUTION_RETRIES) break;

    cycle++;
    yield {
      type: "evolution_cycle",
      cycle,
      maxCycles: MAX_EVOLUTION_CYCLES + MAX_EXECUTION_RETRIES,
      content: `Execution failed — auto-debugging (attempt ${executionAttempt}/${MAX_EXECUTION_RETRIES})`,
      timestamp: Date.now(),
    };

    // Add the execution error to history
    history.push({
      role: "tester",
      content: `REAL EXECUTION FAILED with the following error:\n\n${result.error}\n\nStdout (if any):\n${result.output}\n\nVERDICT: TESTS FAILING`,
    });

    // Debugger diagnoses the real error
    const execDebugMsgs: ChatMessage[] = [
      { role: "system", content: AGENTS.debugger.systemPrompt },
      {
        role: "user",
        content: buildContext(
          task,
          history,
          `CRITICAL: The code was actually executed and CRASHED with a real runtime error (shown above from the Tester). This is NOT a hypothetical test — the code literally failed when run. Diagnose the exact cause of the runtime error and provide precise fix specifications.`
        ),
      },
    ];

    response = "";
    for await (const event of runAgent("debugger", execDebugMsgs)) {
      if (typeof event === "string") { response = event; continue; }
      yield event;
      if (event.type === "agent_complete") response = event.content || "";
    }
    history.push({ role: "debugger", content: response });

    // Developer applies the fix
    const execFixMsgs: ChatMessage[] = [
      { role: "system", content: AGENTS.developer.systemPrompt },
      {
        role: "user",
        content: buildContext(
          task,
          history,
          `URGENT: The code crashed during real execution. The Debugger has diagnosed the issue above. Apply the fix and output the COMPLETE corrected code. Make sure ALL imports and API calls are correct.`
        ),
      },
    ];

    response = "";
    for await (const event of runAgent("developer", execFixMsgs)) {
      if (typeof event === "string") { response = event; continue; }
      yield event;
      if (event.type === "agent_complete") response = event.content || "";
    }
    history.push({ role: "developer", content: response });
    latestCode = response;
  }

  // ──────────────────────────────────────────
  // Done
  // ──────────────────────────────────────────
  yield {
    type: "workflow_complete",
    cycle,
    executionSuccess,
    timestamp: Date.now(),
  };
}
