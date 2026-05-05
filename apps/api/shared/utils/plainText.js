import { parseChordPro } from "./chordpro.js";

function buildChordLine(line) {
  const sorted = [...line.chords].sort((a, b) => a.position - b.position);
  let result = "";
  let cursor = 0;

  for (const { chord, position } of sorted) {
    if (position > cursor) {
      result += " ".repeat(position - cursor);
      cursor = position;
    }
    result += chord;
    cursor += chord.length;
  }

  return result.replace(/\s+$/, "");
}

/**
 * Convert ChordPro source to plain text.
 * - Default: chords-over-lyrics
 * - lyricsOnly: strips chord lines entirely
 * @param {string} chordProSource
 * @param {{ lyricsOnly?: boolean }} [options]
 * @returns {string}
 */
export function chordProToPlainText(chordProSource, options = {}) {
  const { lyricsOnly = false } = options;
  const doc = parseChordPro(chordProSource);
  const parts = [];

  if (doc.directives.title) parts.push(doc.directives.title);
  if (doc.directives.artist) parts.push(`Artist: ${doc.directives.artist}`);
  if (doc.directives.key) parts.push(`Key: ${doc.directives.key}`);
  if (doc.directives.tempo) parts.push(`Tempo: ${doc.directives.tempo}`);
  if (parts.length > 0) parts.push("");

  for (const section of doc.sections) {
    if (section.name) {
      parts.push(section.name.toUpperCase());
    }

    for (const line of section.lines) {
      if (!lyricsOnly && line.chords.length > 0) {
        const chordLine = buildChordLine(line);
        if (chordLine) parts.push(chordLine);
      }
      parts.push(line.lyrics || "");
    }

    parts.push("");
  }

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}