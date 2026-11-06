import type { Config } from "@netlify/functions";
import { appEnv, envStatus, isLocal } from "../../src/config/env";

// A simple "is the server alive?" endpoint.
// Public callers (production) only learn that the service is up.
// Configuration diagnostics are returned ONLY when APP_ENV=local.
export default async (_req: Request) => {
  const body: Record<string, unknown> = {
    ok: true,
    time: new Date().toISOString(),
  };

  if (isLocal()) {
    body.diagnostics = {
      app_env: appEnv(),
      env_configured: envStatus(), // true/false only, never the values
    };
  }

  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
};

// This makes the function available at /api/health
export const config: Config = {
  path: "/api/health",
};
