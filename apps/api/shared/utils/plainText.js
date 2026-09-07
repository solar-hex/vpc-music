import { parseChordPro } from "./chordpro.js";
import { isSecondaryToken } from "./transpose.js";

/** Chord names padded to their lyric columns; secondary tokens lose their "*" marker. */
function buildChordLine(chords) {
  const sorted = [...chords].sort((a, b) => a.position - b.position);
  let result = "";
  let cursor = 0;

  for (const { chord, position } of sorted) {
    const label = isSecondaryToken(chord) ? chord.slice(1) : chord;
    if (position > cursor) {
      result += " ".repeat(position - cursor);
      cursor = position;
    }
    result += label;
    cursor += label.length;
  }

  return result.replace(/\s+$/, "");
}

/**
 * Convert ChordPro source to plain text.
 * - Default: chords-over-lyrics (a secondary-chord row above the primary row
 *   when the line carries `[*x]` annotation tokens; `{ci}` notes as "* note")
 * - lyricsOnly: strips chord rows and notes entirely
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
      if (line.note !== undefined) {
        if (!lyricsOnly) parts.push(`* ${line.note}`);
        continue;
      }

      if (!lyricsOnly && line.chords.length > 0) {
        const secondaryLine = buildChordLine(line.chords.filter((entry) => isSecondaryToken(entry.chord)));
        if (secondaryLine) parts.push(secondaryLine);
        const chordLine = buildChordLine(line.chords.filter((entry) => !isSecondaryToken(entry.chord)));
        if (chordLine) parts.push(chordLine);
      }
      parts.push(line.lyrics || "");
    }

    parts.push("");
  }

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
