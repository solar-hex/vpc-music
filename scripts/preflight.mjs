/**
 * Preflight checks — run before deploy to catch problems early.
 */
import { execSync } from "child_process";

const checks = [];

function run(label, cmd) {
  process.stdout.write(`  ${label}...`);
  try {
    execSync(cmd, { stdio: "pipe" });
    console.log(" ✅");
    checks.push({ label, status: "pass" });
  } catch (err) {
    console.log(" ❌");
    checks.push({ label, status: "fail", error: err.message });
  }
}

console.log("\n🛫 VPC Music Preflight\n");

run("TypeScript", "pnpm typecheck");
run("Tests", "pnpm test:all");
run("Shared sync", "node scripts/check-shared-drift.mjs");

console.log("\n── Summary ──");
const failures = checks.filter((c) => c.status === "fail");
if (failures.length > 0) {
  console.log(`\n❌ ${failures.length} check(s) failed:`);
  failures.forEach((f) => console.log(`   - ${f.label}`));
  process.exit(2);
} else {
  console.log("\n✅ All checks passed.");
  process.exit(0);
}
