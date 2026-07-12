/**
 * chords — a self-contained public API for chord + chart transposition.
 *
 * Behavior mirrors shared/utils/transpose.js + shared/utils/chart.js (the
 * canonical ESM source of truth); this CommonJS module consolidates them into
 * one surface: parseChord/transposeChord (chord level), interval/preferFlats
 * (key math), parseChart/transposeChart/toText (chart level).
 *
 * Design rules (the bugs a naive implementation hits):
 *  - Section tokens ([Chorus], [Verse 1]) are never parsed as chords.
 *  - Enharmonic spelling follows the TARGET key (into Bb → Eb, not D#).
 *  - Slash chords transpose both halves; extensions survive untouched.
 *  - Comments (`# …`) are dropped when rendering to text.
 */

"use strict";

const CHROMATIC_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const CHROMATIC_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// Keys conventionally spelled with flats (majors + their relative minors)
const FLAT_KEYS = new Set([
  "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb",
  "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm", "Abm",
]);

// Bracket tokens that are section labels, never chords
const SECTION_WORDS = [
  "intro", "verse", "chorus", "bridge", "outro", "ending", "tag", "coda",
  "pre-chorus", "prechorus", "interlude", "instrumental", "refrain", "vamp",
  "turnaround", "breakdown", "solo", "hook", "channel", "reprise",
];
const SECTION_REGEX = new RegExp(`^(?:${SECTION_WORDS.join("|")})(?:\\s*\\d+[a-z]?)?$`, "i");

