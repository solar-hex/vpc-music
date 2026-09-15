/**
 * corpus:build — convert source song files into the committed ChordPro corpus.
 *
 * Phase 1 of the two-phase pipeline. It NEVER touches a database:
 *
 *   build:  sources → corpus/songs/*.chopro     (this script)
 *   load:   corpus  → songs table               (corpus-load, the only writer)
 *
 * Output is deterministic: an unchanged source tree produces a byte-identical
 * corpus, so `git diff` shows real content changes and nothing else. That is
 * why no run timestamp is written to any committed file.
 *
 *   pnpm corpus:build --source chrd --tree <path> [--corpus <dir>] [--dry-run]
 *                     [--exclude <glob>]... [--report <dir>]
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { convertChrdToChordPro } from "../shared/index.js";
import { extractDocxParagraphs } from "../apps/api/src/corpus/docxText.js";
import { convertLyricSheetToChordPro } from "../apps/api/src/corpus/lyricSheet.js";
import { convertPdfChartToChordPro } from "../apps/api/src/corpus/pdfSong.js";
import { convertTextChartToChordPro } from "../apps/api/src/corpus/textChart.js";
import { onSongToChordPro } from "../shared/index.js";
import { detectThemes } from "../apps/api/src/corpus/themes.js";
import { enrichChordPro } from "../apps/api/src/corpus/enrich.js";
import { matchTitles } from "../apps/api/src/corpus/titleMatch.js";
import { loadMediaIndex, DROPBOX_ROOTS } from "../apps/api/src/corpus/mediaIndex.js";
import { approvedBySong, loadAliases } from "../apps/api/src/corpus/aliases.js";
import { loadVerified, verifiedNote } from "../apps/api/src/corpus/verified.js";
import { loadMerges } from "../apps/api/src/corpus/merges.js";
import {
  corpusFileName,
  deterministicSongId,
  globToRegExp,
  normalizeRelativePath,
  normalizeTitle,
  nullable,
  sha256,
} from "../apps/api/src/corpus/identity.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, "..");

export const SOURCE_TYPES = ["chrd", "docx", "pdf", "text", "onsong"];

/**
 * One entry per source format. Each supplies how to find its files and how to
 * turn one into ChordPro, so the build plumbing below stays format-agnostic.
 * `convert` is always async and always receives the raw bytes.
 */
/**
 * The old site encoded two decisions in the filename, and nothing else carried
 * them: a leading `~` kept a song out of the default list (you triple-clicked
 * search for `show all` to see them), and `~z_` marked the handful of secular
 * songs. The converter turns `~` into `isDraft`, which is the right VISIBILITY
 * but the wrong meaning — 510 other songs are drafts because a machine was
 * unsure of the conversion, not because anyone chose to hide them.
 *
 * @param {string} relativePath path inside the source tree
 * @returns {string[]} flag ids
 */
export function flagsFromChrdName(relativePath) {
  const name = String(relativePath).split("/").pop() ?? "";
  if (!name.startsWith("~")) return [];
  return name.startsWith("~z_") ? ["secular", "unlisted"] : ["unlisted"];
}

export const SOURCES = {
  chrd: {
    pattern: /\.chrd$/i,
    async convert(filename, buffer) {
      const conversion = convertChrdToChordPro(filename, buffer.toString("utf8"));
      return { ...conversion, confidence: scoreChrdConversion(conversion) };
    },
    flags: flagsFromChrdName,
  },
  docx: {
    // The `(1)` duplicates and the two legacy `.doc` binaries are excluded by
    // the walker; only real Word XML documents convert.
    pattern: /\.docx$/i,
    async convert(filename, buffer) {
      const paragraphs = await extractDocxParagraphs(buffer);
      return convertLyricSheetToChordPro(filename, paragraphs);
    },
  },
  pdf: {
    // Chord charts only. Rhythm charts and vocal parts are engraved notation
    // with no text layer at all — they are media, not songs.
    pattern: /chord.?chart.*\.pdf$/i,
    convert: convertPdfChartToChordPro,
  },
  text: {
    // Plain-text chord charts, often UTF-16LE. Columns were typed by a person,
    // so these need no geometry at all.
    pattern: /\.txt$/i,
    async convert(filename, buffer) {
      return convertTextChartToChordPro(filename, buffer);
    },
  },
  onsong: {
    pattern: /\.onsong$/i,
    async convert(filename, buffer) {
      const content = onSongToChordPro(buffer.toString("utf8"));
      const title = (content.match(/\{title:\s*([^}]+)\}/i) || [, filename.replace(/\.[^.]+$/, "")])[1].trim();
      const key = (content.match(/\{key:\s*([^}]+)\}/i) || [, null])[1];
      return {
        title,
        chordProContent: content,
        metadata: { title, artist: null, key: key ? key.trim() : null, tempo: null, year: null, isDraft: true },
        warnings: [],
        confidence: { score: 0.85, band: "high", reasons: [] },
      };
    },
  },
};

