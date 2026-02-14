# NemoTeam — Self-Debugging Multi-Agent AI Dev Team

> 5 AI agents collaborate in real-time to architect, code, review, test, **execute on real hardware**, and **auto-debug until the code runs successfully**. Powered by **NVIDIA Nemotron** via the **NIM API**.

**#NVIDIAGTC**

---

## What is NemoTeam?

NemoTeam is an open-source multi-agent AI system where **five specialized Nemotron-powered agents** work together like a real engineering team — with a twist: **the system actually runs the code on your GPU and fixes its own bugs automatically**.

| Agent | Role | What They Do |
|-------|------|--------------|
| **Nova** (Architect) | Software Architect | Analyzes tasks, designs system architecture, creates implementation plans |
| **Axel** (Developer) | Senior Developer | Writes clean, production-ready code based on the Architect's plan |
| **Sage** (Reviewer) | Code Reviewer | Audits code for bugs, security vulnerabilities, and quality issues |
| **Vera** (Tester) | QA Engineer | Writes comprehensive tests and validates correctness |
| **Dash** (Debugger) | Debug Engineer | Diagnoses failures, performs full code audits, and specifies precise fixes |

### The Pipeline (OpenEvolve-inspired, 3 Phases)

**Phase 1 — Initial Build:**
```
User Task → Architect → Developer → Reviewer → (Revision if needed) → Tester
```

**Phase 2 — Mental Evolution Loop (if tests fail, up to 3 cycles):**
```
Tester FAILS → Debugger diagnoses → Developer fixes → Reviewer re-checks → Tester re-tests
                                    ↑                                        ↓
                                    └──────── repeat until PASS ─────────────┘
```

**Phase 3 — Real Execution + Auto-Debug (up to 10 cycles):**
```
Save code → Execute on real hardware → Success? → Done!
                    ↓ (failure)
            Debugger audits ENTIRE code → Developer fixes ALL bugs → Re-execute
                    ↑                                                    ↓
                    └──── track errors, escalate if repeating ───────────┘
```

The system doesn't just write code — it **runs it**, catches real runtime errors, and keeps fixing until the code executes successfully. It even validates output quality: low accuracy, NaN values, GPU slower than CPU, or stuck training all trigger another debug cycle.

---

## Key Features

- **Real Code Execution** — Generated code is saved to disk and executed on your actual hardware (GPU/CPU). Not just "looks correct" — it **runs correctly**.
- **Self-Debugging Loop** — When code crashes, the real error output feeds back to the Debugger. It diagnoses the issue, the Developer fixes it, and it re-runs. Up to 10 automatic retry cycles.
- **Output Quality Validation** — Even if code doesn't crash, the system checks for bad results: low training accuracy, NaN values, GPU slower than CPU, loss not decreasing. Bad results trigger auto-debug.
- **Multi-Bug Fix Per Round** — The Debugger audits the entire codebase each cycle, not just the crash line. Fixes multiple bugs at once instead of one-at-a-time.
- **Error Intelligence** — Tracks all errors (same and different) across attempts. If the same bug repeats, escalates to "try a completely different approach." If a new bug appears, warns "don't reintroduce the old one."
- **Dynamic Environment Detection** — Auto-detects OS, Python version, GPU model, CUDA paths, and installed packages. Zero hardcoded values. Works on any machine.
- **Auto Package Install** — Missing Python packages are automatically installed via pip during execution.
- **Real-Time Streaming** — Watch agents think and write live via Server-Sent Events.
- **5-Agent Collaboration** — All agents see the full conversation history. Each agent builds on what previous agents said.
- **CuPy/GPU Best Practices** — Agents are guided to use proper GPU timing (synchronization), vectorized operations, and numerically stable implementations.

---

## Demo Results

One prompt: *"Build a GPU computing showcase — matrix multiplication, FFT, Monte Carlo — GPU vs CPU"*

```
=== BENCHMARK RESULTS ===
Task                              GPU Time    CPU Time    Speedup
Matrix Multiplication (4096x4096) 0.38s       1.32s       3.5x
FFT (10M points)                  0.11s       1.24s       11.0x
Monte Carlo (5M paths)            0.08s       0.31s       3.8x
```

All running on a GTX 1080 Ti. Zero manual fixes. The code crashed multiple times during auto-debug, fixed itself, and delivered verified results.

---

## Architecture

