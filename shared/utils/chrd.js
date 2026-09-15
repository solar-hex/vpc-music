/**
 * Legacy `.chrd` -> ChordPro conversion.
 *
 * The legacy format (the old "Lead Sheets" PHP site):
 * - line 1: title. A leading `~` marks a draft; the real library marks drafts
 *   with a `~` filename prefix instead, so both are honoured.
 * - line 2: key (optional)
 * - further header lines: "Author: ...", "Year: ...", or unlabeled notes
 * - blank-line separated blocks; the first unprefixed line of a block is its
 *   section name ("Verse 1", "[Chorus]")
 * - `#` primary chord line: bracketed chords positioned above the lyric
 * - `^` secondary chord line: melody/bass notes (lowercase) or an alternate
 *   voicing, shown in a second colour above the primary chords
 * - `@` lyric line
 * - `*` comment/annotation (italic in the old site, toggleable)
 *
 * Output conventions:
 * - primary chords become inline `[G]` tokens at their lyric column
 * - secondary chords become inline `[*ab]` annotation tokens at their column,
 *   emitted before the primary token when both share a column
 * - `*` lines become `{ci: ...}` (comment_italic) note lines
 * - section names become `{comment: ...}` headers
 */
import { isSectionToken, transposeToken } from "./transpose.js";

