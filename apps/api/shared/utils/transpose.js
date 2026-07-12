/**
 * Transpose utility — shift chords by semitone steps.
 *
 * Design rules (the bugs every naive implementation hits):
 *  - Section tokens ([Chorus], [Verse 1]) must never be parsed as chords —
 *    otherwise "+3" turns [Chorus] into [Eb]horus.
 *  - Enharmonic spelling follows the TARGET key: transposing into Bb gives
 *    Eb, not D#. Flat keys: F, Bb, Eb, Ab, Db, Gb (and their relative minors).
 *  - Slash chords transpose both halves (G/B +2 → A/C#).
 *  - Extensions survive untouched (C#m7b5, A7(#9), Fsus4).
 *  - Round-trips are lossless: G → Bb → G returns the original text.
 */
import { CHROMATIC_SHARP, CHROMATIC_FLAT } from "../constants/music.js";

// Keys conventionally spelled with flats (majors + their relative minors)
const FLAT_KEYS = new Set([
  "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb",
  "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm", "Abm",
]);

// Section vocabulary — bracket tokens that are never chords
const SECTION_WORDS = [
  "intro", "verse", "chorus", "bridge", "outro", "ending", "tag", "coda",
  "pre-chorus", "prechorus", "interlude", "instrumental", "refrain", "vamp",
  "turnaround", "breakdown", "solo", "hook", "channel", "reprise",
];
const SECTION_REGEX = new RegExp(`^(?:${SECTION_WORDS.join("|")})(?:\\s*\\d+[a-z]?)?$`, "i");

// Chord grammar: root + optional quality made only of known tokens + optional
// bass (a note, or digits for chords like C6/9). Every token consumes ≥1 char.
const CHORD_QUALITY_TOKEN = /(?:maj|min|dim|aug|sus|add|alt|no|[mM])|\d{1,2}|[b#()+°ø\-Δ^]/;
const CHORD_REGEX_STRICT = new RegExp(
  `^([A-G][b#]?)((?:${CHORD_QUALITY_TOKEN.source})*)(?:/(?:[A-G][b#]?|\\d{1,2}))?$`,
);

/** Is this bracket token a section label rather than a chord? */
export function isSectionToken(token) {
  return SECTION_REGEX.test(String(token).trim());
}

/** Is this token a chord the transposer should touch? */
export function isChordToken(token) {
  const trimmed = String(token).trim();
  if (!trimmed || isSectionToken(trimmed)) return false;
  return CHORD_REGEX_STRICT.test(trimmed);
}

/** Does this key conventionally use flats? ("Bb", "Dm", "Gb" → true) */
export function keyPrefersFlats(key) {
  if (!key) return false;
  const normalized = String(key).trim();
  // Normalize "Bbm"/"Bb minor"/"Bbmin" → "Bbm"; majors pass through
  const match = normalized.match(/^([A-G][b#]?)\s*(m|min|minor)?/i);
  if (!match) return false;
  const root = match[1][0].toUpperCase() + (match[1][1] ?? "");
  const isMinor = Boolean(match[2]);
  return FLAT_KEYS.has(isMinor ? `${root}m` : root);
}

function noteIndex(note) {
  const sharpIdx = CHROMATIC_SHARP.indexOf(note);
  if (sharpIdx !== -1) return sharpIdx;
  return CHROMATIC_FLAT.indexOf(note);
}

/** Semitones from one key to another, normalized to 0..11. ("G" → "Bb" = 3) */
export function interval(fromKey, toKey) {
  const parse = (key) => {
    const match = String(key || "").trim().match(/^([A-G][b#]?)/);
    return match ? noteIndex(match[1]) : -1;
  };
  const from = parse(fromKey);
  const to = parse(toKey);
  if (from === -1 || to === -1) return 0;
  return ((to - from) % 12 + 12) % 12;
}

function transposeNote(note, steps, preferFlats) {
  const index = noteIndex(note);
  if (index === -1) return note;
  const newIndex = ((index + steps) % 12 + 12) % 12;
  // When no preference is given, keep the source spelling convention
  const useFlats = preferFlats === undefined ? note.includes("b") : preferFlats;
  return (useFlats ? CHROMATIC_FLAT : CHROMATIC_SHARP)[newIndex];
}

/** Transpose a key name (e.g. "G" +3 flats → "Bb", "Em" +3 → "Gm"). */
export function transposeKeyName(key, steps, preferFlats) {
  const match = String(key || "").trim().match(/^([A-G][b#]?)(.*)$/);
  if (!match) return key;
  const [, root, rest] = match;
  return transposeNote(root, steps, preferFlats) + rest;
}

/**
 * Transpose a single chord name by `steps` semitones.
 * @param {string} chord — e.g. "G", "Bm", "F#m7", "C/E"
 * @param {number} steps — positive = up, negative = down
 * @param {boolean} [preferFlats] — spell the result with flats (from the
 *   target key). Omitted = legacy behavior (follow the source spelling).
 * @returns {string}
 */
export function transposeChord(chord, steps, preferFlats) {
  // Handle slash chords: "C/E" → transpose both parts
  if (chord.includes("/")) {
    const [root, bass] = chord.split("/");
    return `${transposeChord(root, steps, preferFlats)}/${transposeChord(bass, steps, preferFlats)}`;
  }

  // Extract root note and quality; the quality is preserved untouched
  const match = chord.match(/^([A-G][b#]?)(.*)/);
  if (!match) return chord;

  const [, root, quality] = match;
  return transposeNote(root, steps, preferFlats) + quality;
}

/** Transpose the chord cells of a bar line: "| G | C/E | D |" */
function transposeBarLine(line, steps, preferFlats) {
  return line.replace(/([^|\s]+)/g, (token) =>
    isChordToken(token) ? transposeChord(token, steps, preferFlats) : token,
  );
}

/**
 * Transpose all chords in a ChordPro string by `steps` semitones.
 * Section tokens ([Chorus], [Verse 1]) and non-chord brackets pass through
 * untouched; bar lines ("| G | C |") are transposed cell by cell.
 * @param {string} input — raw ChordPro text
 * @param {number} steps
 * @param {boolean} [preferFlats] — target-key spelling (see transposeChord)
 * @returns {string}
 */
export function transposeChordPro(input, steps, preferFlats) {
  // Transposition is a view concern computed from the stored source, so a
  // net-zero shift must return the source byte-for-byte (lossless round-trip).
  if (((steps % 12) + 12) % 12 === 0) return String(input);
  return String(input)
    .split("\n")
    .map((line) => {
      if (line.trimStart().startsWith("|")) {
        return transposeBarLine(line, steps, preferFlats);
      }
      return line.replace(/\[([^\]]+)\]/g, (match, token) =>
        isChordToken(token) ? `[${transposeChord(token, steps, preferFlats)}]` : match,
      );
    })
    .join("\n");
}
