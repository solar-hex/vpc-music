/**
 * corpus:scan — report what a source tree contains versus what the corpus
 * already covers: covered / new / changed / moved / gone.
 *
 * Built for a 19 GB Dropbox tree, so it must never read bytes it doesn't have
 * to:
 *   - a file is unchanged when path + size + mtime match (mtime within 2s,
 *     because Dropbox/OneDrive/FAT timestamps drift and lose sub-second
 *     precision)
 *   - only new or size/mtime-changed files are hashed
 *   - MEDIA IS NEVER HASHED. Reading a cloud placeholder file triggers
 *     hydration, which can pull gigabytes down. Identity for media is
 *     path + size + mtime only.
 *
 *   pnpm corpus:scan --tree <path> [--ledger <file>] [--rehash]
 *                    [--fail-on new,unreviewed] [--json]
 */
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { normalizeRelativePath, sha256 } from "../apps/api/src/corpus/identity.js";
import { classifyPdfPart, isNotationOnly } from "../apps/api/src/corpus/mediaParts.js";

// Re-exported so the scanner's tests and callers keep one import site.
export { classifyPdfPart, isNotationOnly };

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, "..");

/** Timestamps drift by up to two seconds across filesystems and sync clients. */
export const MTIME_TOLERANCE_MS = 2000;

const MEDIA_EXTENSIONS = new Set([
  ".mp3", ".m4a", ".wav", ".aif", ".aiff", ".flac", ".ogg", ".wma",
  ".mp4", ".mov", ".avi", ".mkv", ".m4v",
  ".zip", ".rar", ".7z", ".gz", ".tar",
  ".jpg", ".jpeg", ".png", ".gif", ".tif", ".tiff", ".heic", ".svg",
  ".pages", ".key", ".numbers",
]);

const SKIP_DIRS = new Set([".vs", ".vscode", ".git", "node_modules", ".dropbox.cache"]);
const SKIP_FILES = new Set([".ds_store", "thumbs.db", "desktop.ini", ".dropbox"]);

/**
 * Classify a file by extension, and by filename for the UPCI part types.
 * `media: true` means "never open this file".
 */
export function classifyFile(relativePath) {
  const name = relativePath.split("/").pop() || "";
  const ext = extname(name).toLowerCase();

  if (MEDIA_EXTENSIONS.has(ext)) return { type: "media", subtype: ext.slice(1), media: true };
  if (ext === ".chrd") return { type: "chrd", subtype: null, media: false };
  if (ext === ".onsong") return { type: "onsong", subtype: null, media: false };
  if (ext === ".docx" || ext === ".doc") return { type: "docx", subtype: ext.slice(1), media: false };
  if (ext === ".txt") return { type: "text", subtype: null, media: false };
  if (ext === ".pdf") return { type: "pdf", subtype: classifyPdfPart(name), media: false };
  return { type: "other", subtype: ext.slice(1) || null, media: true };
}

/** Walk a tree collecting path/size/mtime only — no file contents are read. */
export async function walkTree(root, { onEntry } = {}) {
  const files = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      // An unreadable directory must not abort a 19 GB scan.
      files.push({ path: normalizeRelativePath(relative(root, dir)), error: String(error.message || error) });
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name.toLowerCase())) continue;
        await walk(full);
      } else if (entry.isFile()) {
        if (SKIP_FILES.has(entry.name.toLowerCase())) continue;
        const info = await stat(full).catch(() => null);
        if (!info) continue;
        const record = {
          path: normalizeRelativePath(relative(root, full)),
          fullPath: full,
          size: info.size,
          mtimeMs: Math.round(info.mtimeMs),
        };
        files.push(record);
        if (onEntry) onEntry(record);
      }
    }
  }
  await walk(root);
  return files;
}

/** Same file on disk as the ledger recorded? Size exact, mtime within tolerance. */
export function looksUnchanged(record, previous) {
  if (!previous) return false;
  if (record.size !== previous.size) return false;
  return Math.abs(record.mtimeMs - previous.mtimeMs) <= MTIME_TOLERANCE_MS;
}

/**
 * Diff a walked tree against the previous ledger.
 * `hash` is injected so tests can count exactly how often bytes were read.
 */
