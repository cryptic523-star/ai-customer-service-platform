// Creates a public business key for MANUAL testing and prints it ONCE.
// Only the hash is stored in the database, so a lost key cannot be recovered.
// Usage:  npm run create-key -- sunrise      (or: peak, or a business UUID)
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { SEED_BUSINESSES } from "./seed-data";
import { hashBusinessKey } from "../src/auth/authenticate";

if (process.env.APP_ENV !== "local") {
  console.error("Set APP_ENV=local in .env to use this script.");
  process.exit(1);
}
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey || url.startsWith("REPLACE_ME") || serviceKey.startsWith("REPLACE_ME")) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
  process.exit(1);
}

const aliases: Record<string, string> = {
  sunrise: SEED_BUSINESSES[0].id,
  peak: SEED_BUSINESSES[1].id,
};
const arg = (process.argv[2] ?? "").toLowerCase();
const businessId = aliases[arg] ?? arg;
if (!/^[0-9a-f-]{36}$/.test(businessId)) {
  console.error("Usage: npm run create-key -- sunrise   (or: peak, or a business UUID)");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const key = `bk_test_${randomBytes(24).toString("hex")}`;
const { error } = await admin.from("business_api_keys").insert({
  business_id: businessId,
  key_hash: hashBusinessKey(key),
  key_prefix: key.slice(0, 12),
  label: "manual test key",
});
if (error) {
  console.error("Could not create the key:", error.message);
  process.exit(1);
}
console.log("\nYour business key (shown only once):\n");
console.log(key);
console.log("\nUse it as the header:  x-business-key: <the key above>\n");
