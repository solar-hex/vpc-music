/**
 * ChordPro syntax highlighting tokenizer.
 *
 * Tokenizes a ChordPro source string line-by-line into typed spans
 * that can be rendered as colored overlays on top of a <textarea>.
 */

export type TokenType =
  | "chord"        // [G], [C#m7], [Bb/F]
  | "directive"    // {title: ...}, {key: ...}
  | "section"      // {comment: Verse 1}, {c: Chorus}
  | "lyrics"       // Plain lyric text
  | "invalid";     // Unclosed brackets, malformed

export interface Token {
  type: TokenType;
  text: string;
}

/** Known ChordPro directives (beyond comment/c which are section headers) */
const KNOWN_DIRECTIVES = new Set([
  "title", "t", "sorttitle", "subtitle", "st", "artist", "composer", "lyricist",
  "album", "year", "key", "tempo", "time", "capo", "duration", "copyright", "ccli",
  "comment", "c", "comment_italic", "ci", "comment_box", "cb",
  "start_of_chorus", "soc", "end_of_chorus", "eoc",
  "start_of_verse", "sov", "end_of_verse", "eov",
  "start_of_bridge", "sob", "end_of_bridge", "eob",
  "start_of_tab", "sot", "end_of_tab", "eot",
  "start_of_grid", "sog", "end_of_grid", "eog",
  "define", "chord",
  "columns", "col", "column_break", "colb",
  "new_page", "np", "new_physical_page", "npp",
  "textfont", "textsize", "textcolour",
  "chordfont", "chordsize", "chordcolour",
  "tabfont", "tabsize", "tabcolour",
  "meta",
]);

/** Section-header directive names (render with special emphasis) */
const SECTION_DIRECTIVES = new Set(["comment", "c", "comment_italic", "ci", "comment_box", "cb"]);

/**
 * Tokenize a single line of ChordPro source into highlighted spans.
 */
export function tokenizeLine(line: string): Token[] {
  const trimmed = line.trimStart();
  const leadingWhitespace = line.slice(0, line.length - line.trimStart().length);
  const tokens: Token[] = [];

  if (leadingWhitespace) {
    tokens.push({ type: "lyrics", text: leadingWhitespace });
  }

  // ── Directive line: {key: value} or {directive} ──
  const directiveMatch = trimmed.match(/^\{(\w+)(?::(.*))?(\})?\s*$/);
  if (directiveMatch && trimmed.startsWith("{")) {
    const name = directiveMatch[1];
    const hasClose = trimmed.endsWith("}");

    if (!hasClose) {
      // Unclosed brace
      tokens.push({ type: "invalid", text: trimmed });
      return tokens;
    }

    if (SECTION_DIRECTIVES.has(name)) {
      tokens.push({ type: "section", text: trimmed });
    } else if (KNOWN_DIRECTIVES.has(name)) {
      tokens.push({ type: "directive", text: trimmed });
    } else {
      // Unknown directive — still highlight it, but as directive
      tokens.push({ type: "directive", text: trimmed });
    }
    return tokens;
  }

  // ── Mixed lyrics + chords line ──
  // Scan character by character looking for [...] tokens
  let i = 0;
  let lyricsBuffer = "";

  while (i < trimmed.length) {
    if (trimmed[i] === "[") {
      // Flush lyrics buffer
      if (lyricsBuffer) {
        tokens.push({ type: "lyrics", text: lyricsBuffer });
        lyricsBuffer = "";
      }

      // Find matching ]
      const closeIdx = trimmed.indexOf("]", i + 1);
      if (closeIdx === -1) {
        // Unclosed bracket — rest of line is invalid
        tokens.push({ type: "invalid", text: trimmed.slice(i) });
        return tokens;
      }

      tokens.push({ type: "chord", text: trimmed.slice(i, closeIdx + 1) });
      i = closeIdx + 1;
    } else if (trimmed[i] === "{") {
      // Inline brace (unusual but handle gracefully)
      if (lyricsBuffer) {
        tokens.push({ type: "lyrics", text: lyricsBuffer });
        lyricsBuffer = "";
      }
      const closeIdx = trimmed.indexOf("}", i + 1);
      if (closeIdx === -1) {
        tokens.push({ type: "invalid", text: trimmed.slice(i) });
        return tokens;
      }
      tokens.push({ type: "directive", text: trimmed.slice(i, closeIdx + 1) });
      i = closeIdx + 1;
    } else {
      lyricsBuffer += trimmed[i];
      i++;
    }
  }

  if (lyricsBuffer) {
    tokens.push({ type: "lyrics", text: lyricsBuffer });
  }

  return tokens;
}

/**
 * Tokenize an entire ChordPro source string, returning an array of
 * token arrays (one per line).
 */
export function tokenizeChordPro(source: string): Token[][] {
  return source.split("\n").map(tokenizeLine);
}
