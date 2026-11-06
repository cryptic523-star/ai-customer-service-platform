// Central place for reading environment variables (secrets and settings).
// We never print secret values anywhere, only whether they are set.

export type AppEnv = "local" | "production";

/**
 * FAIL-CLOSED: anything other than the exact value "local" is treated as
 * production. Forgetting to set APP_ENV therefore leaves things locked down.
 */
export function appEnv(): AppEnv {
  return process.env.APP_ENV === "local" ? "local" : "production";
}

export function isLocal(): boolean {
  return appEnv() === "local";
}

/**
 * The internal test API (platform API key + business_id in the request body)
 * may only be used locally. In production the public business-key flow is
 * the only way in (added in Stage 4).
 */
export function internalApiEnabled(): boolean {
  return isLocal();
}

const REQUIRED_ENV_VARS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "PLATFORM_API_KEY",
] as const;

/**
 * Returns true/false per variable: is it set to a real value?
 * A value that is empty or still starts with "REPLACE_ME" counts as NOT set.
 * Only call this for local diagnostics, never for public responses.
 */
export function envStatus(): Record<string, boolean> {
  const status: Record<string, boolean> = {};
  for (const name of REQUIRED_ENV_VARS) {
    const value = process.env[name];
    status[name] = Boolean(value && value.length > 0 && !value.startsWith("REPLACE_ME"));
  }
  return status;
}
