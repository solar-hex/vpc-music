/**
 * intake — one place to drop anything, and a routine that files it.
 *
 *   intake/inbox/       drop PDFs, Word docs, .chrd, .onsong, audio — anything
 *   intake/processed/   converted into the corpus
 *   intake/duplicate/   the library already has this song (the log says which)
 *   intake/media/       recognised as media, ready for corpus:media
 *   intake/rejected/    unusable, with a .why.txt beside it
 *   intake/log.ndjson   every decision ever made, append-only
 *
 * Dry run by default; nothing moves and nothing is written without --apply.
 *
 *   pnpm intake [--apply] [--inbox <dir>]
 */
import { existsSync } from "node:fs";
import { appendFile, copyFile, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { convertChrdToChordPro, onSongToChordPro } from "../shared/index.js";
import { extractDocxParagraphs } from "../apps/api/src/corpus/docxText.js";
import { convertLyricSheetToChordPro } from "../apps/api/src/corpus/lyricSheet.js";
import { classifyAudioPart, classifyPdfPart, isNotationOnly } from "../apps/api/src/corpus/mediaParts.js";
import { matchTitles } from "../apps/api/src/corpus/titleMatch.js";
import { sha256 } from "../apps/api/src/corpus/identity.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, "..");

export const BUCKETS = ["processed", "duplicate", "media", "rejected"];

const AUDIO = /\.(mp3|m4a|wav|aiff?|flac|ogg)$/i;
const IMAGE = /\.(png|jpe?g|gif|tiff?|heic|svg)$/i;
const ARCHIVE = /\.(zip|rar|7z|gz|tar)$/i;

/**
 * What is this file, and what should happen to it?
 * Pure: takes the bytes and the name, returns a decision.
 */
export async function classify(filename, buffer, { existingTitles = [] } = {}) {
  const ext = extname(filename).toLowerCase();
  const base = basename(filename);

  if (AUDIO.test(ext)) {
    const { part, bpm } = classifyAudioPart(base);
    return { bucket: "media", kind: "audio", detail: `${part}${bpm ? ` · ${bpm} BPM` : ""}` };
  }
  if (IMAGE.test(ext)) return { bucket: "media", kind: "image", detail: ext.slice(1) };
  if (ARCHIVE.test(ext)) {
    return { bucket: "rejected", kind: "archive", reason: "Archives are not unpacked automatically — extract it and drop the contents in." };
  }

  if (ext === ".pdf") {
    const part = classifyPdfPart(base);
    if (isNotationOnly(part)) {
      return { bucket: "media", kind: "pdf", detail: `${part} — engraved notation, no text to extract` };
    }
    return {
      bucket: "media",
      kind: "pdf",
      detail: `${part}`,
      note: "Chord and number charts carry text; converting them needs the PDF extractor, which is not built yet.",
    };
  }

  // Formats we can turn into a chart.
  let conversion = null;
  try {
    if (ext === ".chrd") {
      conversion = convertChrdToChordPro(base, buffer.toString("utf8"));
    } else if (ext === ".onsong") {
      const content = onSongToChordPro(buffer.toString("utf8"));
      const title = (content.match(/\{title:\s*([^}]+)\}/i) || [, basename(base, ext)])[1].trim();
      conversion = { title, chordProContent: content, metadata: { title, isDraft: true }, warnings: [], confidence: { score: 0.8, band: "medium", reasons: [] } };
    } else if (ext === ".docx") {
      conversion = convertLyricSheetToChordPro(base, await extractDocxParagraphs(buffer));
    } else if (ext === ".txt" || ext === ".chopro" || ext === ".cho") {
      const text = buffer.toString("utf8");
      conversion = convertLyricSheetToChordPro(base, text.split(/\r?\n/));
    }
  } catch (error) {
    return { bucket: "rejected", kind: ext.slice(1) || "unknown", reason: `Could not read it: ${error.message}` };
  }

  if (!conversion) {
    return { bucket: "rejected", kind: ext.slice(1) || "unknown", reason: `Nothing here reads ${ext || "a file with no extension"}.` };
  }

  const title = conversion.metadata?.title || conversion.title;
  if (!title) {
    return { bucket: "rejected", kind: ext.slice(1), reason: "No title could be found in the file." };
  }

  // Already in the library?
  const { matched, probable } = matchTitles([title], existingTitles);
  if (matched.length > 0) {
    return { bucket: "duplicate", kind: ext.slice(1), title, match: matched[0].song.title, confidence: "exact" };
  }
  if (probable.length > 0) {
    return {
      bucket: "duplicate", kind: ext.slice(1), title,
      match: probable[0].song.title, confidence: "probable",
      note: "Close to an existing title rather than identical — check before discarding.",
    };
  }

  return { bucket: "processed", kind: ext.slice(1), title, conversion };
}

