/**
 * corpus:transcode — give every WAV and AIFF part a copy that plays everywhere.
 *
 * 23 vocal parts are WAV files up to 94 MB, which is a long wait on church
 * wifi, and AIFF does not play in Chrome or on Android at all. This makes an
 * MP3 of each (VBR around 190 kbps, about a seventh of the size), uploads it
 * next to the original, and records it in `corpus/media/transcoded.json`.
 * `corpus:build` then links the MP3 under the same part name, so the player's
 * buttons do not change, only what they play.
 *
 * Nothing is overwritten or deleted. The original stays in storage and in the
 * media ledger; removing an entry from transcoded.json and rebuilding points
 * the charts back at it. A part that already has an MP3 of the same name is
 * left alone, because the build already prefers that one.
 *
 *   pnpm corpus:transcode --tree <media root> [--apply] [--limit N]
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, "..");

const LOSSLESS = /\.(wav|aiff?)$/i;
/** A transcode is the same recording, so its length must agree to within this. */
export const DURATION_TOLERANCE_SECONDS = 0.5;

/** Every record in the media ledgers, once per key (the ledgers overlap). */
export async function readMediaRecords(corpusRoot) {
  const dir = join(corpusRoot, "media");
  const byKey = new Map();
  for (const name of (await readdir(dir)).sort()) {
    if (!name.endsWith(".ndjson")) continue;
    for (const line of (await readFile(join(dir, name), "utf8")).split("\n")) {
      if (!line.trim()) continue;
      const record = JSON.parse(line);
      if (record.key && !byKey.has(record.key)) byKey.set(record.key, record);
    }
  }
  return [...byKey.values()];
}

export function mp3KeyFor(key) {
  return String(key).replace(LOSSLESS, ".mp3");
}

/**
 * Which originals need an MP3: WAV and AIFF, not already transcoded, and not
 * already beside an MP3 of the same name (which the build links instead).
 */
export function planTranscodes(records, transcoded = {}) {
  const keys = new Set(records.map((record) => record.key));
  const todo = [];
  const alreadyMp3 = [];
  for (const record of records) {
    if (!LOSSLESS.test(record.key)) continue;
    if (transcoded[record.key]) continue;
    if (keys.has(mp3KeyFor(record.key))) {
      alreadyMp3.push(record);
      continue;
    }
    todo.push(record);
  }
  todo.sort((a, b) => a.key.localeCompare(b.key));
  return { todo, alreadyMp3 };
}

/** The ledger with one more transcode, keys sorted so the file diffs cleanly. */
export function withTranscode(ledger, originalKey, entry) {
  const files = { ...(ledger?.files || {}), [originalKey]: entry };
  return {
    version: 1,
    note: "MP3 copies of WAV and AIFF parts, made by corpus:transcode. The build links the copy under the original's part name; the original stays in storage.",
    files: Object.fromEntries(Object.keys(files).sort().map((key) => [key, files[key]])),
  };
}

export function loadTranscodeLedger(corpusRoot) {
  const path = join(corpusRoot, "media", "transcoded.json");
  if (!existsSync(path)) return { version: 1, files: {} };
  return JSON.parse(readFileSync(path, "utf8"));
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolvePromise(out) : reject(new Error(`${command} exited ${code}: ${err.slice(-400)}`))));
  });
}

async function durationOf(path) {
  const out = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path]);
  return Number.parseFloat(out.trim());
}

async function runCli() {
  const argv = process.argv.slice(2);
  const arg = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : null;
  };
  const tree = arg("--tree");
  if (!tree) throw new Error("--tree <media root> is required (the folder the ledger paths start from)");
  const apply = argv.includes("--apply");
  const limit = arg("--limit") ? Number(arg("--limit")) : Infinity;
  const corpusRoot = join(repoRoot, "corpus");

  const records = await readMediaRecords(corpusRoot);
  let ledger = loadTranscodeLedger(corpusRoot);
  const { todo, alreadyMp3 } = planTranscodes(records, ledger.files);
  const bytes = todo.reduce((sum, record) => sum + (record.size || 0), 0);
  console.log(`lossless parts to transcode: ${todo.length} (${(bytes / 1e9).toFixed(2)} GB); already beside an MP3: ${alreadyMp3.length}; done before: ${Object.keys(ledger.files || {}).length}`);
  for (const record of todo.slice(0, 10)) console.log(`  ${record.key}  ${(record.size / 1e6).toFixed(1)} MB`);
  if (todo.length > 10) console.log(`  … and ${todo.length - 10} more`);

  if (!apply) {
    console.log("\nDRY RUN — nothing converted or uploaded. Re-run with --apply.");
    return;
  }

  // The API's env carries the storage credentials; load it before objectStore reads env.
  const envPath = join(repoRoot, "apps", "api", ".env");
  if (existsSync(envPath)) process.loadEnvFile(envPath);
  const { headObject, putFile } = await import(pathToFileURL(join(repoRoot, "apps/api/src/corpus/objectStore.js")).href);

  const work = await mkdtemp(join(tmpdir(), "vpc-transcode-"));
  let done = 0;
  const failures = [];
  try {
    for (const record of todo.slice(0, limit)) {
      const source = join(resolve(tree), ...record.path.split("/"));
      try {
        if (!existsSync(source)) throw new Error("source file missing");
        const info = await stat(source);
        if (info.size !== record.size) throw new Error(`source is ${info.size} bytes, the ledger says ${record.size}`);

        const target = mp3KeyFor(record.key);
        const output = join(work, `part-${done}.mp3`);
        await run("ffmpeg", ["-v", "error", "-y", "-i", source, "-vn", "-map_metadata", "-1", "-c:a", "libmp3lame", "-q:a", "2", "-ar", "44100", output]);

        const [before, after] = await Promise.all([durationOf(source), durationOf(output)]);
        if (!(Math.abs(before - after) <= DURATION_TOLERANCE_SECONDS)) throw new Error(`length changed: ${before}s -> ${after}s`);
        const size = (await stat(output)).size;

        // Never overwrite: the same name holding different bytes is a question for a person.
        const existing = await headObject(target);
        if (existing && existing.size !== size) throw new Error(`${target} already exists with different content`);
        if (!existing) await putFile(target, output, { contentType: "audio/mpeg" });

        ledger = withTranscode(ledger, record.key, { key: target, size, seconds: Math.round(after * 10) / 10 });
        await writeFile(join(corpusRoot, "media", "transcoded.json"), `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
        await rm(output, { force: true });
        done += 1;
        console.log(`  ✓ ${record.key}  ${(record.size / 1e6).toFixed(1)} MB -> ${(size / 1e6).toFixed(1)} MB`);
      } catch (error) {
        failures.push({ key: record.key, error: error.message });
        console.log(`  ✗ ${record.key}: ${error.message}`);
      }
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  console.log(`\nTranscoded ${done}; failed ${failures.length}. Rebuild the corpus so the charts link the MP3s.`);
  if (failures.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
