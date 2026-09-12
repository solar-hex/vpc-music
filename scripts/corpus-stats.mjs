/**
 * corpus:stats — the state of the whole library, in one place.
 *
 * Reads only committed files (the corpus and its ledgers), so it needs no
 * database and no network. Writes a JSON report plus a readable table.
 *
 *   pnpm corpus:stats [--json <file>] [--out <file>]
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hasChords, songCompleteness, tempoBand } from "../apps/api/src/corpus/completeness.js";
import { loadThemes } from "../apps/api/src/corpus/themes.js";
import { matchTitles, titleKey } from "../apps/api/src/corpus/titleMatch.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, "..");

/** Every song in the corpus, with its content and derived facts. */
export async function collectSongs(corpusRoot) {
  const manifestDir = join(corpusRoot, "manifest");
  const songs = [];
  for (const file of (await readdir(manifestDir)).sort()) {
    if (!file.endsWith(".json")) continue;
    const manifest = JSON.parse(await readFile(join(manifestDir, file), "utf8"));
    for (const song of manifest.songs) {
      const path = join(corpusRoot, song.file);
      const content = existsSync(path) ? await readFile(path, "utf8") : "";
      songs.push({
        ...song,
        source: manifest.sourceType,
        content,
        chords: hasChords(content),
        lines: content.split("\n").filter((l) => l.trim() && !l.startsWith("{")).length,
      });
    }
  }
  return songs;
}

/** Media, keyed by song, from the committed NDJSON ledgers. */
export async function collectMedia(corpusRoot) {
  const dir = join(corpusRoot, "media");
  const bySongSlug = new Map();
  const bpmBySlug = new Map();
  // The ledgers overlap (a PDF-only pass and a full pass), so dedupe by key.
  const seen = new Set();
  let files = 0;
  let bytes = 0;
  if (!existsSync(dir)) return { bySongSlug, bpmBySlug, files, bytes };
  for (const name of (await readdir(dir)).sort()) {
    if (!name.endsWith(".ndjson")) continue;
    for (const line of (await readFile(join(dir, name), "utf8")).trim().split("\n")) {
      if (!line) continue;
      const rec = JSON.parse(line);
      if (seen.has(rec.key)) continue;
      seen.add(rec.key);
      files += 1;
      bytes += rec.size || 0;
      if (!rec.songSlug) continue;
      const name = rec.songName || rec.songSlug;
      if (!bySongSlug.has(name)) bySongSlug.set(name, []);
      bySongSlug.get(name).push(rec);
      if (rec.bpm) {
        if (!bpmBySlug.has(name)) bpmBySlug.set(name, new Set());
        bpmBySlug.get(name).add(rec.bpm);
      }
    }
  }
  return { bySongSlug, bpmBySlug, files, bytes };
}

