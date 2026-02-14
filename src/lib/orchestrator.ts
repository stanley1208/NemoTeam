import { AGENTS, AGENT_ORDER } from "./agents";
import { streamNemotronChat, ChatMessage } from "./nemotron";
import { AgentRole, SSEEvent, CodeBlock } from "@/types";

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

    // Try to extract filename from first comment line
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
 * Run the multi-agent orchestration pipeline.
 * Yields SSE events as agents think and produce output.
 */
export async function* runOrchestration(
  task: string
): AsyncGenerator<SSEEvent> {
  const conversationHistory: { role: AgentRole; content: string }[] = [];
  let allCodeBlocks: CodeBlock[] = [];
  let revisionCount = 0;
  const maxRevisions = 1;

  for (const agentRole of AGENT_ORDER) {
    const agent = AGENTS[agentRole];

    // Signal that this agent is starting
    yield {
      type: "agent_start",
      role: agentRole,
      timestamp: Date.now(),
    };

    // Build the message context for this agent
    const messages: ChatMessage[] = [
      { role: "system", content: agent.systemPrompt },
    ];

    if (agentRole === "architect") {
      messages.push({
        role: "user",
        content: `Here is the coding task:\n\n${task}`,
      });
    } else {
      // Give the agent the full conversation so far
      let context = `Original task: ${task}\n\n--- Team Conversation ---\n`;
      for (const msg of conversationHistory) {
        const a = AGENTS[msg.role];
        context += `\n[${a.name} - ${a.title}]:\n${msg.content}\n`;
      }
      messages.push({ role: "user", content: context });
    }

    // Stream the agent's response
    let fullResponse = "";
    try {
      for await (const chunk of streamNemotronChat(messages)) {
        fullResponse += chunk;
        yield {
          type: "agent_chunk",
          role: agentRole,
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
      return;
    }

    // Record the agent's response
    conversationHistory.push({ role: agentRole, content: fullResponse });

    // Extract code blocks if this is the developer
    if (agentRole === "developer") {
      const blocks = extractCodeBlocks(fullResponse);
      if (blocks.length > 0) {
        allCodeBlocks = blocks;
        for (const block of blocks) {
          yield {
            type: "code_update",
            role: agentRole,
            code: block,
            timestamp: Date.now(),
          };
        }
      }
    }

    yield {
      type: "agent_complete",
      role: agentRole,
      content: fullResponse,
      timestamp: Date.now(),
    };

    // If reviewer says "NEEDS REVISION" and we haven't exceeded max revisions,
    // loop back to developer
    if (
      agentRole === "reviewer" &&
      fullResponse.includes("NEEDS REVISION") &&
      revisionCount < maxRevisions
    ) {
      revisionCount++;

      // Run developer again with review feedback
      const devAgent = AGENTS["developer"];
      yield {
        type: "agent_start",
        role: "developer",
        timestamp: Date.now(),
      };

      const revisionMessages: ChatMessage[] = [
        { role: "system", content: devAgent.systemPrompt },
        {
          role: "user",
          content: `Original task: ${task}\n\n--- Reviewer Feedback ---\n${fullResponse}\n\n--- Your Previous Code ---\n${conversationHistory.find((m) => m.role === "developer")?.content}\n\nPlease revise the code based on the reviewer's feedback. Output the complete revised code.`,
        },
      ];

      let revisionResponse = "";
      try {
        for await (const chunk of streamNemotronChat(revisionMessages)) {
          revisionResponse += chunk;
          yield {
            type: "agent_chunk",
            role: "developer",
            content: chunk,
            timestamp: Date.now(),
          };
        }
      } catch (error) {
        yield {
          type: "workflow_error",
          error: `Revision failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          timestamp: Date.now(),
        };
        return;
      }

      conversationHistory.push({
        role: "developer",
        content: revisionResponse,
      });

      const revisedBlocks = extractCodeBlocks(revisionResponse);
      if (revisedBlocks.length > 0) {
        allCodeBlocks = revisedBlocks;
        for (const block of revisedBlocks) {
          yield {
            type: "code_update",
            role: "developer",
            code: block,
            timestamp: Date.now(),
          };
        }
      }

      yield {
        type: "agent_complete",
        role: "developer",
        content: revisionResponse,
        timestamp: Date.now(),
      };
    }
  }

  yield {
    type: "workflow_complete",
    timestamp: Date.now(),
  };
}
