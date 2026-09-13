/**
 * gap:report — what the church wants that the library does not have.
 *
 * Two lists exist outside this repo:
 *
 *   TargetedSongList.xlsx   467 curated titles with a status column — the ask
 *   FullSongList.xlsx     8,578 titles with the website each came from — the index
 *
 * Both are read straight out of the .xlsx (no "Save As → CSV" step) and
 * committed to `corpus/lists/` as NDJSON, so every later run is reproducible
 * from files in git even on a machine with no Dropbox folder.
 *
 * The report is READ-ONLY. It never writes a song, and the master index is
 * deliberately NOT loaded into the database — 8,578 ghost rows would bury a
 * 1,058-song library and break every count on the library page.
 *
 *   pnpm gap:report [--targeted <xlsx>] [--master <xlsx>] [--limit <n>] [--json <file>]
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readXlsxRows, rowsToRecords } from "../apps/api/src/corpus/xlsxSheet.js";
import { matchTitles, titleKey } from "../apps/api/src/corpus/titleMatch.js";
import { approvedBySong, loadAliases } from "../apps/api/src/corpus/aliases.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, "..");

/* ─── the committed ledgers ───────────────────────────────────────────────── */

export async function readNdjson(path) {
  if (!existsSync(path)) return [];
  const text = await readFile(path, "utf8");
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function writeNdjson(path, records) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, records.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
}

/** A repeated header partway down a sheet is a row, not a song. */
const HEADER_ROW = /^(song|songs|title|titles)$/i;

/**
 * The curated ask: one row per title, with the status the church gave it.
 * Sheet 2 — sheet 1 is the status legend and a TODO column.
 *
 * The Status column holds two different things and has to be split: a word
 * (Test / Done / Later) is a state, but ~340 rows hold a NUMBER 5-50 instead,
 * which is a work batch. Reading both as "status" produced a report whose
 * biggest category was "status 48", which says nothing.
 */
