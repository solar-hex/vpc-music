/**
 * Charts an independent source agrees with.
 *
 * Every UPCI song ships a number chart: the same document with the chords
 * written as Nashville numbers. Converting our extracted chord chart to
 * Nashville and comparing it with the publisher's own numbers is a check we
 * did not author — the publisher disagreeing with us, rather than us marking
 * our own homework.
 *
 * A chart that clears the bar has no business sitting in the library as an
 * unreviewed draft. 181 of 250 do.
 *
 * The ledger is written by `pnpm corpus:verify --nashville --write`, committed,
 * and read here by the build. It is keyed by song id so it survives on a
 * machine with no legacy tree, and so a diff shows which songs changed status.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = resolve(__dirname, "../../../../corpus/verified.json");

/**
 * @param {string} [path]
 * @returns {Map<string, {title:string, coverage:number, agreement:number, ours:number, theirs:number}>}
 */
export function loadVerified(path = DEFAULT_PATH) {
  const file = existsSync(path) ? path : join(process.cwd(), "corpus", "verified.json");
  if (!existsSync(file)) return new Map();
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  return new Map(Object.entries(parsed.songs || {}));
}

/**
 * How a chart earned its way out of draft, in one line, written into the file
 * so the reason travels with the song rather than living in a report.
 */
export function verifiedNote(entry) {
  if (!entry) return null;
  const pct = Math.round((entry.coverage ?? 0) * 100);
  return `number chart, ${pct}% of ${entry.theirs} chords`;
}
