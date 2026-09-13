/**
 * corpus:verify — check converted charts against an independent source.
 *
 * Two free oracles exist in this corpus, and both cost nothing to run:
 *
 *  1. 22 songs carry BOTH a plain-text chord chart and a PDF one, authored by
 *     the same person. The text version needs no geometry, so it is ground
 *     truth for the PDF pipeline's chord reading.
 *  2. Every UPCI song has a number chart — the same document with the chords
 *     written as Nashville numbers. Converting our chord chart to Nashville
 *     and comparing is a second, independent check.
 *
 *   pnpm corpus:verify [--tree <path>] [--limit <n>]
 */
import { existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { convertPdfChartToChordPro } from "../apps/api/src/corpus/pdfSong.js";
import { convertTextChartToChordPro } from "../apps/api/src/corpus/textChart.js";
import { titleKey } from "../apps/api/src/corpus/titleMatch.js";
import { deterministicSongId, normalizeRelativePath } from "../apps/api/src/corpus/identity.js";
import {
  compareSequences,
  numberSequenceFromChordPro,
  numberSequenceFromPdf,
} from "../apps/api/src/corpus/nashvilleCheck.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, "..");

/** The ordered chord tokens in a chart — layout-independent. */
export function chordSequence(chordPro) {
  const out = [];
  for (const m of String(chordPro).matchAll(/\[([^\]]+)\]/g)) {
    const token = m[1].trim();
    if (/^[A-G]/.test(token)) out.push(token);
  }
  return out;
}

/**
 * How much of the shorter sequence appears, in order, in the longer one.
 * Longest common subsequence over the two token lists.
 */
export function sequenceAgreement(a, b) {
  if (a.length === 0 || b.length === 0) return { score: 0, common: 0, a: a.length, b: b.length };
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const common = dp[a.length][b.length];
  return { score: common / Math.min(a.length, b.length), common, a: a.length, b: b.length };
}

async function findPairs(tree) {
  const texts = [];
  const pdfs = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.txt$/i.test(entry.name)) texts.push(p);
      else if (/chord.?chart.*\.pdf$/i.test(entry.name)) pdfs.push(p);
    }
  })(tree);
  return { texts, pdfs };
}

/**
 * The bar a chart must clear to stop being a draft.
 *
 * Coverage is how much of what the publisher wrote we found. At 0.8 the chart
 * we extracted contains at least four fifths of the chords on the publisher's
 * own number chart, in the right order — which is a stronger check than a
 * person glancing at it, and it is the publisher disagreeing with us, not us
 * marking our own homework.
 */
export const VERIFIED_COVERAGE = 0.8;

