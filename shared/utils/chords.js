/**
 * chords — the consolidated public API for chord + chart transposition.
 *
 * This is a thin FACADE over the primitives in ./transpose.js (chord/key math)
 * and the line-preserving chart AST in ./chart.js. It adds no music theory of
 * its own — every rule (chord grammar, section-token guarding, target-key
 * enharmonic spelling, bar-line handling) lives in those modules and is reused
 * here, so there is a single source of truth. What this layer adds is ergonomics:
 *
 *   parseChord / transposeChord          — chord level (transposeChord accepts a
 *                                          string OR a parsed-chord object)
 *   interval / preferFlats               — key math
 *   parseChart / transposeChart / toText — chart level: parseChart also returns a
 *                                          `directives` map; transposeChart rewrites
 *                                          the {key: ...} directive so a rendered
 *                                          chart's key label isn't stale; toText
 *                                          renders back to text, dropping comments.
 *
 * Exported NAMESPACED from @vpc-music/shared as `chords` (see index.js) so its
 * parseChart/transposeChart/transposeChord/interval don't clash with the
 * primitives' own exports of those names.
 */
import {
  interval,
  keyPrefersFlats,
  isChordToken,
  transposeChord as transposeChordString,
  transposeKeyName,
} from "./transpose.js";
import {
  parseChart as parseChartBase,
  transposeChart as transposeChartBase,
} from "./chart.js";

export { interval };

/** Does this key conventionally use flats? ("Bb", "Dm", "Gb" → true) */
export const preferFlats = keyPrefersFlats;

/**
 * Parse a chord name into { root, quality, bass, raw }.
 * Returns null when the text is not a chord (e.g. a section label).
 */
export function parseChord(chord) {
  const raw = String(chord).trim();
  if (!isChordToken(raw)) return null;
  const [main, bass] = raw.includes("/") ? raw.split("/") : [raw, undefined];
  const match = main.match(/^([A-G][b#]?)(.*)$/);
  return { root: match[1], quality: match[2] || "", bass, raw };
}

/**
 * Transpose a chord by `steps` semitones. Accepts a chord string or a parsed
 * chord object (from parseChord). `flats` spells the result for the target key.
 */
export function transposeChord(chord, steps, flats) {
  const raw = chord && typeof chord === "object" ? chord.raw : String(chord);
  return transposeChordString(raw, steps, flats);
}

function directivesOf(lines) {
  const directives = {};
  for (const line of lines) {
    if (line.type === "directive") directives[line.key] = line.value;
  }
  return directives;
}

/**
 * Parse ChordPro-lite text into the line-preserving AST plus a `directives`
 * map (e.g. { title, key }). Line shape is exactly chart.js's parseChart.
 */
export function parseChart(text) {
  const chart = parseChartBase(text);
  return { ...chart, directives: directivesOf(chart.lines) };
}

/** Render a chart AST back to text, dropping comment lines. */
export function toText(chart) {
  return chart.lines
    .filter((line) => line.type !== "comment")
    .map((line) => line.raw)
    .join("\n");
}

/**
 * Transpose a chart AST. A net-zero shift returns the same object. The
 * {key: ...} directive is rewritten so the rendered chart's key label tracks
 * the transposed chords instead of reading stale.
 */
export function transposeChart(chart, steps, flats) {
  if (((steps % 12) + 12) % 12 === 0) return chart;
  const base = transposeChartBase(chart, steps, flats);
  const lines = base.lines.map((line) => {
    if (line.type !== "directive" || line.key !== "key" || !line.value) return line;
    const value = transposeKeyName(line.value, steps, flats);
    return { ...line, value, raw: line.raw.replace(/(\{key:\s*).*(\})/i, `$1${value}$2`) };
  });
  return { lines, directives: directivesOf(lines) };
}
