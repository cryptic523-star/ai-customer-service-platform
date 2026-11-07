// Decides WHICH BUSINESS a request is for. The golden rule:
// a business_id typed by an anonymous customer is NEVER trusted.
//
//  PUBLIC mode   (production): header x-business-key. We hash it and look it up;
//                the database returns exactly one business. Any business_id in the
//                request body is ignored.
//  INTERNAL mode (local only): header x-api-key (the platform key) plus a
//                business_id in the body. Switched off unless APP_ENV=local.
import { createHash, timingSafeEqual } from "node:crypto";
import { internalApiEnabled } from "../config/env";
import { findActiveApiKey } from "../db/repository";

export type AuthResult =
  | { ok: true; businessId: string; mode: "public" | "internal" }
  | { ok: false; status: 400 | 401 | 403; error: string };

const UNAUTHORIZED: AuthResult = { ok: false, status: 401, error: "Unauthorized" };

/** How public keys are hashed before being stored or looked up. */
export function hashBusinessKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// Compares two secrets without leaking information through timing.
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

const normalizeOrigin = (o: string) => o.trim().toLowerCase().replace(/\/$/, "");

export async function authenticate(req: Request, bodyBusinessId?: string): Promise<AuthResult> {
  // ---- PUBLIC mode ----
  const businessKey = req.headers.get("x-business-key");
  if (businessKey) {
    const key = businessKey.trim();
    if (key.length < 16 || key.length > 200) return UNAUTHORIZED;
    const record = await findActiveApiKey(hashBusinessKey(key));
    if (!record) return UNAUTHORIZED;

    // If the business listed allowed websites, the request must come from one of them.
    // (Browsers set the Origin header themselves. This stops other websites from
    // embedding the key; it does not stop a determined non-browser caller.)
    if (record.allowedOrigins.length > 0) {
      const origin = normalizeOrigin(req.headers.get("origin") ?? "");
      const allowed = record.allowedOrigins.map(normalizeOrigin);
      if (!origin || !allowed.includes(origin)) {
        return { ok: false, status: 403, error: "Origin not allowed" };
      }
    }
    return { ok: true, businessId: record.businessId, mode: "public" };
  }

  // ---- INTERNAL mode (local development and testing only) ----
  const platformKey = req.headers.get("x-api-key");
  if (platformKey) {
    if (!internalApiEnabled()) return UNAUTHORIZED; // production: always refused
    const expected = process.env.PLATFORM_API_KEY;
    if (!expected || expected.startsWith("REPLACE_ME")) return UNAUTHORIZED;
    if (!safeEqual(platformKey, expected)) return UNAUTHORIZED;
    if (!bodyBusinessId) {
      return { ok: false, status: 400, error: "business_id is required in internal test mode" };
    }
    return { ok: true, businessId: bodyBusinessId, mode: "internal" };
  }

  return UNAUTHORIZED;
}