/* ─── confidence ──────────────────────────────────────────────────────────── */

/**
 * Deterministic confidence for a `.chrd` conversion.
 *
 * A clean `.chrd` is the only thing in the whole corpus trusted enough to land
 * as a non-draft; everything else imports as a draft for review.
 *
 * @returns {{ score: number, band: "high"|"medium"|"low", reasons: string[] }}
 */
export function scoreChrdConversion(conversion) {
  const reasons = [];
  let score = 1;

  const warnings = conversion.warnings || [];
  const unrecognized = warnings.filter((w) => /unrecognized chord/i.test(w)).length;
  const rawBlocks = warnings.filter((w) => /kept as plain text/i.test(w)).length;
  const otherWarnings = warnings.length - unrecognized - rawBlocks;

  if (unrecognized > 0) {
    score -= Math.min(0.3, unrecognized * 0.05);
    reasons.push(`${unrecognized} unrecognized chord token(s)`);
  }
  if (rawBlocks > 0) {
    score -= Math.min(0.4, rawBlocks * 0.2);
    reasons.push(`${rawBlocks} block(s) kept as plain text`);
  }
  if (otherWarnings > 0) {
    score -= Math.min(0.1, otherWarnings * 0.02);
    reasons.push(`${otherWarnings} other converter warning(s)`);
  }
  if (!conversion.metadata.key) {
    score -= 0.1;
    reasons.push("no key");
  }
  if (!/\{comment:/.test(conversion.chordProContent)) {
    score -= 0.1;
    reasons.push("no sections detected");
  }

  score = Math.max(0, Math.round(score * 100) / 100);
  const band = score >= 0.85 ? "high" : score >= 0.6 ? "medium" : "low";
  return { score, band, reasons };
}

/* ─── source discovery ────────────────────────────────────────────────────── */

export async function findSourceFiles(inputDir, pattern = /\.chrd$/i) {
  const entries = await readdir(inputDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = join(inputDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".vs" || entry.name === ".vscode" || entry.name === "node_modules") continue;
      files.push(...(await findSourceFiles(fullPath, pattern)));
    } else if (pattern.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

/* ─── ledger ──────────────────────────────────────────────────────────────── */

/** Read a committed JSON file, or a default when it does not exist yet. */
export async function readJsonIfPresent(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(await readFile(path, "utf8"));
}

/** Stable JSON: 2-space indent, trailing newline, no run metadata. */
export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function todayStamp(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/**
 * Decide each source file's identity against the previous ledger.
 *
 * Rules, first hit wins:
 *   1. same path                          -> same song
 *   2. sha256 matches a record elsewhere   -> `moved`, reuse the id
 *   3. otherwise                           -> `new`, mint an id from the path
 *
 * Rule 2 is what stops a Dropbox rename orphaning a database row, and it costs
 * nothing because the hashes already exist.
 */
export function resolveIdentity({ relativePath, contentHash, previousByPath, previousByHash }) {
  const samePath = previousByPath.get(relativePath);
  if (samePath) {
    return { songId: samePath.songId, status: "covered", firstSeen: samePath.firstSeen, decision: samePath.decision };
  }
  const moved = previousByHash.get(contentHash);
  if (moved && !moved.__claimed) {
    moved.__claimed = true;
    return { songId: moved.songId, status: "moved", from: moved.path, firstSeen: moved.firstSeen, decision: moved.decision };
  }
  return { songId: deterministicSongId(relativePath), status: "new", firstSeen: null, decision: "song" };
}

/* ─── build ───────────────────────────────────────────────────────────────── */

export function parseArgs(argv) {
  const options = { source: "chrd", tree: null, corpus: null, dryRun: false, exclude: [], report: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value after ${arg}`);
      return argv[index];
    };
    if (arg === "--source") options.source = next();
    else if (arg === "--tree" || arg === "--dir") options.tree = next();
    else if (arg === "--corpus") options.corpus = next();
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--exclude") options.exclude.push(next());
    else if (arg === "--report") options.report = next();
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.tree) throw new Error("--tree <path> is required");
  if (!SOURCE_TYPES.includes(options.source)) {
    throw new Error(`--source must be one of: ${SOURCE_TYPES.join(", ")}`);
  }
  return options;
}

/**
 * Convert a `.chrd` tree into corpus files, manifest and coverage ledger.
 * Pure apart from reading the tree and (unless dryRun) writing the corpus.
 */
export async function buildCorpus({
  source = "chrd",
  tree,
  corpusDir,
  dryRun = false,
  exclude = [],
  now = new Date(),
} = {}) {
  const inputDir = resolve(tree);
  if (!existsSync(inputDir)) throw new Error(`Source tree does not exist: ${inputDir}`);
  const corpusRoot = resolve(corpusDir || join(repoRoot, "corpus"));

  const spec = SOURCES[source];
  if (!spec) throw new Error(`Unknown source: ${source}`);

  const manifestPath = join(corpusRoot, "manifest", `${source}.json`);
  const ledgerPath = join(corpusRoot, "sources", `${source}.json`);
  const songsDir = join(corpusRoot, "songs", source);

  const previousLedger = await readJsonIfPresent(ledgerPath, { sourceType: source, files: [] });

  /*
   * Decisions about a song — which copy supersedes which — live in the
   * manifest, and are made by corpus:dedupe or by a person editing it. A
   * rebuild regenerates the manifest, so those decisions must be carried
   * across or every rebuild silently discards them.
   */
  const previousManifest = await readJsonIfPresent(manifestPath, { songs: [] });
  const decisionsById = new Map(
    previousManifest.songs
      .filter((s) => s.decision && s.decision !== "song")
      .map((s) => [s.songId, { decision: s.decision, supersededBy: s.supersededBy, supersedeReason: s.supersedeReason }]),
  );
  /*
   * A chart edited in the app and written back by corpus:export is the record
   * from then on. Regenerating it from the source would quietly undo the edit
   * (and the next load would push the source version over it), so its file and
   * manifest entry are kept as exported.
   */
  const appEditedById = new Map(previousManifest.songs.filter((s) => s.appEdited).map((s) => [s.songId, s]));
  const previousByPath = new Map(previousLedger.files.map((f) => [f.path, { ...f }]));
  const previousByHash = new Map();
  for (const record of previousByPath.values()) {
    if (record.sha256) previousByHash.set(record.sha256, record);
  }

  const excludePatterns = exclude.map(globToRegExp);
  const files = await findSourceFiles(inputDir, spec.pattern);

  // Media links live in the chart file itself, so load whatever the media
  // ledgers know. Absent ledgers simply mean no links yet.
  const mediaIndex = await loadMediaIndex(corpusRoot);
  // Reviewed alternate titles, written into each chart as {x_aka:} so the
  // decision lives in git and the file stays the complete record.
  const aliases = approvedBySong(loadAliases(join(corpusRoot, "aliases.json")));
  // Charts the publisher's own number chart agrees with. See corpus:verify.
  const verified = loadVerified(join(corpusRoot, "verified.json"));
  // What a merged song took from the copies it replaced. See corpus:dedupe.
  const merges = loadMerges(join(corpusRoot, "merges.json"));
  const stamp = todayStamp(now);

  const manifestEntries = [];
  const ledgerEntries = [];
  const failures = [];
  const skipped = [];
  const moved = [];
  /** songId -> the exact bytes to write, so nothing is converted twice. */
  const contents = new Map();

  for (const sourcePath of files) {
    const relativePath = normalizeRelativePath(relative(inputDir, sourcePath));
    if (excludePatterns.some((p) => p.test(relativePath) || p.test(basename(relativePath)))) {
      skipped.push(relativePath);
      continue;
    }

    try {
      const rawBuffer = await readFile(sourcePath);
      const info = await stat(sourcePath);
      const contentHash = sha256(rawBuffer);
      const raw = rawBuffer.toString("utf8");

      const conversion = await spec.convert(basename(sourcePath), rawBuffer);
      const identity = resolveIdentity({ relativePath, contentHash, previousByPath, previousByHash });
      if (identity.status === "moved") moved.push({ from: identity.from, to: relativePath });

      const confidence = conversion.confidence;
      const baseContent = `${conversion.chordProContent.trim()}\n`;
      const themes = detectThemes(baseContent).map((t) => t.id);

      // The chart file is the complete record: artist, tempo, themes, where it
      // came from, and one link per media file all travel with the chart.
      const linked = mediaIndex.forTitle(conversion.metadata.title);

      /*
       * A chart the publisher's own number chart agrees with is not a guess.
       * Every PDF lands as a draft because geometry placed its chords, which is
       * the right default — but 181 of them have since been checked against an
       * independent source and have no business staying hidden from the list.
       */
      const proof = verified.get(identity.songId);
      if (proof) conversion.metadata.isDraft = false;

      const content = enrichChordPro({
        content: baseContent,
        metadata: conversion.metadata,
        aka: aliases.get(identity.songId),
        verified: verifiedNote(verified.get(identity.songId)),
        flags: spec.flags ? spec.flags(relativePath) : [],
        themes,
        media: linked.media,
        derivedTempo: linked.tempo,
        sourceType: source,
        sourcePath: relativePath,
        dropboxUrl: linked.dropboxUrl,
        carry: merges.get(identity.songId),
      });
      const file = normalizeRelativePath(
        join("songs", source, corpusFileName(conversion.metadata.title, identity.songId)),
      );
      const edited = appEditedById.get(identity.songId);
      const keepEdit = Boolean(edited) && existsSync(join(corpusRoot, edited.file));
      contents.set(identity.songId, keepEdit ? await readFile(join(corpusRoot, edited.file), "utf8") : content);

      const entry = {
        songId: identity.songId,
        title: conversion.metadata.title,
        file,
        contentSha256: sha256(content),
        metadata: {
          key: nullable(conversion.metadata.key),
          artist: nullable(conversion.metadata.artist),
          year: nullable(conversion.metadata.year),
          tempo: nullable(conversion.metadata.tempo),
          isDraft: Boolean(conversion.metadata.isDraft),
        },
        // Derived from the lyrics, deterministically, so the corpus carries the
        // labels a musician actually searches by. The loader writes these into
        // songs.tags additively; a human rejection (!theme:x) always wins.
        themes,
        sourceType: source,
        sources: [{ role: "primary", path: relativePath, sha256: contentHash }],
        confidence,
        warnings: conversion.warnings,
        ...(decisionsById.get(identity.songId) ?? { decision: identity.decision || "song" }),
      };
      manifestEntries.push(keepEdit ? edited : entry);

      ledgerEntries.push({
        path: relativePath,
        size: info.size,
        mtimeMs: Math.round(info.mtimeMs),
        sha256: contentHash,
        type: source,
        decision: identity.decision || "song",
        songId: identity.songId,
        confidence: confidence.score,
        band: confidence.band,
        warnings: conversion.warnings,
        firstSeen: identity.firstSeen || stamp,
        missingSince: null,
      });
    } catch (error) {
      // Tolerate per-file failure here; the LOADER is all-or-nothing, not the
      // build. One bad file must never block the whole library.
      failures.push({ path: relativePath, error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Records with no file on disk are retained and marked, never deleted.
  const seenPaths = new Set(ledgerEntries.map((e) => e.path));
  const gone = [];
  for (const record of previousByPath.values()) {
    if (seenPaths.has(record.path) || record.__claimed) continue;
    delete record.__claimed;
    gone.push(record.path);
    ledgerEntries.push({ ...record, missingSince: record.missingSince || stamp });
  }

  manifestEntries.sort((a, b) => a.songId.localeCompare(b.songId));
  ledgerEntries.sort((a, b) => a.path.localeCompare(b.path));

  const orphansRemoved = [];
  const duplicateTitles = collectDuplicateTitles(manifestEntries);
  const duplicateFiles = collectDuplicateFiles(manifestEntries);

  const counts = {
    files: files.length,
    skipped: skipped.length,
    converted: manifestEntries.length,
    failed: failures.length,
    moved: moved.length,
    gone: gone.length,
    drafts: manifestEntries.filter((e) => e.metadata.isDraft).length,
    high: manifestEntries.filter((e) => e.confidence.band === "high").length,
    medium: manifestEntries.filter((e) => e.confidence.band === "medium").length,
    low: manifestEntries.filter((e) => e.confidence.band === "low").length,
  };

  const manifest = { sourceType: source, songs: manifestEntries };
  const ledger = { sourceType: source, files: ledgerEntries };

  // Per-file failure is tolerated on purpose — one bad source must never block
  // the whole library. Total failure is different: it means the converter is
  // broken, and writing an empty manifest over a good one would destroy the
  // index. Refuse, and say so.
  if (files.length > 0 && manifestEntries.length === 0) {
    throw new Error(
      `Every one of the ${files.length} file(s) failed to convert; refusing to write an empty corpus.\n` +
        `First error: ${failures[0]?.error ?? "unknown"}`,
    );
  }

  if (!dryRun) {
    await mkdir(songsDir, { recursive: true });
    await mkdir(dirname(manifestPath), { recursive: true });
    await mkdir(dirname(ledgerPath), { recursive: true });
    for (const entry of manifestEntries) {
      await writeFile(join(corpusRoot, entry.file), contents.get(entry.songId), "utf8");
    }
    await writeFile(manifestPath, stableJson(manifest), "utf8");
    await writeFile(ledgerPath, stableJson(ledger), "utf8");

    // A corpus filename is derived from the title, so a title fix renames the
    // file and leaves the old one behind. Sweep anything this source owns that
    // the manifest no longer references, or the corpus slowly fills with
    // orphans that no song points at.
    const wanted = new Set(manifestEntries.map((e) => e.file.split("/").pop()));
    for (const name of await readdir(songsDir)) {
      if (!name.endsWith(".chopro") || wanted.has(name)) continue;
      await rm(join(songsDir, name));
      orphansRemoved.push(name);
    }
  }

  return {
    inputDir,
    corpusRoot,
    dryRun,
    manifest,
    ledger,
    counts,
    failures,
    skipped,
    moved,
    gone,
    duplicateTitles,
    duplicateFiles,
    orphansRemoved,
    paths: { manifest: manifestPath, ledger: ledgerPath, songs: songsDir },
  };
}

/** Back-compat alias: the original chrd-only entry point. */
export const buildChrdCorpus = (options) => buildCorpus({ ...options, source: "chrd" });

/** Titles duplicated inside the corpus (the `~`draft / final pairs). */
export function collectDuplicateTitles(entries) {
  const byTitle = new Map();
  for (const entry of entries) {
    const key = normalizeTitle(entry.title);
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key).push(entry.sources[0].path);
  }
  return [...byTitle.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([title, paths]) => ({ title, files: paths.sort() }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** Two songs resolving to the same corpus filename would silently overwrite. */
export function collectDuplicateFiles(entries) {
  const byFile = new Map();
  for (const entry of entries) {
    if (!byFile.has(entry.file)) byFile.set(entry.file, []);
    byFile.get(entry.file).push(entry.songId);
  }
  return [...byFile.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([file, songIds]) => ({ file, songIds }));
}

export function formatCorpusBuildReportText(summary) {
  const lines = [
    "VPC Music Corpus Build Report",
    "=============================",
    `Mode: ${summary.dryRun ? "DRY RUN (nothing written)" : "APPLIED"}`,
    `Source tree: ${summary.inputDir}`,
    `Corpus: ${summary.corpusRoot}`,
    "",
    "Summary",
    `- Files: ${summary.counts.files} (skipped: ${summary.counts.skipped})`,
    `- Converted: ${summary.counts.converted}, failed: ${summary.counts.failed}`,
    `- Drafts: ${summary.counts.drafts}`,
    `- Confidence: high ${summary.counts.high}, medium ${summary.counts.medium}, low ${summary.counts.low}`,
    `- Moved: ${summary.counts.moved}, gone: ${summary.counts.gone}`,
    "",
    `Moved sources (${summary.moved.length})`,
  ];
  for (const move of summary.moved) lines.push(`- ${move.from} -> ${move.to}`);
  lines.push("", `Sources no longer on disk (${summary.gone.length})`);
  for (const path of summary.gone) lines.push(`- ${path}`);
  lines.push("", `Duplicate titles inside the corpus (${summary.duplicateTitles.length})`);
  for (const dup of summary.duplicateTitles) lines.push(`- "${dup.title}": ${dup.files.join(", ")}`);
  lines.push("", `Orphaned corpus files removed (${(summary.orphansRemoved || []).length})`);
  for (const name of summary.orphansRemoved || []) lines.push(`- ${name}`);
  lines.push("", `Filename collisions (${summary.duplicateFiles.length})`);
  for (const dup of summary.duplicateFiles) lines.push(`- ${dup.file}: ${dup.songIds.join(", ")}`);

  const withWarnings = summary.manifest.songs.filter((s) => s.warnings.length > 0);
  lines.push("", `Converter warnings (${withWarnings.length} songs)`);
  for (const song of withWarnings) {
    for (const warning of song.warnings) lines.push(`- ${song.sources[0].path}: ${warning}`);
  }
  const notHigh = summary.manifest.songs.filter((s) => s.confidence.band !== "high");
  lines.push("", `Below high confidence (${notHigh.length})`);
  for (const song of notHigh) {
    lines.push(`- ${song.sources[0].path} [${song.confidence.band} ${song.confidence.score}]: ${song.confidence.reasons.join("; ")}`);
  }
  lines.push("", `Failures (${summary.failures.length})`);
  for (const failure of summary.failures) lines.push(`- ${failure.path}: ${failure.error}`);
  return `${lines.join("\n")}\n`;
}

async function runCli() {
  const options = parseArgs(process.argv.slice(2));
  const summary = await buildCorpus({
    source: options.source,
    tree: resolve(process.cwd(), options.tree),
    corpusDir: options.corpus ? resolve(process.cwd(), options.corpus) : undefined,
    dryRun: options.dryRun,
    exclude: options.exclude,
  });

  // The run report carries the timestamp; committed corpus files never do.
  const reportDir = resolve(process.cwd(), options.report || join(repoRoot, "apps", "api", "import-reports"));
  await mkdir(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = join(reportDir, `corpus-build-${options.source}-${stamp}`);
  await writeFile(`${base}.txt`, formatCorpusBuildReportText(summary), "utf8");
  await writeFile(`${base}.json`, stableJson({ generatedAt: new Date().toISOString(), ...summary }), "utf8");

  const { counts } = summary;
  console.log(
    `Files ${counts.files} | converted ${counts.converted} | failed ${counts.failed} | drafts ${counts.drafts} | ` +
      `high ${counts.high} | medium ${counts.medium} | low ${counts.low} | moved ${counts.moved} | gone ${counts.gone}`,
  );
  console.log(`Report: ${base}.txt`);
  if (counts.failed > 0) process.exitCode = 1;
  if (summary.duplicateFiles.length > 0) {
    console.error(`${summary.duplicateFiles.length} filename collision(s) — corpus would lose songs.`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
