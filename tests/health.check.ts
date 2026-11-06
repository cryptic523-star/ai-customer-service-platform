// Automatic test: the health endpoint must only show diagnostics when APP_ENV=local.
// Run with: npm run test:health
import health from "../netlify/functions/health";

async function callHealth(appEnvValue: string | undefined) {
  if (appEnvValue === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = appEnvValue;
  const res = await health(new Request("http://localhost/api/health"));
  return (await res.json()) as Record<string, unknown>;
}

let failures = 0;
function check(name: string, passed: boolean) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failures++;
}

const local = await callHealth("local");
check("APP_ENV=local shows diagnostics", "diagnostics" in local);

const production = await callHealth("production");
check("APP_ENV=production hides diagnostics", !("diagnostics" in production));
check("APP_ENV=production still reports ok", production.ok === true);

const unset = await callHealth(undefined);
check("APP_ENV missing hides diagnostics (fail-closed)", !("diagnostics" in unset));

const typo = await callHealth("Local ");
check("APP_ENV with a typo hides diagnostics (fail-closed)", !("diagnostics" in typo));

if (failures > 0) {
  console.log(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll checks passed");
