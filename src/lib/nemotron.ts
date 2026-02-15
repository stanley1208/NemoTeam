import OpenAI from "openai";

/**
 * NVIDIA Nemotron models used by NemoTeam.
 *
 * Different agents use different models to optimize for their role:
 *   - Deep reasoning agents (Architect, Debugger) use the Ultra 253B model
 *   - Fast code generation & analysis agents (Developer, Reviewer, Tester) use the Super 49B model
 */
export const NVIDIA_MODELS = {
  /** Flagship deep reasoning — for Architect and Debugger */
  NEMOTRON_ULTRA_253B: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
  /** High-efficiency reasoning — for Developer, Reviewer, and Tester */
  NEMOTRON_SUPER_49B: "nvidia/llama-3.3-nemotron-super-49b-v1",
} as const;

export type NvidiaModel = (typeof NVIDIA_MODELS)[keyof typeof NVIDIA_MODELS];

/** Default model if none specified */
const DEFAULT_MODEL: NvidiaModel = NVIDIA_MODELS.NEMOTRON_SUPER_49B;

/** Maximum number of retry attempts for transient API errors */
const MAX_RETRIES = 3;

/** Base delay in ms for exponential backoff (doubles each retry) */
const BASE_RETRY_DELAY_MS = 1000;

/** Per-request timeout in ms */
const REQUEST_TIMEOUT_MS = 60000;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.NVIDIA_NIM_API_KEY;
    if (!apiKey) {
      throw new Error(
        "NVIDIA_NIM_API_KEY is not set. Get your key at https://build.nvidia.com"
      );
    }
    client = new OpenAI({
      apiKey,
      baseURL: "https://integrate.api.nvidia.com/v1",
      timeout: REQUEST_TIMEOUT_MS,
    });
  }
  return client;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Sleep for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine whether an error is retryable (rate-limit or server error).
 */
function isRetryableError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const status = (error as { status?: number }).status;
    // 429 = rate limited, 5xx = server errors
    if (status === 429 || (status && status >= 500)) return true;

    const code = (error as { code?: string }).code;
    if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ECONNABORTED") return true;
  }
  return false;
}

/**
 * Stream a chat completion from NVIDIA Nemotron via NIM API.
 * Yields text chunks as they arrive.
 * Includes automatic retry with exponential backoff for transient errors.
 */
export async function* streamNemotronChat(
  messages: ChatMessage[],
  model?: string
): AsyncGenerator<string> {
  const openai = getClient();
  const useModel = model || DEFAULT_MODEL;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        yield `\n[Retrying NIM API call — attempt ${attempt + 1}/${MAX_RETRIES + 1}, waiting ${delay / 1000}s...]\n`;
        await sleep(delay);
      }

      const stream = await openai.chat.completions.create({
        model: useModel,
        messages,
        stream: true,
        temperature: 0.6,
        top_p: 0.7,
        max_tokens: 4096,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield delta;
        }
      }

      // If we get here, the stream completed successfully
      return;
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === MAX_RETRIES) {
        throw error;
      }
      // Loop continues to the next retry attempt
    }
  }

  // Should not reach here, but just in case
  throw lastError;
}

/**
 * Non-streaming chat completion from NVIDIA Nemotron.
 * Includes automatic retry with exponential backoff for transient errors.
 */
export async function chatNemotron(
  messages: ChatMessage[],
  model?: string
): Promise<string> {
  const openai = getClient();
  const useModel = model || DEFAULT_MODEL;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
      }

      const response = await openai.chat.completions.create({
        model: useModel,
        messages,
        temperature: 0.6,
        top_p: 0.7,
        max_tokens: 4096,
      });

      return response.choices[0]?.message?.content ?? "";
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === MAX_RETRIES) {
        throw error;
      }
    }
  }

  throw lastError;
}
