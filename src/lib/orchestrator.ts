import { AGENTS } from "./agents";
import { streamNemotronChat, ChatMessage } from "./nemotron";
import { AgentRole, SSEEvent, CodeBlock } from "@/types";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const MAX_EVOLUTION_CYCLES = 3;
const MAX_EXECUTION_RETRIES = 10;
const EXECUTION_TIMEOUT_MS = 120000; // 120 second timeout (GPU benchmarks / CPU comparisons need time)
const OUTPUT_DIR = path.join(process.cwd(), "output");

/**
 * Detect system environment automatically.
 * Cached after first call so we don't re-detect every time.
 */
let _cachedSystemContext: string | null = null;

function getSystemContext(): string {
  if (_cachedSystemContext) return _cachedSystemContext;

  const info: string[] = [
    "SYSTEM ENVIRONMENT (use this info to write compatible code):",
  ];

  // OS
  info.push(`- OS: ${process.platform === "win32" ? "Windows" : process.platform} ${process.arch}`);

  // Node.js
  info.push(`- Node.js: ${process.version}`);

  // Python version
  try {
    const pyVer = execSync("python --version", { encoding: "utf-8", timeout: 5000, windowsHide: true }).trim();
    info.push(`- ${pyVer}`);
  } catch {
    info.push("- Python: not detected");
  }

  // GPU detection
  try {
    const gpuInfo = execSync(
      'python -c "import cupy; p=cupy.cuda.runtime.getDeviceProperties(0); print(p[\'name\'].decode()); print(round(p[\'totalGlobalMem\']/1024**3,1))"',
      { encoding: "utf-8", timeout: 15000, windowsHide: true, env: getExecEnv() }
    ).trim().split("\n");
    if (gpuInfo.length >= 2) {
      info.push(`- GPU: ${gpuInfo[0]} (${gpuInfo[1]} GB)`);
      info.push("- CuPy is installed. Use cupy.cuda.runtime.getDeviceProperties(0) for GPU info (NOT cupy.cuda.get_device_properties)");
    }
  } catch {
    // Try nvidia-smi as fallback
    try {
      const smiCmd = process.platform === "win32" ? "nvidia-smi" : "nvidia-smi";
      const smi = execSync(`${smiCmd} --query-gpu=name,memory.total --format=csv,noheader`, {
        encoding: "utf-8", timeout: 5000, windowsHide: true,
      }).trim();
      if (smi) info.push(`- GPU: ${smi}`);
    } catch {
      info.push("- GPU: none detected (CPU only)");
    }
  }

  // Detect key Python packages
  try {
    const pkgs = execSync(
      'python -c "import importlib; pkgs=[\'numpy\',\'cupy\',\'torch\',\'flask\',\'fastapi\',\'requests\',\'pandas\',\'matplotlib\']; installed=[p for p in pkgs if importlib.util.find_spec(p)]; print(\',\'.join(installed))"',
      { encoding: "utf-8", timeout: 10000, windowsHide: true }
    ).trim();
    if (pkgs) info.push(`- Installed Python packages: ${pkgs}`);
  } catch {
    // skip
  }

  // File structure rules (always included)
  info.push("- All generated files are saved to an output/ directory. Subdirectories are supported.");
  info.push("- The main entry file MUST be named main.py (or contain 'main' in its name).");
  info.push("- For simple tasks, prefer a single file. For complex tasks, use proper package imports.");
  info.push("- The code will be executed automatically after generation. It MUST run without errors.");

  _cachedSystemContext = info.join("\n");
  return _cachedSystemContext;
}

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
    // Remove the entire output directory and recreate it
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
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

    // Normalize slashes to OS separator but PRESERVE directory structure
    const normalizedName = filename.replace(/\\/g, "/");

    // Remove any leading slashes or dots for safety
    const safeName = normalizedName.replace(/^[./\\]+/, "").replace(/[^a-zA-Z0-9._/\\-]/g, "_");

    // Remove the "// filename: ..." comment line from the code before saving
    const cleanCode = block.code.replace(
      /^(?:\/\/|#|--|\/\*)\s*filename:\s*.+?(?:\s*\*\/)?[\r\n]+/m,
      ""
    );

    const filePath = path.join(OUTPUT_DIR, ...safeName.split("/"));

    // Create subdirectories if needed
    const fileDir = path.dirname(filePath);
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }

    // If this is a Python package directory, create __init__.py if missing
    if (ext === "py" && fileDir !== OUTPUT_DIR) {
      const initFile = path.join(fileDir, "__init__.py");
      if (!fs.existsSync(initFile)) {
        fs.writeFileSync(initFile, "", "utf-8");
      }
    }

    fs.writeFileSync(filePath, cleanCode, "utf-8");

    block.savedPath = filePath;
    savedPaths.push(safeName);
  }

  return savedPaths;
}