async function runNashville(tree, limit, { write = false, corpusRoot = null } = {}) {
  const pairs = new Map();
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) { walk(p); continue; }
      const folder = dirname(p);
      if (!pairs.has(folder)) pairs.set(folder, {});
      if (/chord.?chart.*\.pdf$/i.test(entry.name)) pairs.get(folder).chord = p;
      else if (/number.?s?.?chart.*\.pdf$/i.test(entry.name)) pairs.get(folder).number = p;
    }
  })(tree);

  const both = [...pairs.values()].filter((v) => v.chord && v.number).slice(0, limit ?? Infinity);
  console.log(`Chord/number chart pairs: ${both.length}
`);

  const rows = [];
  for (const pair of both) {
    try {
      const chart = await convertPdfChartToChordPro(pair.chord, await readFile(pair.chord));
      const theirs = await numberSequenceFromPdf(await readFile(pair.number));
      if (!theirs || theirs.length === 0) { rows.push({ title: chart.title, skip: "number chart has no text" }); continue; }
      if (!chart.metadata.key) { rows.push({ title: chart.title, skip: "no key read from the chord chart" }); continue; }
      const ours = numberSequenceFromChordPro(chart.chordProContent, chart.metadata.key);
      const relativePath = normalizeRelativePath(relative(tree, pair.chord));
      rows.push({
        title: chart.title,
        key: chart.metadata.key,
        songId: deterministicSongId(relativePath),
        path: relativePath,
        ...compareSequences(ours, theirs),
      });
    } catch (error) {
      rows.push({ title: basename(pair.chord), skip: error.message });
    }
  }

  const scored = rows.filter((r) => !r.skip);
  scored.sort((a, b) => a.coverage - b.coverage);

  console.log("coverage  agree   ours/theirs  key   song");
  for (const r of scored.slice(0, 25)) {
    console.log(
      `   ${String(Math.round(r.coverage * 100) + "%").padStart(4)}   ${String(Math.round(r.score * 100) + "%").padStart(4)}   ` +
      `${String(r.ours).padStart(4)}/${String(r.theirs).padEnd(4)}  ${String(r.key ?? "-").padEnd(4)}  ${r.title}`,
    );
  }
  if (scored.length > 25) console.log(`   … ${scored.length - 25} more, all at or above ${Math.round(scored[25].coverage * 100)}%`);

  const good = scored.filter((r) => r.coverage >= 0.8).length;
  const meanCoverage = scored.length ? scored.reduce((s, r) => s + r.coverage, 0) / scored.length : 0;
  const skipped = rows.filter((r) => r.skip);
  console.log("");
  console.log(`${good}/${scored.length} reach 80% coverage · mean coverage ${Math.round(meanCoverage * 100)}%`);
  if (skipped.length) {
    const why = {};
    for (const s of skipped) why[s.skip] = (why[s.skip] || 0) + 1;
    console.log(`skipped ${skipped.length}: ${Object.entries(why).map(([k, v]) => `${v} ${k}`).join(", ")}`);
  }
  console.log("");
  if (write) {
    /*
     * The ledger the build reads. A chart that agrees with the publisher's own
     * number chart is not a guess, so it should not sit in the library as an
     * unreviewed draft — this is what lets `corpus:build` say so.
     *
     * Committed and keyed by song id, so the decision is reviewable in a diff
     * and survives a machine with no legacy tree.
     */
    const verified = {};
    for (const r of scored) {
      if (r.coverage < VERIFIED_COVERAGE) continue;
      verified[r.songId] = {
        title: r.title,
        coverage: Math.round(r.coverage * 100) / 100,
        agreement: Math.round(r.score * 100) / 100,
        ours: r.ours,
        theirs: r.theirs,
        path: r.path,
      };
    }
    const out = {
      version: 1,
      method: "number-chart",
      threshold: VERIFIED_COVERAGE,
      note: "Each chart below was compared with the publisher's own Nashville number chart.",
      songs: Object.fromEntries(Object.entries(verified).sort(([a], [b]) => a.localeCompare(b))),
    };
    const file = join(corpusRoot ?? join(repoRoot, "corpus"), "verified.json");
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(out, null, 2)}
`, "utf8");
    console.log("");
    console.log(`Wrote ${Object.keys(verified).length} verified chart(s) to ${file}`);
    console.log("Re-run `pnpm corpus:build --source pdf` to take them out of draft.");
  }

  console.log("Coverage is how much of what the publisher wrote we found.");
  console.log("Low coverage means chords were missed; a low agreement with high");
  console.log("coverage would mean the key we read is wrong.");
}

async function runCli() {
  const argv = process.argv.slice(2);
  const arg = (f, d) => { const i = argv.indexOf(f); return i === -1 ? d : argv[i + 1]; };
  const tree = resolve(
    process.cwd(),
    arg("--tree", "C:/Projects/Misc/ChurchMusic/exclude/Shared Dropbox/UPCI Song Parts TG"),
  );
  if (!existsSync(tree)) throw new Error(`Tree does not exist: ${tree}`);

  if (argv.includes("--nashville")) {
    const limit = arg("--limit", null);
    await runNashville(tree, limit ? Number(limit) : null, {
      write: argv.includes("--write"),
      corpusRoot: arg("--corpus", null),
    });
    return;
  }

  const { texts, pdfs } = await findPairs(tree);
  // Pair them by the folder they sit in — same song, two formats.
  const byFolder = new Map();
  for (const p of pdfs) {
    const key = dirname(p);
    if (!byFolder.has(key)) byFolder.set(key, {});
    byFolder.get(key).pdf = p;
  }
  for (const t of texts) {
    const key = dirname(t);
    if (!byFolder.has(key)) continue;
    byFolder.get(key).text = t;
  }
  const pairs = [...byFolder.values()].filter((v) => v.pdf && v.text);

  console.log(`Text/PDF pairs found: ${pairs.length}\n`);
  let agreed = 0;
  const rows = [];
  for (const pair of pairs) {
    try {
      const textChart = convertTextChartToChordPro(pair.text, await readFile(pair.text));
      const pdfChart = await convertPdfChartToChordPro(pair.pdf, await readFile(pair.pdf));
      const cmp = sequenceAgreement(chordSequence(textChart.chordProContent), chordSequence(pdfChart.chordProContent));
      const titleMatch = titleKey(textChart.title) === titleKey(pdfChart.title);
      if (cmp.score >= 0.8) agreed += 1;
      rows.push({ title: textChart.title, ...cmp, titleMatch });
    } catch (error) {
      rows.push({ title: basename(pair.pdf), score: 0, common: 0, a: 0, b: 0, error: error.message });
    }
  }

  rows.sort((x, y) => x.score - y.score);
  console.log("agreement  chords(txt/pdf)  title  song");
  for (const r of rows) {
    const pct = `${Math.round(r.score * 100)}%`.padStart(5);
    console.log(`   ${pct}     ${String(r.a).padStart(3)}/${String(r.b).padEnd(3)}       ${r.titleMatch ? "ok " : "DIFF"}  ${r.title}${r.error ? "  — " + r.error : ""}`);
  }
  const mean = rows.length ? rows.reduce((s, r) => s + r.score, 0) / rows.length : 0;
  console.log(`\n${agreed}/${rows.length} agree at 80%+ · mean agreement ${Math.round(mean * 100)}%`);
  console.log("Disagreement means the PDF's geometry read chords the text chart does not have.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
