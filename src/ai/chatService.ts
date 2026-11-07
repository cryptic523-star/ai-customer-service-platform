// The "brain" workflow. The businessId passed in has ALREADY been decided by
// authenticate(); nothing in here ever takes a business from the customer.
import * as repo from "../db/repository";
import { buildSystemPrompt } from "./promptBuilder";
import { generateReply, type ChatTurn } from "./openai";

const HISTORY_LIMIT = 12; // how many past messages the AI can see (controls cost)
const MAX_CUSTOMER_MESSAGES_PER_CONVERSATION = 50;
const FALLBACK_REPLY = "Sorry, I couldn't put a reply together just now. Please try asking again.";

export interface ChatInput { businessId: string; message: string; conversationId?: string }
export type ChatResult =
  | { ok: true; reply: string; conversationId: string }
  | { ok: false; status: 403 | 404 | 429 | 502; error: string };

export async function handleChat(input: ChatInput): Promise<ChatResult> {
  const { businessId, message } = input;

  const business = await repo.getBusiness(businessId);
  if (!business) return { ok: false, status: 404, error: "Business not found" };
  if (business.status !== "active") return { ok: false, status: 403, error: "This assistant is currently unavailable" };

  // A conversation must belong to THIS business, otherwise it is treated as not found.
  let conversationId = input.conversationId ?? null;
  let history: ChatTurn[] = [];
  if (conversationId) {
    if (!(await repo.conversationExists(businessId, conversationId))) {
      return { ok: false, status: 404, error: "Conversation not found" };
    }
    if ((await repo.countCustomerMessages(businessId, conversationId)) >= MAX_CUSTOMER_MESSAGES_PER_CONVERSATION) {
      return { ok: false, status: 429, error: "This conversation has reached its message limit. Please start a new one." };
    }
    const stored = await repo.getRecentMessages(businessId, conversationId, HISTORY_LIMIT);
    history = stored.map((m) => ({ role: m.role === "customer" ? "user" : "assistant", content: m.content }));
  }

  const knowledge = await repo.getKnowledge(businessId);
  const systemPrompt = buildSystemPrompt({ business, knowledge });

  let result;
  try {
    result = await generateReply(systemPrompt, [...history, { role: "user", content: message }]);
  } catch (err) {
    console.error("OpenAI error:", err instanceof Error ? err.message : "unknown");
    return { ok: false, status: 502, error: "The assistant is temporarily unavailable. Please try again." };
  }

  const reply = (result.text || FALLBACK_REPLY).slice(0, 8000);

  // Only create the conversation once we have a reply, so failures leave nothing behind.
  if (!conversationId) conversationId = await repo.createConversation(businessId);
  await repo.saveExchange(businessId, conversationId, message, reply);
  await repo.touchConversation(businessId, conversationId);
  try {
    await repo.recordUsage(businessId, conversationId, result.model, result.promptTokens, result.completionTokens);
  } catch (err) {
    console.error("Usage tracking failed:", err instanceof Error ? err.message : "unknown"); // never block the reply
  }

  return { ok: true, reply, conversationId };
}
