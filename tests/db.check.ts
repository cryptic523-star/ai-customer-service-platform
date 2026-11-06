// Database security + booking test.  Run with: npm run test:db
// It creates two temporary fictional businesses, tests them, then deletes them.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

const isSet = (v: string | undefined): v is string =>
  Boolean(v && v.length > 0 && !v.startsWith("REPLACE_ME"));

if (process.env.APP_ENV !== "local") {
  console.error("Refusing to run: this test creates and deletes data. Set APP_ENV=local in .env.");
  process.exit(1);
}
if (!isSet(url) || !isSet(serviceKey)) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
  process.exit(1);
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, clientOptions);

let failures = 0;
function check(name: string, passed: boolean, detail = "") {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${passed || !detail ? "" : "  -> " + detail}`);
  if (!passed) failures++;
}

// Insert helper: throws if setup fails.
async function must(label: string, query: PromiseLike<{ data: any; error: { message: string } | null }>) {
  const { data, error } = await query;
  if (error || !data) throw new Error(`${label} failed: ${error?.message ?? "no data"}`);
  return data;
}

const TABLES = [
  "businesses", "business_api_keys", "business_hours", "services", "faqs", "policies",
  "booking_resources", "booking_provider_configs", "conversations", "messages",
  "bookings", "usage_events",
];

const iso = (hhmm: string) => `2030-01-15T${hhmm}:00Z`;
const tag = `__test__${Date.now()}`;
let bizA: any;
let bizB: any;

try {
  // ---------- Setup: two fictional businesses ----------
  bizA = await must("create business A", admin.from("businesses")
    .insert({ name: `${tag} Sunrise Salon`, industry: "hair salon" }).select().single());
  bizB = await must("create business B", admin.from("businesses")
    .insert({ name: `${tag} Peak Physio`, industry: "physiotherapy" }).select().single());

  const resA1 = await must("resource A1", admin.from("booking_resources")
    .insert({ business_id: bizA.id, name: "Chair 1" }).select().single());
  const resA2 = await must("resource A2", admin.from("booking_resources")
    .insert({ business_id: bizA.id, name: "Chair 2" }).select().single());
  const resB1 = await must("resource B1", admin.from("booking_resources")
    .insert({ business_id: bizB.id, name: "Room 1" }).select().single());
  const svcA = await must("service A", admin.from("services")
    .insert({ business_id: bizA.id, name: "Haircut", price_cents: 6000, duration_minutes: 60 }).select().single());
  const svcB = await must("service B", admin.from("services")
    .insert({ business_id: bizB.id, name: "Consultation", price_cents: 9500, duration_minutes: 45 }).select().single());
  const convA = await must("conversation A", admin.from("conversations")
    .insert({ business_id: bizA.id }).select().single());

  // ---------- Test 1: public (anon) key gets nothing ----------
  if (isSet(anonKey)) {
    const anon = createClient(url, anonKey, clientOptions);
    for (const table of TABLES) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      check(`anon key cannot read ${table}`, Boolean(error) || (data ?? []).length === 0);
    }
    const ins = await anon.from("businesses").insert({ name: "hacker", industry: "x" });
    check("anon key cannot insert a business", Boolean(ins.error));
  } else {
    console.log("SKIP  anon key tests (add SUPABASE_ANON_KEY to .env to run them)");
    failures++;
  }

  // ---------- Test 2: tenant-safe links (even with the service-role key) ----------
  const r1 = await admin.from("messages")
    .insert({ business_id: bizB.id, conversation_id: convA.id, role: "customer", content: "hi" });
  check("message cannot link to ANOTHER business's conversation", r1.error?.code === "23503", r1.error?.code);

  const r2 = await admin.from("messages")
    .insert({ business_id: bizA.id, conversation_id: convA.id, role: "customer", content: "hi" });
  check("message in its OWN business's conversation is accepted", !r2.error, r2.error?.message);

  const r3 = await admin.from("bookings").insert({
    business_id: bizB.id, resource_id: resA1.id, service_id: svcB.id,
    customer_name: "Test", starts_at: iso("10:00"), ends_at: iso("11:00"),
  });
  check("booking cannot use ANOTHER business's resource", r3.error?.code === "23503", r3.error?.code);

  const r4 = await admin.from("bookings").insert({
    business_id: bizA.id, resource_id: resA1.id, service_id: svcB.id,
    customer_name: "Test", starts_at: iso("10:00"), ends_at: iso("11:00"),
  });
  check("booking cannot use ANOTHER business's service", r4.error?.code === "23503", r4.error?.code);

  // ---------- Test 3: double-booking protection ----------
  const book = (biz: any, res: any, svc: any, start: string, end: string) =>
    admin.from("bookings").insert({
      business_id: biz.id, resource_id: res.id, service_id: svc.id,
      customer_name: "Test Customer", starts_at: iso(start), ends_at: iso(end),
    }).select().single();

  const b1 = await book(bizA, resA1, svcA, "10:00", "11:00");
  check("first booking 10:00-11:00 is accepted", !b1.error, b1.error?.message);

  const overlap = await book(bizA, resA1, svcA, "10:30", "11:30");
  check("overlapping booking 10:30-11:30 is REJECTED (23P01)", overlap.error?.code === "23P01", overlap.error?.code);

  const cover = await book(bizA, resA1, svcA, "09:00", "12:00");
  check("booking that fully covers an existing one is REJECTED (23P01)", cover.error?.code === "23P01", cover.error?.code);

  const b2 = await book(bizA, resA1, svcA, "11:00", "12:00");
  check("back-to-back booking 11:00-12:00 is accepted", !b2.error, b2.error?.message);

  const other = await book(bizA, resA2, svcA, "10:00", "11:00");
  check("same time on a DIFFERENT resource is accepted", !other.error, other.error?.message);

  const otherBiz = await book(bizB, resB1, svcB, "10:00", "11:00");
  check("same time at a DIFFERENT business is accepted", !otherBiz.error, otherBiz.error?.message);

  const badTime = await book(bizA, resA2, svcA, "15:00", "14:00");
  check("booking that ends before it starts is REJECTED (23514)", badTime.error?.code === "23514", badTime.error?.code);

  if (b1.data) {
    const cancel = await admin.from("bookings")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", b1.data.id);
    check("booking can be cancelled", !cancel.error, cancel.error?.message);
    const rebook = await book(bizA, resA1, svcA, "10:00", "11:00");
    check("cancelled slot can be booked again", !rebook.error, rebook.error?.message);
  }

  if (b2.data) {
    const selfMove = await admin.from("bookings")
      .update({ starts_at: iso("11:15"), ends_at: iso("12:15") }).eq("id", b2.data.id);
    check("reschedule overlapping its OWN old time is accepted", !selfMove.error, selfMove.error?.message);
    const clash = await admin.from("bookings")
      .update({ starts_at: iso("10:30"), ends_at: iso("11:30") }).eq("id", b2.data.id);
    check("reschedule onto ANOTHER booking is REJECTED (23P01)", clash.error?.code === "23P01", clash.error?.code);
  }
} catch (err) {
  console.error("\nTEST SETUP ERROR:", err instanceof Error ? err.message : err);
  failures++;
} finally {
  // ---------- Cleanup: remove all temporary test data ----------
  const ids = [bizA?.id, bizB?.id].filter(Boolean);
  if (ids.length > 0) {
    await admin.from("bookings").delete().in("business_id", ids);
    const del = await admin.from("businesses").delete().in("id", ids);
    console.log(del.error ? `\nWARNING: cleanup failed: ${del.error.message}` : "\n(temporary test data deleted)");
  }
}

if (failures > 0) {
  console.log(`\n${failures} check(s) FAILED or were skipped`);
  process.exit(1);
}
console.log("\nAll database checks passed");
