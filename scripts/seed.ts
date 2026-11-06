// Loads the two fictional businesses into Supabase.
// Safe to run again: it deletes and recreates ONLY these two businesses
// (by their fixed IDs), and everything linked to them.
// Run with: npm run seed
import { createClient } from "@supabase/supabase-js";
import { SEED_BUSINESSES } from "./seed-data";

if (process.env.APP_ENV !== "local") {
  console.error("Refusing to run: the seed script is for local testing only. Set APP_ENV=local in .env.");
  process.exit(1);
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || url.startsWith("REPLACE_ME") || key.startsWith("REPLACE_ME")) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

function must(label: string, error: { message: string } | null) {
  if (error) {
    console.error(`FAILED: ${label}: ${error.message}`);
    process.exit(1);
  }
}

for (const b of SEED_BUSINESSES) {
  // 1. Remove any earlier copy (cascade also removes everything linked to it).
  must("clear old bookings", (await admin.from("bookings").delete().eq("business_id", b.id)).error);
  must("clear old business", (await admin.from("businesses").delete().eq("id", b.id)).error);

  // 2. Create the business and all its information.
  must("business", (await admin.from("businesses").insert({
    id: b.id,
    name: b.name,
    industry: b.industry,
    timezone: b.timezone,
    currency: "AUD",
    ai_personality: b.aiPersonality,
    custom_instructions: b.customInstructions,
  })).error);

  must("hours", (await admin.from("business_hours").insert(
    b.hours.map((h) => ({ business_id: b.id, day_of_week: h.day, open_time: h.open, close_time: h.close })),
  )).error);

  must("services", (await admin.from("services").insert(
    b.services.map((s) => ({
      business_id: b.id, name: s.name, description: s.description,
      price_cents: s.priceCents, duration_minutes: s.durationMinutes,
    })),
  )).error);

  must("faqs", (await admin.from("faqs").insert(
    b.faqs.map((f) => ({ business_id: b.id, question: f.question, answer: f.answer })),
  )).error);

  must("policies", (await admin.from("policies").insert(
    b.policies.map((p) => ({ business_id: b.id, title: p.title, content: p.content })),
  )).error);

  must("resources", (await admin.from("booking_resources").insert(
    b.resources.map((name) => ({ business_id: b.id, name })),
  )).error);

  // The built-in TEST booking adapter. Not a real booking provider.
  must("provider config", (await admin.from("booking_provider_configs").insert({
    business_id: b.id, provider_type: "test", mode: "test", enabled: true,
  })).error);

  console.log(`Seeded: ${b.name}`);
  console.log(`   id: ${b.id}`);
  console.log(`   ${b.hours.length} opening periods, ${b.services.length} services, ${b.faqs.length} FAQs, ${b.policies.length} policies, ${b.resources.length} resources`);
}

console.log("\nSeed finished.");