/**
 * Dynamically find CUDA DLL paths from Python packages.
 */
let _cachedCudaPaths: string | null = null;

function getCudaDllPaths(): string {
  if (_cachedCudaPaths !== null) return _cachedCudaPaths;

  try {
    // Ask Python where the CUDA DLLs are
    const result = execSync(
      'python -c "import importlib.util, os; paths=[]; ' +
      '[paths.append(os.path.join(os.path.dirname(importlib.util.find_spec(p).origin), d)) ' +
      'for p,d in [(\'torch\',\'lib\'),(\'nvidia.cuda_nvrtc\',\'bin\')] ' +
      'if importlib.util.find_spec(p)]; ' +
      'print(os.pathsep.join([p for p in paths if os.path.isdir(p)]))"',
      { encoding: "utf-8", timeout: 10000, windowsHide: true }
    ).trim();
    _cachedCudaPaths = result;
  } catch {
    _cachedCudaPaths = "";
  }
  return _cachedCudaPaths;
}

/**
 * Build the environment variables for execution (includes dynamically detected CUDA DLL paths).
 */
function getExecEnv(): NodeJS.ProcessEnv {
  const cudaPaths = getCudaDllPaths();
  const envPath = cudaPaths
    ? `${cudaPaths}${path.delimiter}${process.env.PATH || ""}`
    : process.env.PATH || "";

  return {
    ...process.env,
    PATH: envPath,
    PYTHONPATH: OUTPUT_DIR,
  };
}

/**
 * Try to auto-install a missing Python package.
 */