export async function importTargeted(xlsxPath) {
  const rows = await readXlsxRows(await readFile(xlsxPath), { sheet: 2 });
  const records = rowsToRecords(rows);
  const out = [];
  const seen = new Set();
  for (const [index, record] of records.entries()) {
    const title = String(record.song || "").trim();
    if (!title || HEADER_ROW.test(title)) continue;
    const key = titleKey(title);
    if (seen.has(key)) continue;
    seen.add(key);
    const status = String(record.status || "").trim();
    const numeric = /^\d+$/.test(status);
    out.push({
      title,
      status: numeric ? null : status || null,
      batch: numeric ? Number(status) : null,
      // Observed values are credits — "Joel Hemphill", "Howard Seratt".
      metadata: String(record.metadata || "").trim() || null,
      tags: String(record.tags || "").trim() || null,
      // An unnamed fifth column carries a chord-sheet link on a few rows.
      url: String(rows[index + 1]?.[4] || "").trim() || null,
    });
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * The sourcing index: every title anyone catalogued, and where it came from.
 *
 * Column B is a URL on 7,597 rows and a note on ~980 ("other locations",
 * "lyrics", "marked"). A note is not a site — treating it as one invented
 * source websites called "lyrics" — so the two are kept apart.
 */
export async function importMaster(xlsxPath) {
  const rows = await readXlsxRows(await readFile(xlsxPath), { sheet: 1 });
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const title = String(row[0] || "").trim();
    if (!title || HEADER_ROW.test(title)) continue;
    const key = titleKey(title);
    if (seen.has(key)) continue;
    seen.add(key);
    const second = String(row[1] || "").trim();
    const isUrl = /^https?:\/\//i.test(second);
    out.push({ title, source: isUrl ? second : null, note: isUrl ? null : second || null });
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

/* ─── what we have ────────────────────────────────────────────────────────── */

/**
 * Every live song in the corpus — superseded copies are not "have".
 *
 * Each song's approved aliases come along, or the report keeps asking for a
 * song it has: resolving "I See A Crimson Stream Of Blood" is only worth doing
 * if the next run stops reporting it.
 */
export async function collectHave(corpusRoot) {
  const manifestDir = join(corpusRoot, "manifest");
  const aliases = approvedBySong(loadAliases(join(corpusRoot, "aliases.json")));
  const have = [];
  for (const file of (await readdir(manifestDir)).sort()) {
    if (!file.endsWith(".json")) continue;
    const manifest = JSON.parse(await readFile(join(manifestDir, file), "utf8"));
    for (const song of manifest.songs) {
      if (song.decision === "superseded") continue;
      have.push({
        id: song.songId,
        title: song.title,
        aka: aliases.get(song.songId) ?? [],
        source: manifest.sourceType,
        artist: song.metadata?.artist || null,
      });
    }
  }
  return have;
}

/* ─── the report ──────────────────────────────────────────────────────────── */

/** `https://wordtoworship.com/songs` → `wordtoworship.com`; anything else is not a site. */
export function siteOf(url) {
  const m = String(url || "").trim().match(/^https?:\/\/(?:www\.)?([^/]+)/i);
  return m ? m[1].toLowerCase() : null;
}

export function buildGapReport({ have, targeted, master }) {
  const masterByKey = new Map(master.map((row) => [titleKey(row.title), row]));

  const wanted = targeted.map((row) => row.title);
  const { matched, probable, missing } = matchTitles(wanted, have);
  const statusOf = new Map(targeted.map((row) => [titleKey(row.title), row.status]));

  const targetedByKey = new Map(targeted.map((row) => [titleKey(row.title), row]));
  const missingRows = missing.map((entry) => {
    const key = titleKey(entry.title);
    const index = masterByKey.get(key) || null;
    const ask = targetedByKey.get(key) || null;
    // A link on the targeted row beats the index: someone already found it.
    const sourceUrl = ask?.url || index?.source || null;
    return {
      title: entry.title,
      status: statusOf.get(key) || null,
      batch: ask?.batch ?? null,
      credit: ask?.metadata || null,
      site: siteOf(sourceUrl),
      sourceUrl,
      indexNote: index?.note || null,
      nearest: entry.best ? { title: entry.best.song.title, score: Math.round(entry.best.score * 100) / 100 } : null,
    };
  });

  const probableRows = probable.map((entry) => ({
    title: entry.title,
    status: statusOf.get(titleKey(entry.title)) || null,
    // A human resolves these once by writing the wanted title into `songs.aka`.
    candidate: entry.song.title,
    candidateId: entry.song.id,
    score: Math.round(entry.score * 100) / 100,
  }));

  const tally = (rows, key) => {
    const out = {};
    for (const row of rows) {
      const k = key(row) ?? "unknown";
      out[k] = (out[k] || 0) + 1;
    }
    return out;
  };

  // Songs the church has that no external list knows about. No website will
  // ever supply their artist, so they are the manual-enrichment priority.
  const targetedKeys = new Set(targeted.map((r) => titleKey(r.title)));
  const ours = have.filter((song) => {
    const key = titleKey(song.title);
    return !masterByKey.has(key) && !targetedKeys.has(key);
  });

  // Intra-library duplicates: the same title carried by more than one song.
  const byTitle = new Map();
  for (const song of have) {
    const key = titleKey(song.title);
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key).push(song);
  }
  const duplicates = [...byTitle.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({ title: group[0].title, count: group.length, sources: [...new Set(group.map((s) => s.source))] }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));

  return {
    totals: {
      targeted: targeted.length,
      have: matched.length,
      probable: probable.length,
      missing: missing.length,
      library: have.length,
      masterIndex: master.length,
      sourceable: missingRows.filter((r) => r.site).length,
      ours: ours.length,
      duplicateTitles: duplicates.length,
    },
    byStatus: tally(missingRows, (r) => r.status || "(no status)"),
    byBatch: tally(missingRows.filter((r) => r.batch !== null), (r) => r.batch),
    bySite: tally(missingRows.filter((r) => r.site), (r) => r.site),
    byIndexNote: tally(missingRows.filter((r) => !r.site && r.indexNote), (r) => r.indexNote),
    missing: missingRows.sort((a, b) => a.title.localeCompare(b.title)),
    probable: probableRows.sort((a, b) => b.score - a.score),
    ours: ours.map((s) => ({ title: s.title, source: s.source, artist: s.artist })).sort((a, b) => a.title.localeCompare(b.title)),
    duplicates,
  };
}

export function formatGapReport(report, { limit = 25 } = {}) {
  const t = report.totals;
  const L = [];
  L.push("VPC Music — Gap Report");
  L.push("======================");
  L.push("");
  L.push(`Targeted list: ${t.targeted} songs · have ${t.have} · probable ${t.probable} · MISSING ${t.missing}`);
  L.push(`Library: ${t.library} live songs · master index: ${t.masterIndex} titles`);
  L.push("");

  L.push("Missing, by the status the church gave it");
  for (const [status, count] of Object.entries(report.byStatus).sort((a, b) => b[1] - a[1])) {
    const note = /^done$/i.test(status) ? "   ← marked done but not in the library" : "";
    L.push(`  ${String(status).padEnd(16)} ${String(count).padStart(4)}${note}`);
  }
  const batches = Object.keys(report.byBatch).length;
  if (batches > 0) {
    const numbers = Object.keys(report.byBatch).map(Number).sort((a, b) => a - b);
    L.push(`  (${batches} work batches carry a missing song: ${numbers.join(", ")})`);
  }
  L.push("");

  L.push(`Missing, by where it can be sourced (${t.sourceable} of ${t.missing} have a link)`);
  for (const [site, count] of Object.entries(report.bySite).sort((a, b) => b[1] - a[1])) {
    L.push(`  ${site.padEnd(40)} ${String(count).padStart(4)}`);
  }
  for (const [note, count] of Object.entries(report.byIndexNote).sort((a, b) => b[1] - a[1])) {
    L.push(`  ${`(indexed only as "${note}")`.padEnd(40)} ${String(count).padStart(4)}`);
  }
  const unindexed = t.missing - t.sourceable - Object.values(report.byIndexNote).reduce((a, b) => a + b, 0);
  if (unindexed > 0) L.push(`  ${"(in no index — ask the church)".padEnd(40)} ${String(unindexed).padStart(4)}`);
  L.push("");

  if (report.missing.length > 0) {
    L.push("The worklist, one site at a time");
    const bySite = new Map();
    for (const row of report.missing) {
      const site = row.site || (row.indexNote ? `indexed as "${row.indexNote}"` : "no known source");
      if (!bySite.has(site)) bySite.set(site, []);
      bySite.get(site).push(row);
    }
    for (const [site, rows] of [...bySite.entries()].sort((a, b) => b[1].length - a[1].length)) {
      L.push(`  ${site}  (${rows.length})`);
      for (const row of rows.slice(0, limit)) {
        L.push(`    ${row.title}${row.credit ? `  — ${row.credit}` : ""}`);
      }
      if (rows.length > limit) L.push(`    … ${rows.length - limit} more`);
    }
    L.push("");
  }

  if (report.probable.length > 0) {
    L.push("Probably already here under another name — resolve once by setting `aka`");
    for (const row of report.probable.slice(0, limit)) {
      L.push(`  ${String(Math.round(row.score * 100) + "%").padStart(4)}  ${row.title}`);
      L.push(`        ↳ ${row.candidate}`);
    }
    if (report.probable.length > limit) L.push(`  … ${report.probable.length - limit} more`);
    L.push("");
  }

  L.push(`Ours alone: ${t.ours} songs in neither list`);
  L.push("  No website will supply their artist — they are the manual-enrichment priority.");
  for (const row of report.ours.slice(0, limit)) {
    L.push(`  ${row.artist ? "✓" : " "} ${row.title}`);
  }
  if (report.ours.length > limit) L.push(`  … ${report.ours.length - limit} more`);
  L.push("");

  L.push(`Duplicate titles inside the library: ${t.duplicateTitles}`);
  for (const row of report.duplicates.slice(0, 10)) {
    L.push(`  ${String(row.count)}×  ${row.title}  (${row.sources.join(", ")})`);
  }
  if (report.duplicates.length > 10) L.push(`  … ${report.duplicates.length - 10} more`);
  return `${L.join("\n")}\n`;
}

/* ─── cli ─────────────────────────────────────────────────────────────────── */

async function runCli() {
  const argv = process.argv.slice(2);
  const arg = (flag, fallback) => {
    const i = argv.indexOf(flag);
    return i === -1 ? fallback : argv[i + 1];
  };
  const corpusRoot = resolve(process.cwd(), arg("--corpus", join(repoRoot, "corpus")));
  const listsDir = join(corpusRoot, "lists");
  const targetedPath = join(listsDir, "targeted.ndjson");
  const masterPath = join(listsDir, "master.ndjson");

  // Importing refreshes the committed ledger; every later run reads the ledger.
  const targetedXlsx = arg("--targeted", null);
  if (targetedXlsx) {
    const rows = await importTargeted(resolve(process.cwd(), targetedXlsx));
    await writeNdjson(targetedPath, rows);
    console.log(`Imported ${rows.length} targeted titles → ${targetedPath}`);
  }
  const masterXlsx = arg("--master", null);
  if (masterXlsx) {
    const rows = await importMaster(resolve(process.cwd(), masterXlsx));
    await writeNdjson(masterPath, rows);
    console.log(`Imported ${rows.length} index titles → ${masterPath}`);
  }
  if (targetedXlsx || masterXlsx) console.log("");

  const targeted = await readNdjson(targetedPath);
  if (targeted.length === 0) {
    throw new Error(
      `No targeted list at ${targetedPath}. Import one first:\n` +
        `  pnpm gap:report --targeted "<path>/TargetedSongList.xlsx" --master "<path>/FullSongList.xlsx"`,
    );
  }
  const master = await readNdjson(masterPath);
  const have = await collectHave(corpusRoot);

  const report = buildGapReport({ have, targeted, master });
  process.stdout.write(formatGapReport(report, { limit: Number(arg("--limit", 25)) }));

  const jsonPath = resolve(process.cwd(), arg("--json", join(corpusRoot, "gaps.json")));
  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`\nJSON: ${jsonPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
