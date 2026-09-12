/**
 * corpus:media — inventory a media tree and sync it to object storage.
 *
 * Dry run by default. Nothing is uploaded without --apply.
 *
 *   pnpm corpus:media --tree <path> [--apply] [--max-bytes N] [--only <glob>]
 *
 * Design notes:
 *  - Media bytes never enter git or Postgres. The committed artefact is the
 *    NDJSON ledger under corpus/media/, which records every file, its key, its
 *    size and any BPM read from its name.
 *  - Keys mirror the corpus naming, so one identity threads the chart file, the
 *    database row and the object store.
 *  - Already-uploaded objects are skipped by key + size, so a re-run is cheap
 *    and interrupting it is safe.
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { normalizeRelativePath, normalizeTitle, slugifyTitle } from "../apps/api/src/corpus/identity.js";
import { classifyAudioPart, classifyPdfPart, mediaKey } from "../apps/api/src/corpus/mediaParts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, "..");

/**
 * env.js resolves .env relative to the process CWD, and these scripts run from
 * the repo root. Load apps/api/.env explicitly before anything imports env.
 */
export function loadApiEnv(root = repoRoot) {
  const envPath = join(root, "apps", "api", ".env");
  if (!existsSync(envPath)) return false;
  try {
    process.loadEnvFile(envPath);
    return true;
  } catch {
    return false;
  }
}

/* ─── where a file belongs ────────────────────────────────────────────────── */

/** Directories that group songs but are not songs themselves. */
const CONTAINER_DIRS = new Set([
  "exclude", "shared dropbox", "church music projects",
  "upci song parts tg", "upci music", "vpc choir", "vpc praise",
  "vpc direct recordings", "songlist",
]);

/** Top-level areas that hold material belonging to no single song. */
const LIBRARY_ROOTS = new Set([
  "song lists", "lessons", "other", "songbuilderhelper", "tbd",
]);

const YEAR_DIR = /^(?:19|20)\d\d$/;
/** "Holy-Ghost-Vocal-Part-MP3s", "nothing_but_the_blood_stems" */
const PART_SUBFOLDER = /(vocal[\s_-]*part|[\s_-]mp3s?$|stems?$)/i;

const AUDIO_EXT = /\.(mp3|m4a|wav|aiff?|flac|ogg)$/i;
const DOC_EXT = /\.(pdf|docx?|txt|onsong|chrd|mid|pages|xlsx?)$/i;

/**
 * Decide which song (if any) a file belongs to, from its path.
 * @returns {{ scope: "song"|"library", songName: string|null }}
 */
export function locateFile(relativePath) {
  const parts = normalizeRelativePath(relativePath).split("/");
  const dirs = parts.slice(0, -1);

  for (const d of dirs) {
    if (LIBRARY_ROOTS.has(d.toLowerCase())) return { scope: "library", songName: null };
  }

  const meaningful = dirs.filter(
    (d) => !CONTAINER_DIRS.has(d.toLowerCase()) && !YEAR_DIR.test(d) && !PART_SUBFOLDER.test(d),
  );
  if (meaningful.length === 0) return { scope: "library", songName: null };
  return { scope: "song", songName: meaningful[meaningful.length - 1] };
}

/** Build the full plan entry for one file. */
export function planFile({ relativePath, size, rootPath, songsByTitle }) {
  const ext = extname(relativePath);
  const { scope, songName } = locateFile(relativePath);

  if (scope === "library") {
    return {
      path: relativePath, size, scope: "library", songName: null, songId: null,
      part: null, bpm: null,
      key: mediaKey({ rootPath, kind: "library", ext, originalPath: relativePath }),
    };
  }

  const corpusSong = songsByTitle.get(normalizeTitle(songName)) || null;
  const songSlug = slugifyTitle(corpusSong ? corpusSong.title : songName);

  let kind = "source";
  let part = null;
  let bpm = null;
  let instrument = null;

  if (AUDIO_EXT.test(ext)) {
    const a = classifyAudioPart(relativePath);
    kind = "audio";
    part = a.part;
    bpm = a.bpm;
    instrument = a.instrument;
  } else if (/\.pdf$/i.test(ext)) {
    kind = "charts";
    part = classifyPdfPart(relativePath);
  }

  return {
    path: relativePath,
    size,
    scope: "song",
    songName,
    songId: corpusSong ? corpusSong.songId : null,
    songSlug,
    part,
    bpm,
    key: mediaKey({ rootPath, songSlug, songId: corpusSong?.songId, kind, part, bpm, instrument, ext, originalPath: relativePath }),
  };
}