function tryAutoInstall(errorText: string): boolean {
  const match = errorText.match(/No module named ['"]?(\w+)['"]?/i);
  if (!match) return false;

  const moduleName = match[1].toLowerCase();
  // Don't try to install local modules or standard lib modules
  const skipModules = new Set([
    "utils", "network", "benchmark", "model", "config", "helpers",
    "lib", "core", "data", "test", "tests", "main", "app",
  ]);
  if (skipModules.has(moduleName)) return false;

  try {
    execSync(`pip install ${moduleName}`, {
      timeout: 30000,
      encoding: "utf-8",
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
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

    const trimmed = output.trim();

    // Check if the output contains signs of a caught/hidden error
    const errorPatterns = [
      /error occurred/i,
      /traceback \(most recent call last\)/i,
      /has no attribute/i,
      /module.*not found/i,
      /importerror/i,
      /no module named/i,
      /permission denied/i,
      /filenotfounderror/i,
      /syntaxerror/i,
      /please ensure/i,
      /failed to/i,
    ];

    const hasHiddenError = errorPatterns.some((pat) => pat.test(trimmed));

    if (hasHiddenError) {
      return {
        success: false,
        output: trimmed,
        error: `Code ran but produced error output:\n${trimmed}`,
      };
    }

    return { success: true, output: trimmed, error: "" };
  } catch (err: unknown) {
    const execErr = err as { stderr?: string; stdout?: string; message?: string; status?: number };
    const stderr = execErr.stderr || "";
    const stdout = execErr.stdout || "";
    const msg = execErr.message || "Unknown execution error";
    const fullError = stderr || msg;

    // Try auto-installing missing packages before giving up
    if (/no module named/i.test(fullError) || /ModuleNotFoundError/i.test(fullError)) {
      const installed = tryAutoInstall(fullError);
      if (installed) {
        // Retry execution after installing the package
        try {
          const retryOutput = execSync(cmd, {
            timeout: EXECUTION_TIMEOUT_MS,
            encoding: "utf-8",
            cwd: OUTPUT_DIR,
            env: getExecEnv(),
            maxBuffer: 1024 * 1024,
            windowsHide: true,
          });
          return { success: true, output: retryOutput.trim(), error: "" };
        } catch {
          // Still failed after install — fall through to error handling
        }
      }
    }

    // Extract just the meaningful error (last part of traceback)
    let cleanError = fullError;
    const lines = cleanError.split("\n");
    if (lines.length > 20) {
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

  // Get just the basename for matching
  const withBase = savedFiles.map((f) => ({
    full: f,
    base: path.basename(f).toLowerCase(),
  }));

  // Priority 1: file named exactly "main.*"
  const mainFile = withBase.find(
    (f) => f.base.match(/^main\.\w+$/) && runnableExts.includes(path.extname(f.base))
  );
  if (mainFile) return mainFile.full;

  // Priority 2: file with "main" in the basename (e.g. "benchmark_main.py")
  const mainish = withBase.find(
    (f) => f.base.includes("main") && runnableExts.includes(path.extname(f.base))
  );
  if (mainish) return mainish.full;

  // Priority 3: skip files that look like tests, utils, helpers, or __init__
  const skipPatterns = /^(test_|tests_|utils|helpers|lib|config|__init__)/i;
  const appFile = withBase.find(
    (f) => !skipPatterns.test(f.base) && !f.full.includes("__init__") && runnableExts.includes(path.extname(f.base))
  );
  if (appFile) return appFile.full;

  // Fallback: first runnable file that isn't __init__
  const fallback = withBase.find(
    (f) => !f.base.startsWith("__init__") && runnableExts.includes(path.extname(f.base))
  );
  return fallback?.full || null;
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
  let context = `${getSystemContext()}\n\nOriginal task: ${task}\n\n--- Team Conversation ---\n`;
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
    { role: "user", content: `${getSystemContext()}\n\nHere is the coding task:\n\n${task}` },
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
  // fixes → Re-save → Re-run.
  // Tracks repeated errors and escalates
  // instructions when the same bug recurs.
  // Never gives up until max retries exhausted.
  // ──────────────────────────────────────────

  let executionSuccess = false;
  let executionAttempt = 0;
  const previousErrors: string[] = []; // Track error signatures to detect repeats

  /**
   * Extract a short "signature" from an error so we can detect repeats.
   * Takes the last meaningful error line (e.g. "ValueError: operands could not be broadcast...").
   */
  function getErrorSignature(error: string): string {
    const lines = error.split("\n").map((l) => l.trim()).filter(Boolean);
    // Find the last line that looks like an actual error (ErrorType: message)
    for (let i = lines.length - 1; i >= 0; i--) {
      if (/Error:|Exception:|FAILED|error occurred/i.test(lines[i])) {
        return lines[i].slice(0, 150); // cap length
      }
    }
    return lines.slice(-1)[0]?.slice(0, 150) || "unknown error";
  }

  /**
   * Build a focused context for the execution debug loop.
   * Instead of the FULL history (which gets huge), include only:
   *   1. System context
   *   2. Original task
   *   3. The LATEST code that was executed
   *   4. The EXACT runtime error
   *   5. Previous failed attempts summary (if repeating)
   */
  function buildExecDebugContext(
    errorOutput: string,
    stdout: string,
    attempt: number,
    repeatCount: number
  ): string {
    let ctx = `${getSystemContext()}\n\nOriginal task: ${task}\n\n`;

    // Include only the latest code (what actually ran)
    ctx += `--- LATEST CODE (this is what was executed and failed) ---\n${latestCode}\n\n`;

    // The actual error
    ctx += `--- REAL RUNTIME ERROR (attempt ${attempt}/${MAX_EXECUTION_RETRIES}) ---\n`;
    ctx += `Error:\n${errorOutput}\n`;
    if (stdout) {
      ctx += `\nPartial stdout before crash:\n${stdout}\n`;
    }
    ctx += "\n";

    // If same error is repeating, escalate strongly
    if (repeatCount >= 3) {
      ctx += `⚠️ CRITICAL ESCALATION: This EXACT same error has occurred ${repeatCount} times in a row. `;
      ctx += `Every previous "fix" produced the same bug. You MUST:\n`;
      ctx += `1. COMPLETELY REWRITE the failing section using a FUNDAMENTALLY DIFFERENT approach\n`;
      ctx += `2. Do NOT just tweak numbers or add try/except — the core logic is wrong\n`;
      ctx += `3. Simplify the code if needed — a working simple version beats a broken complex one\n`;
      ctx += `4. If the error is about array shapes/broadcasting, recalculate all dimensions from scratch\n`;
      ctx += `5. Add print() statements to verify shapes/values at key steps\n\n`;
    } else if (repeatCount >= 2) {
      ctx += `⚠️ WARNING: This same error happened ${repeatCount} times. Your previous fix did NOT work. `;
      ctx += `Try a DIFFERENT approach — do not repeat the same fix.\n\n`;
    }

    // Summary of all previous error attempts
    if (previousErrors.length > 0) {
      ctx += `--- PREVIOUS FAILED ATTEMPTS (${previousErrors.length} total) ---\n`;
      previousErrors.forEach((e, i) => {
        ctx += `  Attempt ${i + 1}: ${e}\n`;
      });
      ctx += "\n";
    }

    return ctx;
  }

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
    if (!mainFile) break;

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

    // ── Execution failed — begin auto-debug ──
    executionAttempt++;

    // Track error signature for repeat detection
    const errorSig = getErrorSignature(result.error || result.output);
    previousErrors.push(errorSig);

    // Count how many consecutive times this SAME error has occurred
    let repeatCount = 0;
    for (let i = previousErrors.length - 1; i >= 0; i--) {
      if (previousErrors[i] === errorSig) repeatCount++;
      else break;
    }

    if (executionAttempt >= MAX_EXECUTION_RETRIES) break;

    cycle++;
    yield {
      type: "evolution_cycle",
      cycle,
      maxCycles: MAX_EVOLUTION_CYCLES + MAX_EXECUTION_RETRIES,
      content: `Execution failed — auto-debugging (attempt ${executionAttempt}/${MAX_EXECUTION_RETRIES})${repeatCount >= 2 ? ` [SAME ERROR x${repeatCount} — escalating]` : ""}`,
      timestamp: Date.now(),
    };

    // Build focused context (not full bloated history)
    const execContext = buildExecDebugContext(
      result.error || result.output,
      result.output,
      executionAttempt,
      repeatCount
    );

    // Debugger diagnoses the real error
    const debugInstruction = repeatCount >= 3
      ? `CRITICAL: The code has crashed ${repeatCount} times with the SAME error. Previous fixes all failed. You MUST identify WHY the fixes didn't work and propose a COMPLETELY DIFFERENT solution strategy. Do NOT suggest the same fix again.`
      : repeatCount >= 2
        ? `WARNING: This is the same error as last time — your previous fix did not work. Analyze why and propose a DIFFERENT fix approach.`
        : `The code was executed and CRASHED with a real runtime error. Diagnose the exact root cause and provide precise, specific fix instructions.`;

    const execDebugMsgs: ChatMessage[] = [
      { role: "system", content: AGENTS.debugger.systemPrompt },
      { role: "user", content: execContext + `\n--- Instructions ---\n${debugInstruction}` },
    ];

    response = "";
    for await (const event of runAgent("debugger", execDebugMsgs)) {
      if (typeof event === "string") { response = event; continue; }
      yield event;
      if (event.type === "agent_complete") response = event.content || "";
    }

    // Developer applies the fix with focused context
    const devInstruction = repeatCount >= 3
      ? `CRITICAL: You have tried to fix this ${repeatCount} times and FAILED every time. The SAME error keeps happening. You MUST:\n1. REWRITE the broken section completely using a different algorithm/approach\n2. Do NOT copy-paste your previous code with minor tweaks\n3. Add shape/value verification print() statements\n4. Simplify if needed — working simple code > broken complex code\n\nThe Debugger's analysis:\n${response}\n\nOutput the COMPLETE corrected code for ALL files.`
      : repeatCount >= 2
        ? `Your previous fix did NOT resolve the error. The Debugger found: ${response}\n\nTry a DIFFERENT approach this time. Output the COMPLETE corrected code for ALL files.`
        : `The code crashed during execution. The Debugger's diagnosis:\n${response}\n\nApply the fix and output the COMPLETE corrected code for ALL files. Make sure ALL imports and API calls are correct.`;

    const execFixMsgs: ChatMessage[] = [
      { role: "system", content: AGENTS.developer.systemPrompt },
      { role: "user", content: execContext + `\n--- Instructions ---\n${devInstruction}` },
    ];

    response = "";
    for await (const event of runAgent("developer", execFixMsgs)) {
      if (typeof event === "string") { response = event; continue; }
      yield event;
      if (event.type === "agent_complete") response = event.content || "";
    }
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
