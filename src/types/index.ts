export type AgentRole = "architect" | "developer" | "reviewer" | "tester" | "debugger";

export interface AgentDefinition {
  role: AgentRole;
  name: string;
  title: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  systemPrompt: string;
  model: string;
}

export interface AgentMessage {
  id: string;
  role: AgentRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  evolutionCycle?: number;
  /** Agent response time in milliseconds */
  durationMs?: number;
  /** System messages (task echo, phase labels) — rendered as centered labels, not agent bubbles */
  isSystem?: boolean;
}

export interface CodeBlock {
  language: string;
  code: string;
  filename?: string;
  savedPath?: string;
}

export type WorkflowStatus =
  | "idle"
  | "running"
  | "completed"
  | "error";

export type SSEEventType =
  | "agent_start"
  | "agent_chunk"
  | "agent_complete"
  | "code_update"
  | "files_saved"
  | "execution_start"
  | "execution_result"
  | "evolution_cycle"
  | "workflow_complete"
  | "workflow_error";

export interface WorkflowSummary {
  totalAgentCalls: number;
  modelCalls: Record<string, number>;
  evolutionCycles: number;
  executionAttempts: number;
  executionSuccess: boolean;
  durationMs: number;
  rearchitectCount: number;
}

export interface SSEEvent {
  type: SSEEventType;
  role?: AgentRole;
  content?: string;
  code?: CodeBlock;
  error?: string;
  cycle?: number;
  maxCycles?: number;
  savedFiles?: string[];
  outputDir?: string;
  executionSuccess?: boolean;
  executionOutput?: string;
  executionError?: string;
  summary?: WorkflowSummary;
  /** Escalation tier: 1=quick fix, 2=deep review, 3=re-architect */
  tier?: number;
  timestamp: number;
}

export interface WorkflowState {
  status: WorkflowStatus;
  messages: AgentMessage[];
  codeBlocks: CodeBlock[];
  activeAgent: AgentRole | null;
  task: string;
  evolutionCycle: number;
  maxEvolutionCycles: number;
}