/* ─── walk ────────────────────────────────────────────────────────────────── */

const SKIP_DIRS = new Set([".vs", ".vscode", ".git", "node_modules", ".dropbox.cache"]);
const SKIP_FILES = new Set([".ds_store", "thumbs.db", "desktop.ini", ".dropbox"]);

export async function walkMedia(root) {
  const files = [];
  async function walk(dir) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name.toLowerCase())) continue;
        await walk(full);
      } else if (e.isFile()) {
        if (SKIP_FILES.has(e.name.toLowerCase())) continue;
        if (!AUDIO_EXT.test(e.name) && !DOC_EXT.test(e.name) && !/\.(zip|png|jpe?g|svg|aif)$/i.test(e.name)) continue;
        const info = await stat(full).catch(() => null);
        if (!info) continue;
        files.push({ path: normalizeRelativePath(relative(root, full)), fullPath: full, size: info.size });
      }
    }
  }
  await walk(root);
  return files;
}

/* ─── plan + apply ────────────────────────────────────────────────────────── */

export function parseArgs(argv) {
  const options = { tree: null, apply: false, maxBytes: Infinity, only: null, ledger: null, name: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value after ${arg}`);
      return argv[i];
    };
    if (arg === "--tree" || arg === "--dir") options.tree = next();
    else if (arg === "--apply") options.apply = true;
    else if (arg === "--max-bytes") options.maxBytes = Number(next());
    else if (arg === "--only") options.only = next();
    else if (arg === "--ledger") options.ledger = next();
    else if (arg === "--name") options.name = next();
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.tree) throw new Error("--tree <path> is required");
  return options;
}

/**
 * Two files can normalise to the same key — most often several PDFs that all
 * classify as "other". Uploading both would silently destroy one, so any
 * collision is broken by falling back to the source filename.
 *
 * Mutates and returns `entries`, plus the list of keys that had to be changed.
 */
export function resolveKeyCollisions(entries) {
  const byKey = new Map();
  for (const e of entries) {
    if (!byKey.has(e.key)) byKey.set(e.key, []);
    byKey.get(e.key).push(e);
  }

  const resolved = [];
  for (const [key, group] of byKey) {
    if (group.length < 2) continue;
    for (const e of group) {
      const ext = extname(e.path);
      const stem = slugifyTitle(basename(e.path, ext));
      e.key = key.replace(new RegExp(`[^/]+${ext.replace(".", "\\.")}$`, "i"), `${stem}${ext.toLowerCase()}`);
    }
    resolved.push({ key, count: group.length });
  }

  // A second pass catches the rare case where two source names also collide.
  const seen = new Set();
  for (const e of entries) {
    let candidate = e.key;
    let n = 2;
    while (seen.has(candidate)) {
      const ext = extname(candidate);
      candidate = `${candidate.slice(0, -ext.length)}-${n}${ext}`;
      n += 1;
    }
    e.key = candidate;
    seen.add(candidate);
  }

  return { entries, resolved };
}

export function summarise(entries) {
  const counts = { files: entries.length, bytes: 0, songs: new Set(), matched: 0, library: 0, withBpm: 0 };
  const byPart = {};
  for (const e of entries) {
    counts.bytes += e.size;
    if (e.scope === "library") counts.library += 1;
    else {
      counts.songs.add(e.songSlug);
      if (e.songId) counts.matched += 1;
    }
    if (e.bpm) counts.withBpm += 1;
    const p = e.part || e.scope;
    byPart[p] = (byPart[p] || 0) + 1;
  }
  return { ...counts, songs: counts.songs.size, byPart };
}

async function runCli() {
  const options = parseArgs(process.argv.slice(2));
  const tree = resolve(process.cwd(), options.tree);
  if (!existsSync(tree)) throw new Error(`Tree does not exist: ${tree}`);

  loadApiEnv();
  const { env } = await import("../apps/api/src/config/env.js");
  const store = await import("../apps/api/src/corpus/objectStore.js");

  if (!store.isObjectStoreConfigured(env)) {
    throw new Error("Object storage is not configured — check WASABI_* in apps/api/.env");
  }

  // Corpus songs, so media can be keyed to a real chart where one exists.
  const manifestPath = join(repoRoot, "corpus", "manifest", "chrd.json");
  const songsByTitle = new Map();
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(await (await import("node:fs/promises")).readFile(manifestPath, "utf8"));
    for (const s of manifest.songs) songsByTitle.set(normalizeTitle(s.title), s);
  }

  const files = await walkMedia(tree);
  const onlyRe = options.only ? new RegExp(options.only.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*"), "i") : null;
  const entries = files
    .filter((f) => !onlyRe || onlyRe.test(f.path))
    .map((f) => ({ ...planFile({ relativePath: f.path, size: f.size, rootPath: env.S3_ROOT_PATH, songsByTitle }), fullPath: f.fullPath }));

  const { resolved } = resolveKeyCollisions(entries);
  const stats = summarise(entries);
  console.log(`tree:     ${tree}`);
  console.log(`bucket:   ${env.S3_BUCKET}  root=${env.S3_ROOT_PATH}`);
  console.log(`files:    ${stats.files}  (${(stats.bytes / 1073741824).toFixed(2)} GB)`);
  console.log(`songs:    ${stats.songs}  (${stats.matched} files attach to an existing chart)`);
  console.log(`library:  ${stats.library} files not song-specific`);
  console.log(`bpm read: ${stats.withBpm} files`);
  console.log(`parts:    ${Object.entries(stats.byPart).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join("  ")}`);
  if (resolved.length > 0) {
    console.log(`\n${resolved.length} key collision(s) broken by falling back to the source filename, e.g.`);
    for (const c of resolved.slice(0, 5)) console.log(`  ${c.count}x  ${c.key}`);
  }

  // What is already up there?
  console.log("\nlisting existing objects…");
  const existing = new Map();
  for (const o of await store.listObjects("media/")) existing.set(o.key, o.size);
  console.log(`  ${existing.size} object(s) already in the bucket`);

  const todo = entries.filter((e) => existing.get(e.key) !== e.size);
  const skip = entries.length - todo.length;
  const todoBytes = todo.reduce((a, e) => a + e.size, 0);
  console.log(`\nto upload: ${todo.length} file(s), ${(todoBytes / 1073741824).toFixed(2)} GB   (skipping ${skip} already present)`);

  if (!options.apply) {
    console.log("\nDRY RUN — nothing uploaded. Re-run with --apply.");
    for (const e of todo.slice(0, 15)) console.log(`  + ${e.key}`);
    if (todo.length > 15) console.log(`  … and ${todo.length - 15} more`);
  } else {
    let done = 0, bytes = 0, failed = 0;
    for (const e of todo) {
      if (bytes >= options.maxBytes) { console.log(`\nreached --max-bytes budget; stopping cleanly.`); break; }
      try {
        await store.putFile(e.key.replace(`${env.S3_ROOT_PATH}/`, ""), e.fullPath);
        done += 1;
        bytes += e.size;
        if (done % 25 === 0 || e.size > 20 * 1048576) {
          console.log(`  ${done}/${todo.length}  ${(bytes / 1073741824).toFixed(2)} GB  ${e.key.split("/").slice(-3).join("/")}`);
        }
      } catch (error) {
        failed += 1;
        console.error(`  FAIL ${e.path}: ${error.message}`);
      }
    }
    console.log(`\nuploaded ${done} file(s), ${(bytes / 1073741824).toFixed(2)} GB, ${failed} failed`);
  }

  // The committed artefact: one line per file, no bytes.
  const ledgerDir = join(repoRoot, "corpus", "media");
  await mkdir(ledgerDir, { recursive: true });
  const ledgerPath = options.ledger
    ? resolve(process.cwd(), options.ledger)
    : join(ledgerDir, `${options.name || slugifyTitle(basename(tree))}.ndjson`);
  const lines = entries
    .map((e) => {
      const { fullPath, ...rest } = e;
      return JSON.stringify(rest);
    })
    .sort();
  await writeFile(ledgerPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`ledger:   ${ledgerPath}  (${lines.length} lines)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
