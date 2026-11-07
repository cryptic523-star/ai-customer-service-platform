// THE ONLY FILE THAT QUERIES THE DATABASE.
// Tenant-isolation rule: every function below needs a businessId and filters
// by it. (The one exception is findActiveApiKey, which is how we FIND the
// business from a public key in the first place.)
import { getSupabase } from "./client";

export interface Business {
  id: string;
  name: string;
  industry: string;
  timezone: string;
  currency: string;
  ai_personality: string | null;
  custom_instructions: string | null;
  status: string;
}
export interface HoursRow { day_of_week: number; open_time: string; close_time: string }
export interface ServiceRow { name: string; description: string | null; price_cents: number; duration_minutes: number }
export interface FaqRow { question: string; answer: string }
export interface PolicyRow { title: string; content: string }
export interface Knowledge {
  hours: HoursRow[];
  services: ServiceRow[];
  faqs: FaqRow[];
  policies: PolicyRow[];
}
export interface StoredMessage { role: "customer" | "assistant"; content: string }

function check(error: { message: string } | null, label: string) {
  if (error) throw new Error(`Database error (${label}): ${error.message}`);
}

/** Finds the business that owns a public key (looked up by its SHA-256 hash). */
export async function findActiveApiKey(keyHash: string) {
  const { data, error } = await getSupabase()
    .from("business_api_keys")
    .select("business_id, allowed_origins")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle();
  check(error, "api key lookup");
  if (!data) return null;
  return { businessId: data.business_id as string, allowedOrigins: (data.allowed_origins ?? []) as string[] };
}

export async function getBusiness(businessId: string): Promise<Business | null> {
  const { data, error } = await getSupabase()
    .from("businesses")
    .select("id, name, industry, timezone, currency, ai_personality, custom_instructions, status")
    .eq("id", businessId)
    .maybeSingle();
  check(error, "get business");
  return (data as Business | null) ?? null;
}

/** Everything the AI is allowed to know about ONE business. */
export async function getKnowledge(businessId: string): Promise<Knowledge> {
  const db = getSupabase();
  const [hours, services, faqs, policies] = await Promise.all([
    db.from("business_hours").select("day_of_week, open_time, close_time")
      .eq("business_id", businessId).order("day_of_week").order("open_time"),
    db.from("services").select("name, description, price_cents, duration_minutes")
      .eq("business_id", businessId).eq("active", true).order("name"),
    db.from("faqs").select("question, answer")
      .eq("business_id", businessId).eq("active", true).order("created_at"),
    db.from("policies").select("title, content")
      .eq("business_id", businessId).eq("active", true).order("created_at"),
  ]);
  check(hours.error, "hours");
  check(services.error, "services");
  check(faqs.error, "faqs");
  check(policies.error, "policies");
  return {
    hours: (hours.data ?? []) as HoursRow[],
    services: (services.data ?? []) as ServiceRow[],
    faqs: (faqs.data ?? []) as FaqRow[],
    policies: (policies.data ?? []) as PolicyRow[],
  };
}

/** True only if this conversation exists AND belongs to this business. */
export async function conversationExists(businessId: string, conversationId: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from("conversations")
    .select("id")
    .eq("business_id", businessId)
    .eq("id", conversationId)
    .maybeSingle();
  check(error, "conversation lookup");
  return Boolean(data);
}

export async function createConversation(businessId: string, channel = "api"): Promise<string> {
  const { data, error } = await getSupabase()
    .from("conversations")
    .insert({ business_id: businessId, channel })
    .select("id")
    .single();
  check(error, "create conversation");
  return data!.id as string;
}

/** Most recent messages, oldest first. Ordered by id because two messages saved together share a timestamp. */
export async function getRecentMessages(businessId: string, conversationId: string, limit: number): Promise<StoredMessage[]> {
  const { data, error } = await getSupabase()
    .from("messages")
    .select("role, content")
    .eq("business_id", businessId)
    .eq("conversation_id", conversationId)
    .order("id", { ascending: false })
    .limit(limit);
  check(error, "get messages");
  return ((data ?? []) as StoredMessage[]).reverse();
}

export async function countCustomerMessages(businessId: string, conversationId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("conversation_id", conversationId)
    .eq("role", "customer");
  check(error, "count messages");
  return count ?? 0;
}

/** Saves the customer message and the reply together in ONE database statement. */
export async function saveExchange(businessId: string, conversationId: string, customerText: string, assistantText: string) {
  const { error } = await getSupabase().from("messages").insert([
    { business_id: businessId, conversation_id: conversationId, role: "customer", content: customerText },
    { business_id: businessId, conversation_id: conversationId, role: "assistant", content: assistantText },
  ]);
  check(error, "save messages");
}

export async function touchConversation(businessId: string, conversationId: string) {
  const { error } = await getSupabase()
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("business_id", businessId)
    .eq("id", conversationId);
  check(error, "touch conversation");
}

export async function recordUsage(businessId: string, conversationId: string, model: string, promptTokens: number, completionTokens: number) {
  const { error } = await getSupabase().from("usage_events").insert({
    business_id: businessId,
    conversation_id: conversationId,
    model,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
  });
  check(error, "record usage");
}
