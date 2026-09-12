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
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { convertPdfChartToChordPro } from "../apps/api/src/corpus/pdfSong.js";
import { convertTextChartToChordPro } from "../apps/api/src/corpus/textChart.js";
import { titleKey } from "../apps/api/src/corpus/titleMatch.js";

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

async function runCli() {
  const argv = process.argv.slice(2);
  const arg = (f, d) => { const i = argv.indexOf(f); return i === -1 ? d : argv[i + 1]; };
  const tree = resolve(
    process.cwd(),
    arg("--tree", "C:/Projects/Misc/ChurchMusic/exclude/Shared Dropbox/UPCI Song Parts TG"),
  );
  if (!existsSync(tree)) throw new Error(`Tree does not exist: ${tree}`);

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
