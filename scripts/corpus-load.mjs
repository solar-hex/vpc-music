/**
 * corpus:load / corpus:export — the two-way bridge between the corpus and the
 * songs table.
 *
 *   pnpm corpus:load   [dev|staging|production] --org <name|uuid> [--fields core|tags|all]
 *                      [--created-by <email>] [--apply] [--yes]
 *   pnpm corpus:export [dev|staging|production] --org <name|uuid> [--apply] [--force]
 *
 * Dry run by default. Applying against production needs `--yes` as well, and
 * the target host and database are printed before anything is written —
 * `apps/api/.env` may point at the live database.
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, "..");

const ENV_FILES = {
  dev: ".env", development: ".env",
  stg: ".env.staging", stage: ".env.staging", staging: ".env.staging",
  prd: ".env.production", prod: ".env.production", production: ".env.production",
};

export function parseArgs(argv) {
  const options = {
    mode: "load", env: null, org: null, createdBy: null,
    fields: "core", apply: false, yes: false, force: false, corpus: null,
  };
  // `--export` is supplied by the package script, so it can arrive before the
  // environment the user typed. Take it out first, then read the positional.
  const rest = [...argv].filter((a) => {
    if (a === "--export") { options.mode = "export"; return false; }
    return true;
  });
  if (rest[0] && !rest[0].startsWith("--")) options.env = rest.shift();

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    const next = () => {
      i += 1;
      if (i >= rest.length) throw new Error(`Missing value after ${arg}`);
      return rest[i];
    };
    if (arg === "--org") options.org = next();
    else if (arg === "--created-by") options.createdBy = next();
    else if (arg === "--fields") options.fields = next();
    else if (arg === "--corpus") options.corpus = next();
    else if (arg === "--apply") options.apply = true;
    else if (arg === "--yes") options.yes = true;
    else if (arg === "--force") options.force = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.org) throw new Error("--org <name|uuid> is required");
  if (options.env && !ENV_FILES[options.env]) {
    throw new Error(`Unknown environment "${options.env}". Use one of: ${Object.keys(ENV_FILES).join(", ")}`);
  }
  return options;
}

/** Load the chosen env file before anything imports the database config. */
export function loadEnv(env, root = repoRoot) {
  const file = ENV_FILES[env ?? "dev"];
  const path = join(root, "apps", "api", file);
  if (!existsSync(path)) throw new Error(`Env file not found: ${path}`);
  process.loadEnvFile(path);
  return path;
}

/** Host and database, so a run always says what it is about to touch. */
export function describeTarget(url) {
  try {
    const u = new URL(url);
    return { host: u.hostname, database: u.pathname.replace(/^\//, "") };
  } catch {
    return { host: null, database: null };
  }
}

async function runCli() {
  const options = parseArgs(process.argv.slice(2));
  const envPath = loadEnv(options.env);
  const target = describeTarget(process.env.DATABASE_URL);
  const corpusRoot = resolve(process.cwd(), options.corpus ?? join(repoRoot, "corpus"));

  const looksLikeProduction =
    options.env?.startsWith("pr") || /prd|prod/i.test(target.database ?? "");

  console.log(`env      : ${envPath}`);
  console.log(`database : ${target.host ?? "?"} / ${target.database ?? "?"}`);
  console.log(`corpus   : ${corpusRoot}`);
  console.log(`mode     : ${options.mode}${options.apply ? " (APPLY)" : " (dry run)"}`);
  console.log("");

  if (options.apply && looksLikeProduction && !options.yes) {
    throw new Error(
      `Refusing to write to "${target.database}" without --yes.\n` +
        `This looks like production. Re-run with --yes once you have read the dry-run plan.`,
    );
  }

  const { db, pool } = await import("../apps/api/src/db.js");
  try {
    if (options.mode === "export") {
      const { runCorpusExport, formatExportReport } = await import("../apps/api/src/corpus/exportCorpus.js");
      const report = await runCorpusExport(
        { corpusRoot, org: options.org, dryRun: !options.apply, force: options.force },
        { database: db },
      );
      process.stdout.write(formatExportReport(report));
      await writeReport(report, "corpus-export");
      if ((report.counts.conflict ?? 0) > 0 && !options.force) process.exitCode = 1;
      return;
    }

    const { runCorpusLoad, formatLoadReport } = await import("../apps/api/src/corpus/loadCorpus.js");
    const report = await runCorpusLoad(
      {
        corpusRoot, org: options.org, createdBy: options.createdBy,
        fields: options.fields, dryRun: !options.apply,
        host: target.host, database: target.database,
      },
      { database: db },
    );
    process.stdout.write(formatLoadReport(report));
    await writeReport(report, "corpus-load");
    if (!options.apply) console.log("\nNothing written. Re-run with --apply once the plan above looks right.");
  } finally {
    await pool.end().catch(() => {});
  }
}

async function writeReport(report, name) {
  const dir = join(repoRoot, "apps", "api", "import-reports");
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(dir, `${name}-${stamp}.json`);
  await writeFile(path, `${JSON.stringify({ generatedAt: new Date().toISOString(), ...report }, null, 2)}\n`, "utf8");
  console.log(`\nReport: ${path}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
