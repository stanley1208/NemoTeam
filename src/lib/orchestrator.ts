import { AGENTS } from "./agents";
import { streamNemotronChat, ChatMessage } from "./nemotron";
import { AgentRole, SSEEvent, CodeBlock } from "@/types";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const MAX_EVOLUTION_CYCLES = 3;
const MAX_EXECUTION_RETRIES = 10;
const EXECUTION_TIMEOUT_MS = 300000; // 300 second timeout (large GPU + CPU benchmarks need time)
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
      info.push("- CuPy is installed.");
      info.push("- CRITICAL CuPy API: cupy.cuda.runtime.getDeviceProperties(0) returns a DICT, not an object. Access fields as p['name'].decode() and p['totalGlobalMem'], NOT p.name or p.total_memory. This is the #1 most common CuPy bug.");
      info.push("- Do NOT use cupy.cuda.get_device_properties (does not exist). Do NOT use cupy.cuda.Device().attributes (unreliable).");
      info.push("- CRITICAL CuPy TIMING: CuPy operations are ASYNCHRONOUS. You MUST call cp.cuda.Stream.null.synchronize() BEFORE stopping the timer, otherwise you only measure kernel launch time (microseconds) instead of actual computation time. Always do: start=time.time(); [gpu_ops]; cp.cuda.Stream.null.synchronize(); gpu_time=time.time()-start");
      info.push("- CRITICAL CuPy VECTORIZATION: ALL GPU operations must be FULLY VECTORIZED using CuPy array operations. NEVER use Python for-loops over data on GPU. For Monte Carlo: generate ALL random paths in one cp.random call, compute ALL payoffs with array operations. If GPU is slower than CPU, the code has a vectorization bug.");
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
  info.push("- The code will be executed automatically after generation. It MUST run without errors AND produce correct results.");

  // Quality rules for ML/benchmark code
  info.push("- For GPU vs CPU benchmarks: use LARGE datasets (10000+ points) and LARGE networks (512+ neurons per layer) so GPU speedup is clearly visible. Small workloads show no GPU advantage due to transfer overhead.");
  info.push("- For neural networks: a well-implemented network MUST show decreasing loss and >70% accuracy on synthetic data. If accuracy is below 50%, the backpropagation or training loop has a bug.");
  info.push("- For numerical code: use numerically stable implementations (e.g., log-sum-exp trick for softmax, clip gradients, proper weight initialization like He/Xavier).");
  info.push("- IMPORTANT: The output will be validated automatically. Low accuracy, NaN values, or GPU slower than CPU will be flagged as failures and trigger auto-debugging.");

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

    // Normalize slashes to forward slashes
    const normalizedName = filename.replace(/\\/g, "/");

    // Remove any leading slashes, dots, and strip "output/" prefix if the AI included it
    // (since we already save into OUTPUT_DIR, we don't want output/output/)
    const safeName = normalizedName
      .replace(/^[./\\]+/, "")
      .replace(/^output\//i, "")
      .replace(/[^a-zA-Z0-9._/\\-]/g, "_");

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
    // Single-line Python script that safely handles namespace packages (origin=None).
    // torch: has origin → dirname(origin) + /lib
    // nvidia.cuda_nvrtc: namespace pkg (no origin) → submodule_search_locations[0] + /bin
    const cmd = 'python -c "' +
      "import importlib.util,os,pathlib;paths=[];" +
      "spec=importlib.util.find_spec('torch');" +
      "paths.append(str(pathlib.Path(spec.origin).parent/'lib')) if spec and spec.origin else None;" +
      "spec=importlib.util.find_spec('nvidia.cuda_nvrtc');" +
      "[paths.append(os.path.join(str(p),'bin')) for p in (spec.submodule_search_locations if spec and spec.submodule_search_locations else [])];" +
      "print(os.pathsep.join([p for p in paths if os.path.isdir(p)]))" +
      '"';

    const result = execSync(cmd, {
      encoding: "utf-8", timeout: 10000, windowsHide: true,
    }).trim();
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
 * Validate the quality of program output.
 * Returns a description of issues found, or null if output looks good.
 * This catches "code runs but results are wrong" scenarios.
 */
function validateOutputQuality(output: string): string | null {
  const issues: string[] = [];
  const lower = output.toLowerCase();

  // 1. Check for NaN / Infinity in numerical output
  const nanMatches = output.match(/\bnan\b/gi);
  if (nanMatches && nanMatches.length >= 2) {
    issues.push(`Output contains NaN values (${nanMatches.length} occurrences) — likely a numerical instability bug (exploding gradients, division by zero, or log of zero)`);
  }
  const infMatches = output.match(/\binf\b/gi);
  if (infMatches && infMatches.length >= 2) {
    issues.push(`Output contains Infinity values (${infMatches.length} occurrences) — numerical overflow`);
  }

  // 2. Check training accuracy if present
  // Look for patterns like "accuracy: 0.33", "acc: 42%", "train acc: 0.41"
  const accPatterns = [
    /(?:train|training)\s*(?:acc|accuracy)[:\s]*([0-9.]+)/gi,
    /(?:acc|accuracy)[:\s]*([0-9.]+)%?/gi,
  ];
  const accuracies: number[] = [];
  for (const pat of accPatterns) {
    let m;
    while ((m = pat.exec(output)) !== null) {
      let val = parseFloat(m[1]);
      if (val > 1 && val <= 100) val /= 100; // convert percentage to decimal
      if (val >= 0 && val <= 1) accuracies.push(val);
    }
  }

  // If there are accuracy values and the FINAL ones are suspiciously low
  if (accuracies.length >= 3) {
    // Check last few accuracy readings (end of training)
    const lastAccuracies = accuracies.slice(-4);
    const avgFinalAcc = lastAccuracies.reduce((a, b) => a + b, 0) / lastAccuracies.length;
    if (avgFinalAcc < 0.5) {
      issues.push(
        `Training accuracy is very low (final average: ${(avgFinalAcc * 100).toFixed(1)}%). ` +
        `For most classification tasks, a properly implemented neural network should reach >70% accuracy. ` +
        `This suggests bugs in: backpropagation gradients, learning rate (too high/low), weight initialization, ` +
        `softmax/cross-entropy implementation, or data preprocessing.`
      );
    }
  }

  // 3. Check test accuracy specifically
  const testAccPattern = /(?:test)\s*(?:acc|accuracy)[:\s]*([0-9.]+)%?/gi;
  const testAccuracies: number[] = [];
  let tm;
  while ((tm = testAccPattern.exec(output)) !== null) {
    let val = parseFloat(tm[1]);
    if (val > 1 && val <= 100) val /= 100;
    if (val >= 0 && val <= 1) testAccuracies.push(val);
  }
  if (testAccuracies.length >= 2) {
    const lastTestAccs = testAccuracies.slice(-3);
    const avgTestAcc = lastTestAccs.reduce((a, b) => a + b, 0) / lastTestAccs.length;
    if (avgTestAcc < 0.1 && accuracies.length > 0) {
      const avgTrainAcc = accuracies.slice(-3).reduce((a, b) => a + b, 0) / Math.min(accuracies.length, 3);
      if (avgTrainAcc > avgTestAcc + 0.2) {
        issues.push(
          `Test accuracy (${(avgTestAcc * 100).toFixed(1)}%) is drastically lower than train accuracy (${(avgTrainAcc * 100).toFixed(1)}%). ` +
          `This large gap suggests a bug in the test evaluation code, not just overfitting.`
        );
      }
    }
  }

  // 4. Check for GPU vs CPU speedup if this is a benchmark
  // Check ALL speedup values in the output (not just the first one)
  if (lower.includes("speedup") || (lower.includes("gpu time") && lower.includes("cpu time"))) {
    const speedupRegex = /speedup[:\s|]*([0-9.]+)\s*x?/gi;
    const slowTasks: string[] = [];
    let sm;
    while ((sm = speedupRegex.exec(output)) !== null) {
      const speedup = parseFloat(sm[1]);
      if (speedup < 1.0) {
        // Try to find the task name near this match (look backwards in the output)
        const before = output.slice(Math.max(0, sm.index - 200), sm.index);
        const taskMatch = before.match(/===\s*(.+?)\s*===/g);
        const taskName = taskMatch ? taskMatch[taskMatch.length - 1].replace(/===/g, "").trim() : "a task";
        slowTasks.push(`${taskName} (${speedup}x)`);
      }
    }

    // Also check the summary table format: | Task | GPU Time | CPU Time | Speedup |
    const tableRowRegex = /\|\s*([^|]+?)\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|/g;
    let tr;
    while ((tr = tableRowRegex.exec(output)) !== null) {
      const taskName = tr[1].trim();
      const gpuTime = parseFloat(tr[2]);
      const cpuTime = parseFloat(tr[3]);
      const speedup = parseFloat(tr[4]);
      if (speedup < 1.0 || (gpuTime > cpuTime && !isNaN(gpuTime) && !isNaN(cpuTime))) {
        if (!slowTasks.some((s) => s.includes(taskName))) {
          slowTasks.push(`${taskName} (${speedup}x)`);
        }
      }
    }

    if (slowTasks.length > 0) {
      issues.push(
        `GPU is SLOWER than CPU for: ${slowTasks.join(", ")}. ` +
        `This means the GPU code is NOT properly vectorized. ALL operations must use CuPy array operations — ` +
        `NEVER use Python for-loops over data. For Monte Carlo: generate all random paths in ONE cp.random call. ` +
        `Also ensure cp.cuda.Stream.null.synchronize() is called before timing to measure actual GPU computation.`
      );
    }
  }

  // 5. Check for loss not decreasing (stuck training)
  const lossPattern = /loss[:\s]*([0-9.]+)/gi;
  const losses: number[] = [];
  let lm;
  while ((lm = lossPattern.exec(output)) !== null) {
    const val = parseFloat(lm[1]);
    if (val >= 0 && val < 100) losses.push(val);
  }
  if (losses.length >= 5) {
    const firstLoss = losses[0];
    const lastLoss = losses[losses.length - 1];
    if (lastLoss >= firstLoss * 0.95) {
      issues.push(
        `Loss is NOT decreasing during training (first: ${firstLoss.toFixed(4)}, last: ${lastLoss.toFixed(4)}). ` +
        `The network is not learning. Check: learning rate, gradient computation, weight updates.`
      );
    }
  }

  // 6. Check for all-zero output
  if (/accuracy[:\s]*0\.0+[,\s]/g.test(output) && (output.match(/accuracy[:\s]*0\.0+[,\s]/g) || []).length > 5) {
    issues.push("Multiple accuracy readings are exactly 0.0 — the model is producing constant predictions (all same class).");
  }

  return issues.length > 0 ? issues.join("\n\n") : null;
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

    // Check if the output contains signs of a caught/hidden error.
    // Includes both raw Python exceptions AND reformatted error messages
    // (e.g., code caught the exception and printed "Error: ..." instead of crashing).
    const errorPatterns = [
      // Raw Python exceptions
      /Traceback \(most recent call last\)/,
      /AttributeError:/,
      /TypeError:/,
      /ValueError:/,
      /IndexError:/,
      /KeyError:/,
      /NameError:/,
      /RuntimeError:/,
      /ModuleNotFoundError:/,
      /ImportError:/,
      /FileNotFoundError:/,
      /SyntaxError:/,
      /PermissionError:/,
      /ZeroDivisionError:/,
      /MemoryError:/,
      /OverflowError:/,
      /CUDAError:|cudaError/,
      /CUDA out of memory/i,
      /No module named ['"]?\w+['"]?/,

      // Reformatted/caught errors (code did try/except and printed a message)
      /has no attribute ['"]?\w+/,                     // "'dict' object has no attribute 'name'"
      /object is not callable/,                        // "TypeError: ... is not callable"
      /cannot be broadcast/i,                          // numpy/cupy shape mismatch
      /not supported between instances/,               // comparison type error
      /invalid literal for/,                           // int/float parsing error

      // Explicit failure messages printed by the code
      /training failed/i,                              // "Training failed"
      /execution failed/i,                             // "Execution failed"
      /fatal error/i,                                  // "Fatal error"
      /program terminated/i,                           // "Program terminated"
      /please check the error/i,                       // "Please check the error messages"
    ];

    const hasHiddenError = errorPatterns.some((pat) => pat.test(trimmed));

    if (hasHiddenError) {
      return {
        success: false,
        output: trimmed,
        error: `Code ran but produced error output:\n${trimmed}`,
      };
    }

    // ── Output quality validation ──
    // Even if the code ran without crashing, check if the results make sense.
    // Catches: NaN outputs, suspiciously low accuracy, negative times, etc.
    const qualityIssues = validateOutputQuality(trimmed);
    if (qualityIssues) {
      return {
        success: false,
        output: trimmed,
        error: `Code ran without crashing but produced BAD RESULTS:\n${qualityIssues}\n\nFull output:\n${trimmed}`,
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

  // ── Error tracking ──
  // Each entry: { signature, fullError, attempt }
  const errorLog: { sig: string; full: string; attempt: number }[] = [];

  /**
   * Extract a short "signature" from an error so we can detect repeats.
   * Takes the last meaningful error line (e.g. "ValueError: operands could not be broadcast...").
   */
  function getErrorSignature(error: string): string {
    const lines = error.split("\n").map((l) => l.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      if (/Error:|Exception:|FAILED|error occurred/i.test(lines[i])) {
        return lines[i].slice(0, 200);
      }
    }
    return lines.slice(-1)[0]?.slice(0, 200) || "unknown error";
  }

  /**
   * Count consecutive occurrences of the same error at the end of errorLog.
   */
  function getConsecutiveRepeatCount(sig: string): number {
    let count = 0;
    for (let i = errorLog.length - 1; i >= 0; i--) {
      if (errorLog[i].sig === sig) count++;
      else break;
    }
    return count;
  }

  /**
   * Get all unique errors seen so far (deduped by signature).
   */
  function getUniqueErrors(): { sig: string; full: string; count: number }[] {
    const map = new Map<string, { sig: string; full: string; count: number }>();
    for (const e of errorLog) {
      const existing = map.get(e.sig);
      if (existing) {
        existing.count++;
      } else {
        map.set(e.sig, { sig: e.sig, full: e.full, count: 1 });
      }
    }
    return Array.from(map.values());
  }

  // ── Capture key design context from Phase 1/2 ──
  // Preserve the Architect plan and latest Reviewer insights so Phase 3
  // agents still understand the intended design without the full verbose history.
  const architectPlan = history.find((h) => h.role === "architect")?.content || "";
  const lastReview = [...history].reverse().find((h) => h.role === "reviewer")?.content || "";

  /**
   * Build a focused BUT complete context for the execution debug loop.
   *
   * Includes:
   *   1. System context (dynamic environment)
   *   2. Original task
   *   3. Architect's design plan (condensed) — preserves structural intent
   *   4. Last Reviewer feedback — preserves quality insights
   *   5. The LATEST code that was executed
   *   6. The EXACT current runtime error
   *   7. FULL error history — all previous errors (same AND different)
   *   8. Escalation instructions based on error patterns
   */
  function buildExecDebugContext(
    errorOutput: string,
    stdout: string,
    attempt: number,
  ): string {
    let ctx = `${getSystemContext()}\n\nOriginal task: ${task}\n\n`;

    // ── Design context from Phase 1/2 (keeps agents grounded) ──
    if (architectPlan) {
      ctx += `--- ARCHITECT'S DESIGN PLAN (follow this structure) ---\n${architectPlan}\n\n`;
    }
    if (lastReview) {
      ctx += `--- LAST REVIEWER FEEDBACK (keep these fixes) ---\n${lastReview}\n\n`;
    }

    // ── The latest code that was actually executed ──
    ctx += `--- LATEST CODE (this is what was executed and failed) ---\n${latestCode}\n\n`;

    // ── Current error ──
    ctx += `--- CURRENT RUNTIME ERROR (attempt ${attempt}/${MAX_EXECUTION_RETRIES}) ---\n`;
    ctx += `Error:\n${errorOutput}\n`;
    if (stdout && stdout !== errorOutput) {
      ctx += `\nPartial stdout before crash:\n${stdout}\n`;
    }
    ctx += "\n";

    // ── Full error history (ALL errors, same or different) ──
    const uniqueErrors = getUniqueErrors();
    if (errorLog.length > 0) {
      ctx += `--- ERROR HISTORY (${errorLog.length} total failures, ${uniqueErrors.length} unique errors) ---\n`;
      errorLog.forEach((e, i) => {
        ctx += `  Attempt ${i + 1}: ${e.sig}\n`;
      });
      ctx += "\n";

      // Show unique error summary with counts
      if (uniqueErrors.length > 1) {
        ctx += `--- UNIQUE ERRORS ENCOUNTERED ---\n`;
        uniqueErrors.forEach((e) => {
          ctx += `  [${e.count}x] ${e.sig}\n`;
        });
        ctx += "\n";
        ctx += `⚠️ MULTIPLE DIFFERENT ERRORS: You have caused ${uniqueErrors.length} different types of errors across ${errorLog.length} attempts. `;
        ctx += `When fixing the current error, make sure you do NOT reintroduce any of the previously fixed errors listed above.\n\n`;
      }
    }

    // ── Escalation based on current error pattern ──
    const currentSig = getErrorSignature(errorOutput);
    const consecutiveRepeats = getConsecutiveRepeatCount(currentSig);

    if (consecutiveRepeats >= 3) {
      ctx += `🚨 CRITICAL ESCALATION: This EXACT same error has occurred ${consecutiveRepeats} times IN A ROW. `;
      ctx += `Every previous "fix" produced the same bug. You MUST:\n`;
      ctx += `1. COMPLETELY REWRITE the failing function/section using a FUNDAMENTALLY DIFFERENT algorithm\n`;
      ctx += `2. Do NOT just tweak numbers or add try/except — the core logic is wrong\n`;
      ctx += `3. Simplify the code if needed — a working simple version beats a broken complex one\n`;
      ctx += `4. If the error is about array shapes/broadcasting, recalculate ALL dimensions from scratch\n`;
      ctx += `5. Add print() statements BEFORE the failing line to verify shapes/values\n`;
      ctx += `6. Consider removing the problematic feature entirely and using a simpler alternative\n\n`;
    } else if (consecutiveRepeats >= 2) {
      ctx += `⚠️ WARNING: This same error happened ${consecutiveRepeats} times consecutively. `;
      ctx += `Your previous fix did NOT work. Try a DIFFERENT approach entirely.\n\n`;
    }

    if (errorLog.length >= 5) {
      ctx += `⚠️ PERSISTENCE ALERT: ${errorLog.length} failed attempts so far. `;
      ctx += `Focus on getting the code to RUN correctly, even if it means simplifying. `;
      ctx += `A working simple solution is better than a broken complex one.\n\n`;
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

    // Track this error (both signature and full text)
    const rawError = result.error || result.output;
    const errorSig = getErrorSignature(rawError);
    errorLog.push({ sig: errorSig, full: rawError, attempt: executionAttempt });

    // Analyze error patterns
    const consecutiveRepeats = getConsecutiveRepeatCount(errorSig);
    const uniqueErrors = getUniqueErrors();
    const totalUniqueCount = uniqueErrors.length;

    if (executionAttempt >= MAX_EXECUTION_RETRIES) break;

    // Build status label for the UI
    let statusLabel = `Execution failed — auto-debugging (attempt ${executionAttempt}/${MAX_EXECUTION_RETRIES})`;
    if (consecutiveRepeats >= 2) {
      statusLabel += ` [SAME ERROR x${consecutiveRepeats} — escalating]`;
    } else if (totalUniqueCount > 1) {
      statusLabel += ` [${totalUniqueCount} different errors seen — tracking all]`;
    }

    cycle++;
    yield {
      type: "evolution_cycle",
      cycle,
      maxCycles: MAX_EVOLUTION_CYCLES + MAX_EXECUTION_RETRIES,
      content: statusLabel,
      timestamp: Date.now(),
    };

    // Build focused context with full error history + design context
    const execContext = buildExecDebugContext(
      rawError,
      result.output,
      executionAttempt,
    );

    // ── Debugger: diagnose crash + full code audit ──
    // The Debugger always does TWO things:
    //   A) Fix the specific crash
    //   B) Audit the ENTIRE code for all other potential bugs
    const multiFixNote = `\n\nIMPORTANT: After diagnosing the crash, you MUST also audit the ENTIRE code for ALL other potential bugs — wrong shapes, bad API calls, missing imports, logic errors, edge cases, type mismatches, etc. Fix EVERYTHING in this one round so we don't keep hitting new errors one at a time.`;

    let debugInstruction: string;
    if (consecutiveRepeats >= 3) {
      debugInstruction = `CRITICAL: The code has crashed ${consecutiveRepeats} times with the SAME error. Previous fixes all failed. You MUST identify WHY the fixes didn't work and propose a COMPLETELY DIFFERENT solution strategy. Do NOT suggest the same fix again.${multiFixNote}`;
    } else if (consecutiveRepeats >= 2) {
      debugInstruction = `WARNING: This is the same error as last time — your previous fix did not work. Analyze WHY it didn't work and propose a DIFFERENT fix approach.${multiFixNote}`;
    } else if (totalUniqueCount > 1) {
      debugInstruction = `The code crashed with a NEW error (different from previous attempts). The previous fix resolved the old bug but introduced a new one. Diagnose the NEW error, and also check that your fix does NOT reintroduce any of the ${totalUniqueCount - 1} previously fixed errors (listed in error history).${multiFixNote}`;
    } else {
      debugInstruction = `The code was executed and CRASHED with a real runtime error. Diagnose the exact root cause.${multiFixNote}`;
    }

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

    // ── Developer: apply ALL fixes at once ──
    const allFixNote = `\n\nCRITICAL: Apply ALL fixes identified by the Debugger — not just the crash, but every bug found during the full code audit. The goal is to fix EVERY issue in one pass so the code runs clean on the next execution.`;

    let devInstruction: string;
    if (consecutiveRepeats >= 3) {
      devInstruction = `CRITICAL: You have tried to fix this ${consecutiveRepeats} times and FAILED. The SAME error keeps happening. You MUST:\n1. REWRITE the broken section completely using a FUNDAMENTALLY different algorithm\n2. Do NOT copy-paste your previous code with minor tweaks\n3. Add print() statements to verify values at key steps\n4. Simplify if needed — working simple code > broken complex code\n\nThe Debugger found these issues:\n${response}${allFixNote}\n\nOutput the COMPLETE corrected code for ALL files.`;
    } else if (consecutiveRepeats >= 2) {
      devInstruction = `Your previous fix did NOT resolve the error. The Debugger found:\n${response}\n\nTry a DIFFERENT approach this time.${allFixNote}\n\nOutput the COMPLETE corrected code for ALL files.`;
    } else if (totalUniqueCount > 1) {
      devInstruction = `The previous fix resolved the old bug but introduced a NEW error. The Debugger's full analysis:\n${response}\n\nFix ALL issues found, and MAKE SURE you do NOT reintroduce any of the ${totalUniqueCount - 1} previously fixed bugs.${allFixNote}\n\nOutput the COMPLETE corrected code for ALL files.`;
    } else {
      devInstruction = `The code crashed during execution. The Debugger's full analysis:\n${response}${allFixNote}\n\nOutput the COMPLETE corrected code for ALL files. Make sure ALL imports and API calls are correct.`;
    }

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