function tally(items, key) {
  const out = {};
  for (const item of items) {
    const k = key(item);
    if (k === null || k === undefined) continue;
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

export function buildStats({ songs, media, themeLexicon }) {
  const slugOf = (song) => song.file.split("/").pop().replace(/--[0-9a-f]{8}\.chopro$/, "");

  // Media folders are named by the source tree, songs by their title, so the
  // two only meet through the matcher — the same lesson as everywhere else.
  const mediaNames = [...media.bySongSlug.keys()];
  const matchIndex = new Map();
  if (mediaNames.length > 0) {
    const have = songs.map((s) => ({ id: s.songId, title: s.title, aka: null }));
    const { matched, probable } = matchTitles(mediaNames, have);
    for (const m of [...matched, ...probable]) {
      if (!matchIndex.has(m.song.id)) matchIndex.set(m.song.id, []);
      matchIndex.get(m.song.id).push(m.title);
    }
  }

  const rows = songs.map((song) => {
    const slug = slugOf(song);
    const names = matchIndex.get(song.songId) || [];
    const mediaFiles = names.flatMap((n) => media.bySongSlug.get(n) || []);
    const bpms = [...new Set(names.flatMap((n) => [...(media.bpmBySlug.get(n) || [])]))];
    const derivedTempo = bpms.length === 1 ? bpms[0] : null;
    const completeness = songCompleteness({
      title: song.title,
      artist: song.metadata.artist,
      key: song.metadata.key,
      tempo: song.metadata.tempo ?? derivedTempo,
      tags: (song.themes || []).map((t) => `theme:${t}`).join(", "),
      year: song.metadata.year,
    });
    return {
      songId: song.songId,
      title: song.title,
      slug,
      source: song.source,
      key: song.metadata.key,
      artist: song.metadata.artist,
      year: song.metadata.year,
      tempo: song.metadata.tempo ?? derivedTempo,
      tempoDerived: song.metadata.tempo == null && derivedTempo != null,
      band: tempoBand(song.metadata.tempo ?? derivedTempo),
      themes: song.themes || [],
      chords: song.chords,
      isDraft: song.metadata.isDraft,
      confidence: song.confidence?.band ?? null,
      mediaCount: mediaFiles.length,
      lines: song.lines,
      percent: completeness.percent,
      missing: completeness.missing,
      hasEssentials: completeness.hasEssentials,
    };
  });

  const themeCounts = {};
  for (const t of themeLexicon.themes) themeCounts[t.id] = 0;
  for (const r of rows) for (const t of r.themes) themeCounts[t] = (themeCounts[t] || 0) + 1;

  const dupes = {};
  for (const r of rows) {
    const k = titleKey(r.title);
    if (!dupes[k]) dupes[k] = [];
    dupes[k].push(r.title);
  }

  const band = (p) => (p >= 90 ? "90-100" : p >= 70 ? "70-89" : p >= 50 ? "50-69" : p >= 30 ? "30-49" : "0-29");

  return {
    totals: {
      songs: rows.length,
      withChords: rows.filter((r) => r.chords).length,
      lyricsOnly: rows.filter((r) => !r.chords).length,
      drafts: rows.filter((r) => r.isDraft).length,
      themed: rows.filter((r) => r.themes.length > 0).length,
      labels: rows.reduce((a, r) => a + r.themes.length, 0),
      withMedia: rows.filter((r) => r.mediaCount > 0).length,
      mediaFiles: media.files,
      mediaBytes: media.bytes,
      duplicateTitles: Object.values(dupes).filter((v) => v.length > 1).length,
    },
    bySource: tally(rows, (r) => r.source),
    fields: {
      title: rows.length,
      key: rows.filter((r) => r.key).length,
      artist: rows.filter((r) => r.artist).length,
      tempo: rows.filter((r) => r.tempo).length,
      tempoDerived: rows.filter((r) => r.tempoDerived).length,
      themes: rows.filter((r) => r.themes.length).length,
      year: rows.filter((r) => r.year).length,
    },
    completeness: tally(rows, (r) => band(r.percent)),
    missingCounts: (() => {
      const out = {};
      for (const r of rows) for (const m of r.missing) out[m] = (out[m] || 0) + 1;
      return out;
    })(),
    tempoBands: tally(rows.filter((r) => r.band), (r) => r.band),
    themes: themeCounts,
    confidence: tally(rows, (r) => r.confidence),
    rows,
  };
}

function bar(n, max, width = 28) {
  if (!max) return "";
  return "█".repeat(Math.max(n > 0 ? 1 : 0, Math.round((n / max) * width)));
}

export function formatStatsText(stats) {
  const t = stats.totals;
  const L = [];
  const pct = (n) => `${((n / t.songs) * 100).toFixed(0)}%`.padStart(4);

  L.push("VPC Music — Library Statistics");
  L.push("==============================");
  L.push("");
  L.push(`Songs ${t.songs}   with chords ${t.withChords} (${pct(t.withChords).trim()})   lyrics only ${t.lyricsOnly}   drafts ${t.drafts}`);
  L.push(`Themed ${t.themed} songs carrying ${t.labels} labels`);
  L.push(`Media ${t.mediaFiles} files (${(t.mediaBytes / 1073741824).toFixed(1)} GB) attached to ${t.withMedia} songs`);
  L.push(`Duplicate titles: ${t.duplicateTitles}`);
  L.push("");

  L.push("Source                 songs");
  for (const [k, v] of Object.entries(stats.bySource).sort((a, b) => b[1] - a[1])) {
    L.push(`  ${k.padEnd(20)} ${String(v).padStart(5)}`);
  }
  L.push("");

  L.push("Field coverage          have   missing");
  const order = ["title", "key", "artist", "tempo", "themes", "year"];
  for (const f of order) {
    const have = stats.fields[f] || 0;
    L.push(`  ${f.padEnd(20)} ${String(have).padStart(5)}   ${String(t.songs - have).padStart(5)}  ${bar(have, t.songs)}`);
  }
  if (stats.fields.tempoDerived) L.push(`  (${stats.fields.tempoDerived} tempos derived from media filenames)`);
  L.push("");

  L.push("Completeness            songs");
  for (const k of ["90-100", "70-89", "50-69", "30-49", "0-29"]) {
    const v = stats.completeness[k] || 0;
    L.push(`  ${(k + "%").padEnd(20)} ${String(v).padStart(5)}  ${bar(v, t.songs)}`);
  }
  L.push("");

  L.push("Tempo band              songs");
  for (const [k, v] of Object.entries(stats.tempoBands).sort((a, b) => b[1] - a[1])) {
    L.push(`  ${k.padEnd(20)} ${String(v).padStart(5)}`);
  }
  L.push("");

  const themeMax = Math.max(...Object.values(stats.themes), 1);
  L.push("Theme                   songs");
  for (const [k, v] of Object.entries(stats.themes).sort((a, b) => b[1] - a[1])) {
    L.push(`  ${k.padEnd(20)} ${String(v).padStart(5)}  ${bar(v, themeMax, 22)}`);
  }
  L.push("");

  L.push("Conversion confidence   songs");
  for (const [k, v] of Object.entries(stats.confidence).sort((a, b) => b[1] - a[1])) {
    L.push(`  ${k.padEnd(20)} ${String(v).padStart(5)}`);
  }
  return `${L.join("\n")}\n`;
}

async function runCli() {
  const argv = process.argv.slice(2);
  const arg = (f, d) => { const i = argv.indexOf(f); return i === -1 ? d : argv[i + 1]; };
  const corpusRoot = resolve(process.cwd(), arg("--corpus", join(repoRoot, "corpus")));

  const songs = await collectSongs(corpusRoot);
  const media = await collectMedia(corpusRoot);
  const stats = buildStats({ songs, media, themeLexicon: loadThemes() });

  process.stdout.write(formatStatsText(stats));

  const jsonPath = resolve(process.cwd(), arg("--json", join(corpusRoot, "stats.json")));
  await mkdir(dirname(jsonPath), { recursive: true });
  // Committed, so the library's state is diffable over time. Rows included so
  // a dashboard can be built from it without re-reading 752 files.
  await writeFile(jsonPath, `${JSON.stringify(stats, null, 2)}\n`, "utf8");
  console.log(`\nJSON: ${jsonPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