export async function diffAgainstLedger({ files, previous, rehash = false, hash }) {
  const previousByPath = new Map(previous.map((f) => [f.path, f]));
  const previousByHash = new Map();
  const previousBySize = new Map();
  for (const record of previous) {
    if (record.sha256) previousByHash.set(record.sha256, record);
    if (!previousBySize.has(record.size)) previousBySize.set(record.size, []);
    previousBySize.get(record.size).push(record);
  }

  const result = { covered: [], new: [], changed: [], moved: [], gone: [], errors: [], byType: {}, hashed: 0 };
  const seen = new Set();

  for (const record of files) {
    if (record.error) {
      result.errors.push(record);
      continue;
    }
    const kind = classifyFile(record.path);
    const bucket = (result.byType[kind.type] ||= { total: 0, new: 0, media: kind.media });
    bucket.total += 1;

    const prev = previousByPath.get(record.path);
    seen.add(record.path);

    if (prev && looksUnchanged(record, prev) && !rehash) {
      result.covered.push({ ...record, ...kind, songId: prev.songId, decision: prev.decision });
      continue;
    }

    // Media identity is path+size+mtime. Never open it: a cloud placeholder
    // would hydrate, potentially pulling gigabytes.
    if (kind.media) {
      if (prev) result.changed.push({ ...record, ...kind, songId: prev.songId });
      else {
        result.new.push({ ...record, ...kind });
        bucket.new += 1;
      }
      continue;
    }

    const digest = await hash(record.fullPath);
    result.hashed += 1;

    if (prev) {
      if (prev.sha256 === digest) result.covered.push({ ...record, ...kind, songId: prev.songId, decision: prev.decision });
      else result.changed.push({ ...record, ...kind, sha256: digest, songId: prev.songId });
      continue;
    }

    // A new path whose hash matches a record elsewhere is a move, not a new
    // song. Candidates are prefiltered by size so this stays cheap.
    const candidate = previousByHash.get(digest);
    if (candidate && !seen.has(candidate.path)) {
      result.moved.push({ ...record, ...kind, sha256: digest, from: candidate.path, songId: candidate.songId });
      seen.add(candidate.path);
      continue;
    }

    result.new.push({ ...record, ...kind, sha256: digest });
    bucket.new += 1;
  }

  for (const record of previous) {
    if (seen.has(record.path)) continue;
    if (result.moved.some((m) => m.from === record.path)) continue;
    result.gone.push(record);
  }

  return result;
}

export function formatScanReport(result, { tree } = {}) {
  const lines = [
    "VPC Music Corpus Scan",
    "=====================",
    `Tree: ${tree}`,
    "",
    `covered   ${String(result.covered.length).padStart(6)}`,
    `new       ${String(result.new.length).padStart(6)}`,
    `changed   ${String(result.changed.length).padStart(6)}`,
    `moved     ${String(result.moved.length).padStart(6)}`,
    `gone      ${String(result.gone.length).padStart(6)}`,
    `errors    ${String(result.errors.length).padStart(6)}`,
    "",
    `files hashed this run: ${result.hashed}`,
    "",
    "By type",
  ];
  for (const [type, info] of Object.entries(result.byType).sort()) {
    lines.push(`  ${type.padEnd(8)} total ${String(info.total).padStart(6)}  new ${String(info.new).padStart(5)}${info.media ? "   (media — never hashed)" : ""}`);
  }
  if (result.new.length > 0) {
    lines.push("", `New files (${result.new.length}) — need a decision`);
    for (const f of result.new.slice(0, 40)) lines.push(`  + ${f.type}/${f.subtype ?? "-"}  ${f.path}`);
    if (result.new.length > 40) lines.push(`  … and ${result.new.length - 40} more`);
  }
  if (result.moved.length > 0) {
    lines.push("", `Moved (${result.moved.length}) — song ids preserved`);
    for (const f of result.moved.slice(0, 20)) lines.push(`  ~ ${f.from} -> ${f.path}`);
  }
  if (result.changed.length > 0) {
    lines.push("", `Changed (${result.changed.length})`);
    for (const f of result.changed.slice(0, 20)) lines.push(`  * ${f.path}`);
  }
  if (result.gone.length > 0) {
    lines.push("", `Gone (${result.gone.length}) — records retained, never deleted`);
    for (const f of result.gone.slice(0, 20)) lines.push(`  - ${f.path}`);
  }
  if (result.errors.length > 0) {
    lines.push("", `Unreadable (${result.errors.length})`);
    for (const f of result.errors.slice(0, 20)) lines.push(`  ! ${f.path}: ${f.error}`);
  }
  return `${lines.join("\n")}\n`;
}

export function parseArgs(argv) {
  const options = { tree: null, ledger: null, rehash: false, failOn: [], json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value after ${arg}`);
      return argv[index];
    };
    if (arg === "--tree" || arg === "--dir") options.tree = next();
    else if (arg === "--ledger") options.ledger = next();
    else if (arg === "--rehash") options.rehash = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--fail-on") options.failOn = next().split(",").map((s) => s.trim()).filter(Boolean);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.tree) throw new Error("--tree <path> is required");
  return options;
}

async function hashFile(fullPath) {
  return sha256(await readFile(fullPath));
}

async function runCli() {
  const options = parseArgs(process.argv.slice(2));
  const tree = resolve(process.cwd(), options.tree);
  if (!existsSync(tree)) throw new Error(`Source tree does not exist: ${tree}`);

  const ledgerPath = resolve(process.cwd(), options.ledger || join(repoRoot, "corpus", "sources", "chrd.json"));
  const previous = existsSync(ledgerPath) ? JSON.parse(await readFile(ledgerPath, "utf8")).files : [];

  const files = await walkTree(tree);
  const result = await diffAgainstLedger({ files, previous, rehash: options.rehash, hash: hashFile });

  if (options.json) {
    console.log(JSON.stringify({ tree, ledger: ledgerPath, ...result }, null, 2));
  } else {
    process.stdout.write(formatScanReport(result, { tree }));
  }

  for (const gate of options.failOn) {
    if (Array.isArray(result[gate]) && result[gate].length > 0) {
      console.error(`\nFailing: ${result[gate].length} ${gate} file(s).`);
      process.exitCode = 1;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