```mermaid
flowchart TB
    User["User Input"] --> API["Next.js API Route (SSE)"]
    API --> Orch["Orchestrator"]
    
    subgraph Phase1["Phase 1: Initial Build"]
        A1["Nova - Architect"] --> A2["Axel - Developer"]
        A2 --> A3["Sage - Reviewer"]
        A3 --> A4["Vera - Tester"]
    end
    
    subgraph Phase2["Phase 2: Mental Evolution"]
        A5["Dash - Debugger"] --> A6["Developer Fix"]
        A6 --> A7["Re-Review"] --> A8["Re-Test"]
    end
    
    subgraph Phase3["Phase 3: Real Execution"]
        Save["Save to Disk"] --> Exec["Execute on GPU/CPU"]
        Exec -->|Success| Done["Done!"]
        Exec -->|Failure| Debug["Debugger + Developer Fix"]
        Debug --> Save
    end
    
    Orch --> Phase1
    Phase1 --> Phase2
    Phase2 --> Phase3
    
    A1 & A2 & A3 & A4 & A5 --> NIM["NVIDIA NIM API (Nemotron)"]
    Orch -->|SSE Stream| UI["React Frontend"]
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS 4 + Custom CSS |
| **AI Model** | `mistralai/mistral-nemotron` |
| **AI API** | NVIDIA NIM (OpenAI-compatible) |
| **Streaming** | Server-Sent Events (SSE) |
| **Code Execution** | Node.js `execSync` with dynamic CUDA environment |
| **Code Display** | react-syntax-highlighter |
| **Icons** | Lucide React |

---

## Getting Started

### Prerequisites

- **Node.js** 18+ installed
- **Python** 3.10+ (for code execution)
- **NVIDIA GPU** + CuPy (optional, for GPU benchmarks)
- **NVIDIA NIM API Key** — Get one free at [build.nvidia.com](https://build.nvidia.com)

### Setup

1. **Clone the repository:**

```bash
git clone https://github.com/stanley1208/NemoTeam.git
cd NemoTeam
```

2. **Install dependencies:**

```bash
npm install
```

3. **Set up your API key:**

```bash
cp .env.example .env
```

Edit `.env` and add your NVIDIA NIM API key:

```
NVIDIA_NIM_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxxx
```

4. **Run the development server:**

```bash
npm run dev
```

5. **Open your browser** at [http://localhost:3000](http://localhost:3000)

### Optional: GPU Support

For GPU-accelerated code execution, install CuPy:

```bash
pip install cupy-cuda12x numpy
```

The system auto-detects your GPU and CUDA paths. No manual configuration needed.

---

## How It Works

1. **User submits a task** on the landing page
2. **Orchestrator** auto-detects system environment (OS, Python, GPU, packages)
3. **Phase 1** — Agents build the initial solution:
   - Architect designs → Developer codes → Reviewer audits → Developer revises → Tester validates
4. **Phase 2** — If mental tests fail, evolution loop runs:
   - Debugger diagnoses → Developer fixes → Reviewer re-checks → Tester re-tests (up to 3 cycles)
5. **Phase 3** — Real execution with auto-debug:
   - Code saved to `output/` directory
   - Executed on real hardware with CUDA environment
   - If crash: error fed to Debugger → full code audit → Developer fixes → re-execute
   - If bad output (low accuracy, NaN, etc.): flagged as failure → auto-debug
   - Tracks all errors, escalates on repeats, prevents bug regression
   - Up to 10 execution retry cycles
6. **SSE Events** stream everything to the frontend in real-time

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Landing page
│   ├── globals.css           # Glassmorphism theme
│   ├── workspace/
│   │   └── page.tsx          # Main workspace (chat + code + execution results)
│   └── api/
│       └── agents/
│           └── route.ts      # SSE endpoint
├── components/
│   ├── Header.tsx            # Navigation bar
│   ├── TaskInput.tsx         # Task input with examples
│   ├── AgentChat.tsx         # Streaming agent messages
│   ├── AgentMessage.tsx      # Individual message rendering
│   ├── CodePanel.tsx         # Code display + execution results
│   ├── AgentAvatar.tsx       # Role-colored avatars
│   └── StatusBar.tsx         # Pipeline + evolution progress
├── lib/
│   ├── agents.ts             # 5 agent definitions + system prompts
│   ├── nemotron.ts           # NVIDIA NIM API client
│   ├── orchestrator.ts       # 3-phase pipeline + execution + auto-debug
│   └── utils.ts              # Utilities
└── types/
    └── index.ts              # TypeScript types
output/                       # Auto-generated code saved here
run_output.bat                # Manual execution helper (Windows)
```

---

## NVIDIA Technology Used

- **NVIDIA Nemotron** (`mistralai/mistral-nemotron`) — Powers all 5 AI agents
- **NVIDIA NIM API** — Cloud inference with OpenAI-compatible interface
- **CUDA / CuPy** — Real GPU execution of generated code
- Built for the **NVIDIA GTC 2026 Golden Ticket Developer Contest**

---

## Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [NVIDIA](https://www.nvidia.com) for Nemotron and the NIM API
- [NVIDIA GTC 2026](https://www.nvidia.com/gtc/) for inspiration
- [OpenEvolve](https://github.com/codelion/openevolve) for the self-evolving loop concept
- Built with [Next.js](https://nextjs.org), [Tailwind CSS](https://tailwindcss.com), and [Lucide](https://lucide.dev)
