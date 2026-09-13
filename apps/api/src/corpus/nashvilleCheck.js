/**
 * The second oracle: every UPCI song ships a number chart.
 *
 * A number chart is the same document as its chord chart, with the chords
 * written as Nashville numbers. The app already derives Nashville from any
 * keyed chart, so converting our extracted chord chart and comparing it with
 * the number chart the publisher wrote is a completely independent check on
 * whether we read the chords correctly — and it covers ~267 songs rather than
 * the 20 that happen to have a plain-text twin.
 *
 * It also cross-checks the KEY, because the two only agree if the key we read
 * is the key the chart is actually in.
 */
import { nashvilleChordPro } from "@vpc-music/shared";
import { assembleLines, detectColumns } from "../features/songs/pdfToChordPro.js";
import { coalesceRuns } from "./pdfSong.js";
import { extractPdfElements } from "./pdfTextLocal.js";

/**
 * `1`, `4`, `6m`, `b7`, `5/7`, `2m7` — the notation these charts use.
 *
 * At most two digits of extension. Real extensions are 7, 9, 11 and 13; an
 * unbounded `[0-9]*` also matched "2026", so a bare year printed on its own
 * line read as a chord and joined the publisher's sequence.
 */
export const NASHVILLE_TOKEN = /^[b#]?[1-7](?:m|maj|min|dim|aug|sus[24]?|add)?[0-9]{0,2}(?:\/[b#]?[1-7])?$/;

export function isNashvilleToken(token) {
  return NASHVILLE_TOKEN.test(String(token).trim());
}

/** The ordered number tokens in a number-chart PDF. */
export async function numberSequenceFromPdf(buffer) {
  const elements = await extractPdfElements(buffer);
  if (elements.length < 15) return null; // engraved notation, nothing to read
  const out = [];
  for (const line of assembleLines(detectColumns(elements))) {
    const tokens = coalesceRuns(line.elements).map((t) => t.text.trim()).filter(Boolean);
    if (tokens.length === 0) continue;
    // Only a line that is ENTIRELY numbers is a chord line; a lyric containing
    // "1." or a year would otherwise leak in.
    if (!tokens.every(isNashvilleToken)) continue;
    out.push(...tokens);
  }
  return out;
}

/** The ordered number tokens our own chord chart implies, in the given key. */
export function numberSequenceFromChordPro(content, key) {
  if (!key) return null;
  const converted = nashvilleChordPro(String(content), key);
  const out = [];
  for (const m of converted.matchAll(/\[([^\]]+)\]/g)) {
    const token = m[1].trim();
    if (isNashvilleToken(token)) out.push(token);
  }
  return out;
}

/**
 * How much of the shorter sequence appears, in order, in the longer one —
 * plus the raw counts, because a high score over a tiny sequence is not
 * agreement, it is a sample of one.
 */
export function compareSequences(ours, theirs) {
  const a = ours ?? [];
  const b = theirs ?? [];
  if (a.length === 0 || b.length === 0) {
    return { score: 0, common: 0, ours: a.length, theirs: b.length, coverage: 0 };
  }
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const common = dp[a.length][b.length];
  return {
    common,
    ours: a.length,
    theirs: b.length,
    score: common / Math.min(a.length, b.length),
    // How much of what the publisher wrote we actually found.
    coverage: common / b.length,
  };
}
