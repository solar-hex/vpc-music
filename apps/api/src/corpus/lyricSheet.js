/**
 * Convert a Word lyric/chord sheet into ChordPro.
 *
 * The `TBD` corpus holds two shapes, and the converter detects which it has
 * rather than assuming:
 *
 *   "5. Imported"    title + [Key], sections, a bracketed chord line
 *                    column-aligned above each lyric line
 *   "1. Incomplete"  title, sections, lyrics only — NO chords
 *
 * A lyrics-only sheet stays lyrics-only. Chords are never invented.
 */
import { basename, extname } from "node:path";
import { isChordToken, isSecondaryToken } from "@vpc-music/shared";

/** Section labels as written in these documents, mapped to the app's vocabulary. */
const SECTION_ALIASES = new Map([
  ["v", "Verse"], ["vs", "Verse"], ["verse", "Verse"],
  ["c", "Chorus"], ["ch", "Chorus"], ["cho", "Chorus"], ["chorus", "Chorus"],
  ["b", "Bridge"], ["br", "Bridge"], ["bridge", "Bridge"],
  ["pc", "Pre-Chorus"], ["pre", "Pre-Chorus"], ["prechorus", "Pre-Chorus"], ["pre-chorus", "Pre-Chorus"],
  ["intro", "Intro"], ["outro", "Outro"], ["tag", "Tag"], ["ending", "Ending"], ["end", "Ending"],
  ["interlude", "Interlude"], ["instrumental", "Instrumental"], ["vamp", "Vamp"],
  ["refrain", "Refrain"], ["turnaround", "Turnaround"], ["coda", "Coda"], ["hook", "Hook"],
]);

const ROMAN = new Map([["i", 1], ["ii", 2], ["iii", 3], ["iv", 4], ["v", 5], ["vi", 6], ["vii", 7]]);

/**
 * "V1" -> "Verse 1", "Ch" -> "Chorus", "Verse II" -> "Verse 2".
 * Returns null when the line is not a section label.
 */
export function normalizeSectionLabel(raw) {
  const text = String(raw || "").trim().replace(/[:.]+$/, "");
  if (!text || text.length > 40) return null;

  // "V1", "V 1", "Verse 2", "Chorus 3", "Verse II"
  const m = text.match(/^([A-Za-z][A-Za-z-]*)\s*([0-9]+|[ivxIVX]+)?$/);
  if (!m) return null;

  const word = m[1].toLowerCase();
  const base = SECTION_ALIASES.get(word);
  if (!base) return null;

  let number = null;
  if (m[2]) {
    if (/^[0-9]+$/.test(m[2])) number = Number(m[2]);
    else number = ROMAN.get(m[2].toLowerCase()) ?? null;
  }
  // A bare "V" with no number is too ambiguous to be a section.
  if (base === "Verse" && number === null && word !== "verse") return null;
  return number ? `${base} ${number}` : base;
}

/** Bracketed tokens with only whitespace between them = a chord line. */
export function isChordLine(line) {
  const text = String(line || "");
  if (!text.trim()) return false;
  const tokens = [...text.matchAll(/\[([^\]]*)\]/g)];
  if (tokens.length === 0) return false;
  // Nothing outside the brackets except whitespace.
  if (text.replace(/\[[^\]]*\]/g, "").trim() !== "") return false;
  return tokens.every((t) => {
    const raw = t[1].trim();
    return raw === "" || isChordToken(raw) || isSecondaryToken(raw) || /^[A-G][b#]?/.test(raw);
  });
}

/**
 * Merge a bracketed chord line with the lyric line beneath it, using the
 * column of each `[` as the attachment point — the same rule the `.chrd`
 * converter uses, because alignment is meaning.
 */
export function mergeChordLine(chordLine, lyricLine) {
  const tokens = [];
  for (const m of String(chordLine).matchAll(/\[([^\]]*)\]/g)) {
    if (m[1].trim()) tokens.push({ column: m.index, text: m[1].trim() });
  }
  if (tokens.length === 0) return lyricLine;

  const lyric = String(lyricLine ?? "");
  let out = "";
  let cursor = 0;
  for (const token of tokens) {
    const at = Math.min(Math.max(token.column, 0), lyric.length);
    if (at > cursor) out += lyric.slice(cursor, at);
    else if (at < cursor) out += ""; // chords closer together than the lyric allows
    out += `[${token.text}]`;
    cursor = Math.max(cursor, at);
  }
  out += lyric.slice(cursor);
  return out;
}