// Strict chord grammar: root + quality made of known tokens + optional bass.
const CHORD_QUALITY_TOKEN = /(?:maj|min|dim|aug|sus|add|alt|no|[mM])|\d{1,2}|[b#()+°ø\-Δ^]/;
const CHORD_REGEX_STRICT = new RegExp(
  `^([A-G][b#]?)((?:${CHORD_QUALITY_TOKEN.source})*)(?:/(?:[A-G][b#]?|\\d{1,2}))?$`,
);

function isSectionToken(token) {
  return SECTION_REGEX.test(String(token).trim());
}

function isChordToken(token) {
  const trimmed = String(token).trim();
  if (!trimmed || isSectionToken(trimmed)) return false;
  return CHORD_REGEX_STRICT.test(trimmed);
}

function noteIndex(note) {
  const sharpIdx = CHROMATIC_SHARP.indexOf(note);
  if (sharpIdx !== -1) return sharpIdx;
  return CHROMATIC_FLAT.indexOf(note);
}

/** Does this key conventionally use flats? ("Bb", "Dm", "Gb" → true) */
function preferFlats(key) {
  if (!key) return false;
  const match = String(key).trim().match(/^([A-G][b#]?)\s*(m|min|minor)?/i);
  if (!match) return false;
  const root = match[1][0].toUpperCase() + (match[1][1] ?? "");
  const isMinor = Boolean(match[2]);
  return FLAT_KEYS.has(isMinor ? `${root}m` : root);
}

/** Semitones from one key to another, normalized to 0..11. ("G" → "Bb" = 3) */
function interval(fromKey, toKey) {
  const parse = (key) => {
    const match = String(key || "").trim().match(/^([A-G][b#]?)/);
    return match ? noteIndex(match[1]) : -1;
  };
  const from = parse(fromKey);
  const to = parse(toKey);
  if (from === -1 || to === -1) return 0;
  return ((to - from) % 12 + 12) % 12;
}

function transposeNote(note, steps, flats) {
  const index = noteIndex(note);
  if (index === -1) return note;
  const newIndex = ((index + steps) % 12 + 12) % 12;
  const useFlats = flats === undefined ? note.includes("b") : flats;
  return (useFlats ? CHROMATIC_FLAT : CHROMATIC_SHARP)[newIndex];
}

/** Transpose a key name, preserving its suffix ("G" → "Bb", "Em" → "Gm"). */
function transposeKeyName(key, steps, flats) {
  const match = String(key || "").trim().match(/^([A-G][b#]?)(.*)$/);
  if (!match) return key;
  return transposeNote(match[1], steps, flats) + match[2];
}

/**
 * Parse a chord name into { root, quality, bass, raw }.
 * Returns null when the text is not a chord (e.g. a section label).
 */
function parseChord(chord) {
  const raw = String(chord).trim();
  if (!isChordToken(raw)) return null;
  const [root, bass] = raw.includes("/") ? raw.split("/") : [raw, undefined];
  const m = root.match(/^([A-G][b#]?)(.*)$/);
  return { root: m[1], quality: m[2] || "", bass, raw };
}

/**
 * Transpose a chord by `steps` semitones. Accepts a chord string or a parsed
 * chord object (from parseChord). `flats` spells the result for the target key.
 */
function transposeChord(chord, steps, flats) {
  const raw = chord && typeof chord === "object" ? chord.raw : String(chord);
  if (raw.includes("/")) {
    const [root, bass] = raw.split("/");
    return `${transposeChord(root, steps, flats)}/${transposeChord(bass, steps, flats)}`;
  }
  const match = raw.match(/^([A-G][b#]?)(.*)/);
  if (!match) return raw;
  return transposeNote(match[1], steps, flats) + match[2];
}

/** Transpose the chord cells of a bar line: "| G | C/E | D |" */
function transposeBarLine(line, steps, flats) {
  return line.replace(/([^|\s]+)/g, (token) =>
    isChordToken(token) ? transposeChord(token, steps, flats) : token,
  );
}

/** Transpose every chord in a ChordPro-lite string; section/comment lines pass through. */
function transposeText(input, steps, flats) {
  if (((steps % 12) + 12) % 12 === 0) return String(input);
  return String(input)
    .split("\n")
    .map((line) => {
      if (line.trimStart().startsWith("|")) return transposeBarLine(line, steps, flats);
      return line.replace(/\[([^\]]+)\]/g, (match, token) =>
        isChordToken(token) ? `[${transposeChord(token, steps, flats)}]` : match,
      );
    })
    .join("\n");
}

/**
 * Parse ChordPro-lite text into a line-preserving AST plus a directives map.
 * Line types: blank | comment | directive | section | bars | lyric.
 */
function parseChart(text) {
  const directives = {};
  const lines = String(text ?? "")
    .split("\n")
    .map((raw) => {
      const trimmed = raw.trim();
      if (!trimmed) return { type: "blank", raw };
      if (trimmed.startsWith("#")) return { type: "comment", raw };
      const directive = trimmed.match(/^\{(\w+)(?::\s*(.*?))?\}$/);
      if (directive) {
        const key = directive[1].toLowerCase();
        const value = directive[2] ?? "";
        directives[key] = value;
        return { type: "directive", key, value, raw };
      }
      const bracket = trimmed.match(/^\[([^\]]+)\]$/);
      if (bracket && isSectionToken(bracket[1])) {
        return { type: "section", name: bracket[1], raw };
      }
      if (trimmed.startsWith("|")) return { type: "bars", raw };
      return { type: "lyric", raw };
    });
  return { lines, directives };
}

/** Render a chart AST back to text, dropping comment lines. */
function toText(chart) {
  return chart.lines
    .filter((line) => line.type !== "comment")
    .map((line) => line.raw)
    .join("\n");
}

/** Transpose a chart AST. A net-zero shift returns the same object. */
function transposeChart(chart, steps, flats) {
  if (((steps % 12) + 12) % 12 === 0) return chart;
  const fullText = chart.lines.map((line) => line.raw).join("\n");
  const next = parseChart(transposeText(fullText, steps, flats));
  // Rewrite the {key: ...} directive so the rendered chart's key label tracks
  // the transposed chords instead of reading stale.
  next.lines = next.lines.map((line) => {
    if (line.type !== "directive" || line.key !== "key" || !line.value) return line;
    const value = transposeKeyName(line.value, steps, flats);
    next.directives.key = value;
    return { ...line, value, raw: line.raw.replace(/(\{key:\s*).*(\})/i, `$1${value}$2`) };
  });
  return next;
}

module.exports = {
  parseChord,
  transposeChord,
  interval,
  preferFlats,
  parseChart,
  transposeChart,
  toText,
  // extras, handy for callers
  isChordToken,
  isSectionToken,
};
