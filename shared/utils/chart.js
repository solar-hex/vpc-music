/**
 * Structured chart AST — a line-preserving parse of ChordPro-lite text.
 *
 * Unlike parseChordPro (which folds the text into renderable sections and
 * drops comments), parseChart keeps every source line with its raw text:
 * chartToText(parseChart(x)) === x, byte for byte, for any input.
 *
 * Transposition is defined as parse ∘ transposeChordPro ∘ serialize, so the
 * AST view and the flat string view can never disagree about what is a chord.
 */
import { isChordToken, isSectionToken, transposeChordPro } from "./transpose.js";

/**
 * Parse one bar row into measures of classified tokens. Pipes need no
 * padding ("|Em|C|" works) and a trailing pipe is optional.
 * @param {string} line — e.g. "| G | C/E D | x2 |"
 * @returns {{ measures: Array<Array<{type: "chord"|"text", value: string}>> } | null}
 *   null when the line is not a bar row (doesn't start with "|").
 */
export function parseBarLine(line) {
  const trimmed = String(line ?? "").trim();
  if (!trimmed.startsWith("|")) return null;
  const cells = trimmed.split("|").slice(1);
  if (trimmed.endsWith("|") && cells.length && cells[cells.length - 1].trim() === "") {
    cells.pop();
  }
  const measures = cells.map((cell) =>
    cell
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => ({
        type: isChordToken(token) ? "chord" : "text",
        value: token,
      })),
  );
  return { measures };
}

/** Split a lyric line into an ordered sequence of text and bracket-token parts. */
function parseLyricParts(raw) {
  const parts = [];
  const regex = /\[([^\]]+)\]/g;
  let last = 0;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    if (match.index > last) parts.push({ type: "text", text: raw.slice(last, match.index) });
    parts.push({ type: "token", value: match[1], isChord: isChordToken(match[1]) });
    last = regex.lastIndex;
  }
  if (last < raw.length) parts.push({ type: "text", text: raw.slice(last) });
  return parts;
}

/**
 * Parse ChordPro-lite text into a flat list of typed lines, each keeping its
 * raw source text. Line types:
 *   blank | comment ("# …") | directive ("{key: value}" or "{key}") |
 *   section ("[Chorus]" — vocabulary-checked, never a chord) |
 *   bars ("| G | C |") | lyric ("[G]Amazing grace")
 * @param {string} text
 * @returns {{ lines: Array<object> }}
 */
export function parseChart(text) {
  const lines = String(text ?? "")
    .split("\n")
    .map((raw) => {
      const trimmed = raw.trim();
      if (!trimmed) return { type: "blank", raw };
      if (trimmed.startsWith("#")) {
        return { type: "comment", text: trimmed.replace(/^#\s?/, ""), raw };
      }
      const directive = trimmed.match(/^\{(\w+)(?::\s*(.*?))?\}$/);
      if (directive) {
        return { type: "directive", key: directive[1].toLowerCase(), value: directive[2] ?? "", raw };
      }
      const bracket = trimmed.match(/^\[([^\]]+)\]$/);
      if (bracket && isSectionToken(bracket[1])) {
        return { type: "section", name: bracket[1], raw };
      }
      if (trimmed.startsWith("|")) {
        return { type: "bars", measures: parseBarLine(trimmed).measures, raw };
      }
      return { type: "lyric", parts: parseLyricParts(raw), raw };
    });
  return { lines };
}

/** Serialize a chart AST back to text — the byte-exact inverse of parseChart. */
export function chartToText(chart) {
  return chart.lines.map((line) => line.raw).join("\n");
}

/**
 * Transpose a chart AST. A net-zero shift returns the same object, so an
 * untransposed view is always the stored source verbatim.
 * @param {{ lines: Array<object> }} chart
 * @param {number} steps
 * @param {boolean} [preferFlats] — spell for the target key
 * @returns {{ lines: Array<object> }}
 */
export function transposeChart(chart, steps, preferFlats) {
  if (((steps % 12) + 12) % 12 === 0) return chart;
  return parseChart(transposeChordPro(chartToText(chart), steps, preferFlats));
}
