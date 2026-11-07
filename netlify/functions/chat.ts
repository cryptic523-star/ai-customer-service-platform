import type { Config } from "@netlify/functions";
import { z } from "zod";
import { authenticate } from "../../src/auth/authenticate";
import { handleChat } from "../../src/ai/chatService";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BodySchema = z.object({
  message: z.string().trim().min(1, "message is required").max(1000, "message is too long (max 1000 characters)"),
  conversation_id: z.string().regex(UUID, "conversation_id must be a UUID").optional(),
  business_id: z.string().regex(UUID, "business_id must be a UUID").optional(), // internal test mode only
});

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  if (raw.length > 10_000) return json({ error: "Request too large" }, 413);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }
  const body = BodySchema.safeParse(parsed);
  if (!body.success) {
    return json({ error: "Invalid request", detail: body.error.issues[0]?.message ?? "bad input" }, 400);
  }

  try {
    // 1. Decide which business this is (never trusting a customer-supplied id).
    const auth = await authenticate(req, body.data.business_id);
    if (!auth.ok) return json({ error: auth.error }, auth.status);

    // 2. Run the AI brain for that one business.
    const result = await handleChat({
      businessId: auth.businessId,
      message: body.data.message,
      conversationId: body.data.conversation_id,
    });
    if (!result.ok) return json({ error: result.error }, result.status);
    return json({ reply: result.reply, conversation_id: result.conversationId });
  } catch (err) {
    console.error("chat error:", err instanceof Error ? err.message : "unknown");
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
};

// Available at /api/chat
export const config: Config = { path: "/api/chat" };
