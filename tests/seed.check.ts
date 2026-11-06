// Checks the two seeded businesses are complete and that their data does not mix.
// Run with: npm run test:seed   (run "npm run seed" first)
import { createClient } from "@supabase/supabase-js";
import { SEED_BUSINESSES } from "../scripts/seed-data";

if (process.env.APP_ENV !== "local") {
  console.error("Set APP_ENV=local in .env to run this test.");
  process.exit(1);
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || url.startsWith("REPLACE_ME") || key.startsWith("REPLACE_ME")) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let failures = 0;
function check(name: string, passed: boolean, detail = "") {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${passed || !detail ? "" : "  -> " + detail}`);
  if (!passed) failures++;
}

async function rows(table: string, businessId: string): Promise<Record<string, any>[]> {
  const { data, error } = await admin.from(table).select("*").eq("business_id", businessId);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

const [A, B] = SEED_BUSINESSES;

// Words that belong to ONE business only. They must never appear in the other's data.
const ONLY_IN_A = ["sunrise", "lyle lane", "patch test", "mia", "jack", "fitzroy", "kids' cut"];
const ONLY_IN_B = ["peak performance", "hicaps", "subiaco", "dry needling", "000", "referral"];

async function loadAll(id: string) {
  const [hours, services, faqs, policies, resources, configs] = await Promise.all([
    rows("business_hours", id), rows("services", id), rows("faqs", id),
    rows("policies", id), rows("booking_resources", id), rows("booking_provider_configs", id),
  ]);
  const { data: biz } = await admin.from("businesses").select("*").eq("id", id).single();
  return { biz, hours, services, faqs, policies, resources, configs };
}

function textOf(d: Awaited<ReturnType<typeof loadAll>>): string {
  // Only human-readable text. Prices, IDs and timestamps are ignored so that
  // numbers like 18000 cents can't cause false alarms.
  return [d.biz, ...d.services, ...d.faqs, ...d.policies, ...d.resources]
    .flatMap((r: any) => [
      r?.name, r?.description, r?.question, r?.answer, r?.title, r?.content,
      r?.industry, r?.ai_personality, r?.custom_instructions,
    ])
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

try {
  const a = await loadAll(A.id);
  const b = await loadAll(B.id);

  // ---- Completeness ----
  for (const [seed, data] of [[A, a], [B, b]] as const) {
    check(`${seed.name}: business exists`, data.biz?.name === seed.name);
    check(`${seed.name}: ${seed.hours.length} opening periods`, data.hours.length === seed.hours.length, `found ${data.hours.length}`);
    check(`${seed.name}: ${seed.services.length} services`, data.services.length === seed.services.length, `found ${data.services.length}`);
    check(`${seed.name}: ${seed.faqs.length} FAQs`, data.faqs.length === seed.faqs.length, `found ${data.faqs.length}`);
    check(`${seed.name}: ${seed.policies.length} policies`, data.policies.length === seed.policies.length, `found ${data.policies.length}`);
    check(`${seed.name}: ${seed.resources.length} booking resources`, data.resources.length === seed.resources.length, `found ${data.resources.length}`);
    const cfg = data.configs[0];
    check(`${seed.name}: uses the TEST booking adapter (not a real provider)`,
      data.configs.length === 1 && cfg.provider_type === "test" && cfg.mode === "test");
  }

  // ---- Different information ----
  check("the two businesses have different IDs", A.id !== B.id);
  check("the two businesses have different timezones", a.biz?.timezone !== b.biz?.timezone);
  const cutA = a.services.find((s) => s.name === "Men's Cut");
  const consultB = b.services.find((s) => s.name === "Initial Consultation");
  check("Sunrise Men's Cut costs $50.00", cutA?.price_cents === 5000);
  check("Peak Initial Consultation costs $140.00", consultB?.price_cents === 14000);
  check("cancellation policies differ (24h vs 48h)",
    JSON.stringify(a.policies).includes("24 hours") && JSON.stringify(b.policies).includes("48 hours"));

  // ---- Nothing crosses between businesses ----
  const textA = textOf(a);
  const textB = textOf(b);
  const leakIntoB = ONLY_IN_A.filter((w) => textB.includes(w));
  const leakIntoA = ONLY_IN_B.filter((w) => textA.includes(w));
  check("no Sunrise-only information appears in Peak's data", leakIntoB.length === 0, leakIntoB.join(", "));
  check("no Peak-only information appears in Sunrise's data", leakIntoA.length === 0, leakIntoA.join(", "));

  const idsA = new Set([...a.services, ...a.resources, ...a.faqs, ...a.policies].map((r) => r.id));
  const shared = [...b.services, ...b.resources, ...b.faqs, ...b.policies].filter((r) => idsA.has(r.id));
  check("the two businesses share no records", shared.length === 0);

  // ---- Deliberate gaps (so we can test "I don't know" later) ----
  const phone = /\b0\d[\s-]?\d{4}[\s-]?\d{4}\b|\b04\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/;
  check("no phone numbers are stored (unknown-question test is valid)", !phone.test(textA) && !phone.test(textB));
  check("payment methods are not stored for Sunrise", !/afterpay|visa|mastercard|cash only/.test(textA));

  // ---- Clean slate for booking tests ----
  check("no bookings exist yet for either business",
    (await rows("bookings", A.id)).length === 0 && (await rows("bookings", B.id)).length === 0);
} catch (err) {
  console.error("\nTEST ERROR:", err instanceof Error ? err.message : err);
  failures++;
}

if (failures > 0) {
  console.log(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll seed checks passed");