/** Move a file, falling back to copy+delete across volumes. */
export async function moveFile(from, to) {
  await mkdir(dirname(to), { recursive: true });
  try {
    await rename(from, to);
  } catch {
    await copyFile(from, to);
    await unlink(from);
  }
}

/** A destination that never overwrites something already filed. */
export async function uniquePath(dir, name) {
  const ext = extname(name);
  const stem = basename(name, ext);
  let candidate = join(dir, name);
  let n = 2;
  while (existsSync(candidate)) {
    candidate = join(dir, `${stem} (${n})${ext}`);
    n += 1;
  }
  return candidate;
}

export function formatSummary(results) {
  const by = {};
  for (const r of results) by[r.decision.bucket] = (by[r.decision.bucket] || 0) + 1;
  const lines = ["", "Summary"];
  for (const b of BUCKETS) lines.push(`  ${b.padEnd(10)} ${by[b] || 0}`);
  return lines.join("\n");
}

async function runCli() {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const i = argv.indexOf("--inbox");
  const intakeRoot = resolve(process.cwd(), i === -1 ? join(repoRoot, "intake") : argv[i + 1]);
  const inbox = join(intakeRoot, "inbox");

  for (const d of ["inbox", ...BUCKETS]) await mkdir(join(intakeRoot, d), { recursive: true });

  // What the library already has, so a duplicate is recognised.
  const manifestDir = join(repoRoot, "corpus", "manifest");
  const existingTitles = [];
  if (existsSync(manifestDir)) {
    for (const f of await readdir(manifestDir)) {
      if (!f.endsWith(".json")) continue;
      for (const s of JSON.parse(await readFile(join(manifestDir, f), "utf8")).songs) {
        existingTitles.push({ id: s.songId, title: s.title, aka: null });
      }
    }
  }

  const entries = (await readdir(inbox, { withFileTypes: true })).filter((e) => e.isFile());
  if (entries.length === 0) {
    console.log(`Inbox is empty: ${inbox}`);
    console.log("Drop anything in there — PDFs, Word docs, .chrd, .onsong, audio — and run this again.");
    return;
  }

  console.log(`${apply ? "Filing" : "DRY RUN —"} ${entries.length} file(s) from ${inbox}`);
  console.log(`Library: ${existingTitles.length} songs\n`);

  const results = [];
  for (const entry of entries) {
    const from = join(inbox, entry.name);
    const buffer = await readFile(from);
    const info = await stat(from);
    const decision = await classify(entry.name, buffer, { existingTitles });
    results.push({ name: entry.name, decision });

    const label = decision.bucket.toUpperCase().padEnd(10);
    const detail =
      decision.bucket === "duplicate" ? `already have "${decision.match}" (${decision.confidence})`
      : decision.bucket === "rejected" ? decision.reason
      : decision.title || decision.detail || decision.kind;
    console.log(`  ${label} ${entry.name}`);
    console.log(`             ${detail}`);
    if (decision.note) console.log(`             note: ${decision.note}`);

    if (!apply) continue;

    const dest = await uniquePath(join(intakeRoot, decision.bucket), entry.name);
    if (decision.bucket === "rejected") {
      await writeFile(`${dest}.why.txt`, `${decision.reason}\n`, "utf8");
    }
    await moveFile(from, dest);

    await appendFile(
      join(intakeRoot, "log.ndjson"),
      `${JSON.stringify({
        at: new Date().toISOString(),
        file: entry.name,
        sha256: sha256(buffer),
        bytes: info.size,
        bucket: decision.bucket,
        kind: decision.kind,
        title: decision.title ?? null,
        match: decision.match ?? null,
        reason: decision.reason ?? null,
      })}\n`,
      "utf8",
    );
  }

  console.log(formatSummary(results));
  if (!apply) {
    console.log("\nNothing moved. Re-run with --apply to file them.");
  } else {
    const processed = results.filter((r) => r.decision.bucket === "processed").length;
    if (processed > 0) {
      console.log(`\n${processed} song(s) are ready to convert. Point corpus:build at intake/processed/ to add them.`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