function titleFromFilename(filename) {
  const base = basename(String(filename), extname(String(filename)));
  return base.replace(/\(\d+\)$/, "").replace(/[_-]+/g, " ").trim() || "Untitled";
}

/**
 * @param {string} filename
 * @param {string[]} paragraphs  one per Word paragraph
 * @returns {{ title, chordProContent, metadata, warnings, confidence }}
 */
export function convertLyricSheetToChordPro(filename, paragraphs) {
  const warnings = [];
  const lines = [...paragraphs];

  // ── header ────────────────────────────────────────────────────────────────
  let title = null;
  let key = null;
  let hymnalNumber = null;

  while (lines.length > 0 && !lines[0].trim()) lines.shift();
  if (lines.length > 0) {
    let head = lines.shift().trim();
    // trailing "[F]" is the key
    const keyMatch = head.match(/\[([A-G][b#]?m?(?:in)?)\]\s*$/);
    if (keyMatch) {
      key = keyMatch[1];
      head = head.slice(0, keyMatch.index).trim();
    } else {
      // Some sheets put a bare key at the end of the title line, set off by a
      // run of spaces: "I got the Lord      G". Two or more spaces are required
      // so a real title ending in a chord-shaped word ("The great I Am") is safe.
      const bareKey = head.match(/\s{2,}([A-G][b#]?m?(?:in)?)\s*$/);
      if (bareKey) {
        key = bareKey[1];
        head = head.slice(0, bareKey.index).trim();
      }
    }
    // trailing "- 174" is a hymnal number, not part of the title
    const numMatch = head.match(/[\s-]+(\d{1,4})\s*$/);
    if (numMatch) {
      hymnalNumber = numMatch[1];
      head = head.slice(0, numMatch.index).trim();
    }
    title = head || null;
  }
  if (!title) {
    title = titleFromFilename(filename);
    warnings.push("Title taken from the filename");
  }

  // ── body ──────────────────────────────────────────────────────────────────
  const body = [];
  let sawSection = false;
  let chordLines = 0;
  let lyricLines = 0;
  let lastWasBlank = true;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const text = line.trim();

    if (!text) {
      // These documents put a blank paragraph between every line as spacing.
      // In ChordPro a blank line is a section break, so emitting them would
      // shatter each verse into one-line sections. Structure comes from the
      // labels instead; a blank is only emitted before a section header.
      lastWasBlank = true;
      continue;
    }

    const section = normalizeSectionLabel(text);
    if (section) {
      if (body.length > 0) body.push("");
      body.push(`{comment: ${section}}`);
      sawSection = true;
      lastWasBlank = false;
      continue;
    }

    if (isChordLine(line)) {
      // Find the next non-blank line; if it is a lyric, merge them.
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j += 1;
      const next = j < lines.length ? lines[j] : null;
      if (next && !isChordLine(next) && !normalizeSectionLabel(next.trim())) {
        body.push(mergeChordLine(line, next));
        chordLines += 1;
        lyricLines += 1;
        i = j;
      } else {
        // chord-only line (an intro or turnaround)
        body.push(line.trim());
        chordLines += 1;
      }
      lastWasBlank = false;
      continue;
    }

    body.push(text);
    lyricLines += 1;
    lastWasBlank = false;
  }

  const hasChords = chordLines > 0;
  if (!hasChords) warnings.push("Lyrics only — no chords in the source");
  if (!sawSection) warnings.push("No section labels found");

  const directives = [`{title: ${title}}`];
  if (key) directives.push(`{key: ${key}}`);
  if (hymnalNumber) directives.push(`{subtitle: Hymnal ${hymnalNumber}}`);

  while (body.length > 0 && !body[body.length - 1]) body.pop();
  const chordProContent = `${[...directives, "", ...body].join("\n")}\n`;

  // Confidence: a lyrics-only sheet can never be trusted as a finished chart.
  let score = 1;
  const reasons = [];
  if (!hasChords) { score -= 0.5; reasons.push("no chords"); }
  if (!sawSection) { score -= 0.2; reasons.push("no sections"); }
  if (!key) { score -= 0.1; reasons.push("no key"); }
  if (lyricLines === 0) { score -= 0.3; reasons.push("no lyrics"); }
  score = Math.max(0, Math.round(score * 100) / 100);

  return {
    title,
    chordProContent,
    metadata: {
      title,
      artist: null,
      key,
      tempo: null,
      year: null,
      // Anything from a Word document is a draft until a human has seen it.
      isDraft: true,
      hymnalNumber,
      hasChords,
    },
    warnings,
    confidence: { score, band: score >= 0.85 ? "high" : score >= 0.6 ? "medium" : "low", reasons },
  };
}
