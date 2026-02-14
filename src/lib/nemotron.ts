import OpenAI from "openai";

const MODEL = "mistralai/mistral-nemotron";

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
    });
  }
  return client;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Stream a chat completion from Nemotron via NVIDIA NIM API.
 * Yields text chunks as they arrive.
 */
export async function* streamNemotronChat(
  messages: ChatMessage[]
): AsyncGenerator<string> {
  const openai = getClient();

  const stream = await openai.chat.completions.create({
    model: MODEL,
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
}

/**
 * Non-streaming chat completion from Nemotron.
 */
export async function chatNemotron(
  messages: ChatMessage[]
): Promise<string> {
  const openai = getClient();

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.6,
    top_p: 0.7,
    max_tokens: 4096,
  });

  return response.choices[0]?.message?.content ?? "";
}
