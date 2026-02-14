export type AgentRole = "architect" | "developer" | "reviewer" | "tester";

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
}

export interface AgentMessage {
  id: string;
  role: AgentRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface CodeBlock {
  language: string;
  code: string;
  filename?: string;
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
  | "workflow_complete"
  | "workflow_error";

export interface SSEEvent {
  type: SSEEventType;
  role?: AgentRole;
  content?: string;
  code?: CodeBlock;
  error?: string;
  timestamp: number;
}

export interface WorkflowState {
  status: WorkflowStatus;
  messages: AgentMessage[];
  codeBlocks: CodeBlock[];
  activeAgent: AgentRole | null;
  task: string;
}
