// The only file that talks to the AI provider.
// OPENAI_BASE_URL is optional: leave it unset to use OpenAI itself.
import OpenAI from "openai";

export interface ChatTurn { role: "user" | "assistant"; content: string }

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith("REPLACE_ME")) throw new Error("AI provider is not configured");
  const baseURL = process.env.OPENAI_BASE_URL || undefined;
  // Default 9s: Netlify Functions stop after about 10s. Override with AI_TIMEOUT_MS for local testing.
  const timeout = Number(process.env.AI_TIMEOUT_MS) || 9000;
  client = new OpenAI({ apiKey, baseURL, timeout, maxRetries: Number(process.env.AI_RETRIES) || 0 });
  return client;
}

export async function generateReply(systemPrompt: string, turns: ChatTurn[]) {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const response = await getClient().chat.completions.create({
    model,
    messages: [{ role: "system", content: systemPrompt }, ...turns],
    temperature: 0.2,
    max_completion_tokens: 500,
  });
  return {
    text: (response.choices[0]?.message?.content ?? "").trim(),
    model,
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
  };
}