const KEY_PATTERN = /^[A-G](?:b|#)?(?:m|min)?$/i;
const PREFIX_PATTERN = /^\s*[#@^*]/;
// Tokens the old library used on chord lines that are deliberately not chords
const NON_CHORD_MARKERS = new Set(["|", "x", "X", "N.C.", "n.c.", "NC"]);

const HEADER_DIRECTIVE_MAP = {
  artist: "artist",
  author: "artist",
  composer: "artist",
  writer: "artist",
  "written by": "artist",
  "music by": "artist",
  "words by": "artist",
  key: "key",
  tempo: "tempo",
  bpm: "tempo",
  year: "year",
  copyright: "copyright",
  ccli: "ccli",
  capo: "capo",
  time: "time",
};

// Zero-width characters, non-ASCII spaces and typographic punctuation seen in
// the old library (written as escapes so the source stays visible).
const ZERO_WIDTH_CHARS = /[\u200B\u200C\u200D\uFEFF]/g;
const NON_ASCII_SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
const TYPOGRAPHIC_CHARS = /[\u2018\u2019\u201A\u201C\u201D\u201E\u2013\u2014\u2026]/g;
const APOSTROPHE = String.fromCharCode(39);
const QUOTE = String.fromCharCode(34);
const TYPOGRAPHIC_MAP = {
  "\u2018": APOSTROPHE,
  "\u2019": APOSTROPHE,
  "\u201A": APOSTROPHE,
  "\u201C": QUOTE,
  "\u201D": QUOTE,
  "\u201E": QUOTE,
  "\u2013": "-",
  "\u2014": "-",
  "\u2026": "...",
};

/**
 * Normalize the raw text of a legacy file: line endings, BOM, zero-width
 * characters (which sat inside chord tokens in the old library), non-ASCII
 * spaces (mapped one-for-one so columns still line up) and typographic
 * quotes/dashes. Every replacement is reported as a warning.
 * @param {string} input
 * @param {string[]} [warnings]
 * @returns {string}
 */
export function normalizeLegacyText(input, warnings = []) {
  let text = String(input || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");

  const zeroWidth = text.match(ZERO_WIDTH_CHARS);
  if (zeroWidth) {
    text = text.replace(ZERO_WIDTH_CHARS, "");
    warnings.push(`Removed ${zeroWidth.length} zero-width character(s)`);
  }

  const spaces = text.match(NON_ASCII_SPACES);
  if (spaces) {
    text = text.replace(NON_ASCII_SPACES, " ");
    warnings.push(`Replaced ${spaces.length} non-ASCII space character(s)`);
  }

  const typographic = text.match(TYPOGRAPHIC_CHARS);
  if (typographic) {
    text = text.replace(TYPOGRAPHIC_CHARS, (ch) => TYPOGRAPHIC_MAP[ch]);
    warnings.push(`Replaced ${typographic.length} typographic quote(s)/dash(es) with ASCII`);
  }

  // A Mac apostrophe read as Latin-1 arrives as "Õ": "youÕve", "canÕt".
  const macApostrophes = text.match(/(?<=[A-Za-z])Õ(?=[a-z])/g);
  if (macApostrophes) {
    text = text.replace(/(?<=[A-Za-z])Õ(?=[a-z])/g, "'");
    warnings.push(`Replaced ${macApostrophes.length} mis-decoded apostrophe(s)`);
  }

  return text;
}

function sanitizeDirectiveValue(value) {
  return String(value || "").replace(/[{}]/g, "").trim();
}

function isPrefixedLine(line) {
  return PREFIX_PATTERN.test(String(line || ""));
}

function stripLinePrefix(line, prefix) {
  return line.replace(new RegExp(`^\\s*\\${prefix}`), "");
}

function baseName(filename) {
  return String(filename || "").split(/[\\/]/).pop() || "";
}

function deriveTitleFromFilename(filename) {
  return baseName(filename).replace(/\.chrd$/i, "").replace(/^~/, "").trim() || "Untitled";
}

function normalizeDraftTitle(rawTitle, filename) {
  const trimmed = String(rawTitle || "").trim();
  const titleDraft = trimmed.startsWith("~");
  const title = (titleDraft ? trimmed.slice(1) : trimmed).trim() || deriveTitleFromFilename(filename);
  return { title, isDraft: titleDraft || baseName(filename).startsWith("~") };
}

function isLikelySongKey(value) {
  return KEY_PATTERN.test(String(value || "").trim());
}

function parseHeaderLine(line) {
  const match = String(line || "").trim().match(/^([^:]+):\s*(.+)$/);
  if (!match) return null;

  const [, rawKey, rawValue] = match;
  const directive = HEADER_DIRECTIVE_MAP[rawKey.trim().toLowerCase()];
  if (!directive) return null;

  return { key: directive, value: sanitizeDirectiveValue(rawValue) };
}

function parseTempo(value) {
  if (!value) return null;
  return /^\d+$/.test(String(value).trim()) ? Number(value) : null;
}

function truncate(text, max = 40) {
  const value = String(text);
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function stripBrackets(token) {
  return token.replace(/^\[+/, "").replace(/\]+$/, "");
}

/** A primary-line token the transposer understands (it changes when moved a semitone), or a known marker. */
function isChordLike(raw) {
  return NON_CHORD_MARKERS.has(raw) || transposeToken(raw, 1) !== raw;
}

/**
 * Chord tokens with their columns from a `#` or `^` line body (prefix
 * removed). The column is that of the chord NAME, not its bracket: in the old
 * library "[G]" over "Amazing" puts the G on the "m" (the downbeat syllable),
 * which is also how the old site's own OnSong export placed chords.
 */
function tokenizeChordLine(body) {
  const tokens = [];
  for (const match of body.matchAll(/\S+/g)) {
    // "[Ebm]*" — anything after the closing bracket is a decoration we drop
    const bracketed = match[0].match(/^(\[+)([^\]]*)\](.*)$/);
    const raw = bracketed ? bracketed[2] : stripBrackets(match[0]);
    const leading = bracketed ? bracketed[1].length : 0;
    const decoration = bracketed ? bracketed[3] : "";
    if (raw) tokens.push({ raw, col: match.index + leading, decoration });
  }
  return tokens;
}

/** A line with no prefix whose every token is a chord. */
function isUnprefixedChordRow(line) {
  const tokens = tokenizeChordLine(String(line || ""));
  return tokens.length > 0 && tokens.every((token) => token.raw !== "|" && isChordLike(token.raw));
}

/** Insert bracket tokens into a lyric at their columns (earlier columns first, lower rank first on ties). */
function insertTokens(lyric, tokens) {
  const sorted = [...tokens].sort((a, b) => a.col - b.col || a.rank - b.rank);
  let result = lyric;
  let offset = 0;
  for (const { col, text } of sorted) {
    const insertAt = Math.min(col + offset, result.length);
    result = result.slice(0, insertAt) + text + result.slice(insertAt);
    offset += text.length;
  }
  return result;
}

function cleanSectionName(line) {
  return sanitizeDirectiveValue(String(line).trim().replace(/^\[(.*)\]$/, "$1"));
}

function flushBlock(blockLines, out, warnings) {
  if (blockLines.length === 0) return;

  let index = 0;
  const hasPrefixed = blockLines.some(isPrefixedLine);
  if (!isPrefixedLine(blockLines[0]) && (hasPrefixed || isSectionToken(cleanSectionName(blockLines[0])))) {
    const header = cleanSectionName(blockLines[0]);
    if (header) out.push(`{comment: ${header}}`);
    index = 1;
  }
  if (!hasPrefixed && index < blockLines.length) {
    warnings.push(`Block without line prefixes kept as plain text: "${truncate(blockLines[index].trim())}"`);
  }

  // Chord tokens from `#`/`^` lines waiting for the `@` lyric they sit above.
  let pending = [];
  let sequence = 0;
  const pendingHas = (secondary) => pending.some((token) => token.secondary === secondary);
  const flushPending = () => {
    if (pending.length === 0) return;
    const width = Math.max(...pending.map((token) => token.col));
    out.push(insertTokens(" ".repeat(width), pending).trim());
    pending = [];
  };

  while (index < blockLines.length) {
    const rawLine = blockLines[index];
    index += 1;
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (!isPrefixedLine(rawLine)) {
      flushPending();
      /*
       * A chord row typed without its `#`, over a lyric typed without its `@`
       * ("Bbm        Ab  Eb/G" above "If you've got a mountain"). Read as the
       * pair it is, so the chords transpose; a row with no lyric under it is
       * a chord-only line.
       */
      if (isUnprefixedChordRow(rawLine)) {
        const tokens = tokenizeChordLine(rawLine).map((token, n) => ({ col: token.col, rank: 1000 + n, text: `[${token.raw}]` }));
        const next = blockLines[index];
        if (next !== undefined && next.trim() && !isPrefixedLine(next) && !isUnprefixedChordRow(next)) {
          out.push(insertTokens(next, tokens).trim());
          index += 1;
        } else {
          out.push(insertTokens(" ".repeat(Math.max(...tokens.map((token) => token.col))), tokens).trim());
        }
        continue;
      }
      out.push(trimmed);
      if (hasPrefixed) warnings.push(`Unprefixed line kept as plain text: "${truncate(trimmed)}"`);
      continue;
    }

    const prefix = trimmed[0];
    const body = stripLinePrefix(rawLine, prefix);

    if (prefix === "*") {
      flushPending();
      const note = sanitizeDirectiveValue(body);
      if (note) out.push(`{ci: ${note}}`);
      continue;
    }

    // "#[Verse 2]" — a section header written on a chord line
    const headerOnChordLine = prefix === "#" ? body.trim().match(/^\[([^\]]+)\]$/) : null;
    if (headerOnChordLine && isSectionToken(headerOnChordLine[1])) {
      flushPending();
      out.push(`{comment: ${sanitizeDirectiveValue(headerOnChordLine[1])}}`);
      continue;
    }

    if (prefix === "#" || prefix === "^") {
      const secondary = prefix === "^";
      // Two primary (or two secondary) lines in a row means the earlier one
      // had no lyric of its own: emit it as a chord-only line.
      if (pendingHas(secondary)) flushPending();
      sequence += 1;
      for (const token of tokenizeChordLine(body)) {
        if (!secondary && !isChordLike(token.raw)) {
          warnings.push(`Unrecognized chord "${token.raw}"`);
        }
        if (token.decoration) {
          warnings.push(`Dropped "${token.decoration}" after chord "${token.raw}"`);
        }
        pending.push({
          col: token.col,
          secondary,
          rank: (secondary ? 0 : 1) * 1000 + sequence,
          text: token.raw === "|" ? "|" : `[${secondary ? "*" : ""}${token.raw}]`,
        });
      }
      continue;
    }

    // `@` lyric line: merge every pending chord token into it by column.
    out.push(insertTokens(body, pending).trim());
    pending = [];
  }

  flushPending();
}

/**
 * Convert one legacy `.chrd` song into ChordPro.
 * @param {string} filename
 * @param {string} rawContent
 * @returns {{ title: string, chordProContent: string, metadata: { title: string, artist: string | null, key: string | null, tempo: number | null, year: string | null, isDraft: boolean }, warnings: string[] }}
 */
export function convertChrdToChordPro(filename, rawContent) {
  const warnings = [];
  const sourceLines = normalizeLegacyText(rawContent, warnings).split("\n");

  const rawTitle = sourceLines[0]?.trim() || "";
  const { title, isDraft } = normalizeDraftTitle(rawTitle, filename);
  const directives = new Map([["title", title]]);
  let index = rawTitle ? 1 : 0;

  // Header: key, "Label: value" metadata, and unlabeled notes, up to the
  // first blank line or the first prefixed line.
  while (index < sourceLines.length) {
    const line = sourceLines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      index += 1;
      break;
    }
    if (isPrefixedLine(line)) break;

    if (!directives.has("key") && isLikelySongKey(trimmed)) {
      directives.set("key", trimmed);
      index += 1;
      continue;
    }

    const header = parseHeaderLine(trimmed);
    if (header) {
      if (header.value && !directives.has(header.key)) directives.set(header.key, header.value);
      index += 1;
      continue;
    }

    // An unlabeled line directly followed by prefixed content (or that reads
    // like a section name) is the first section's name, not metadata.
    if (isPrefixedLine(sourceLines[index + 1] ?? "") || isSectionToken(trimmed)) break;

    const value = sanitizeDirectiveValue(trimmed);
    if (!directives.has("artist")) {
      directives.set("artist", value);
      warnings.push(`Unlabeled header line used as artist: "${truncate(trimmed)}"`);
    } else {
      directives.set("subtitle", [directives.get("subtitle"), value].filter(Boolean).join(" - "));
      warnings.push(`Unlabeled header line kept as subtitle: "${truncate(trimmed)}"`);
    }
    index += 1;
  }

  if (!directives.has("key")) warnings.push("No key line found");

  const out = [];
  const block = [];
  for (const line of [...sourceLines.slice(index), ""]) {
    if (line.trim() === "") {
      if (block.length > 0) {
        flushBlock(block, out, warnings);
        out.push("");
        block.length = 0;
      }
      continue;
    }
    block.push(line);
  }
  while (out.at(-1) === "") out.pop();

  const directiveLines = [...directives.entries()].map(([key, value]) => `{${key}: ${sanitizeDirectiveValue(value)}}`);
  const chordProContent = [...directiveLines, "", ...out].join("\n").trim();

  return {
    title,
    chordProContent,
    metadata: {
      title,
      artist: directives.get("artist") || null,
      key: directives.get("key") || null,
      tempo: parseTempo(directives.get("tempo")),
      year: directives.get("year") || null,
      isDraft,
    },
    warnings,
  };
}
