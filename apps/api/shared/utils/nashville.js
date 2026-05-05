/**
 * Nashville Number System — convert chord names to Nashville numbers
 * relative to a given key.
 *
 * Nashville numbers represent chords as scale degrees (1–7) with the
 * quality suffix preserved. For example, in key of C: Am7 → 6m7, F → 4, G/B → 5/7.
 */
import { CHROMATIC_SHARP, CHROMATIC_FLAT, NASHVILLE_NUMBERS } from "../constants/music.js";

/**
 * Find the chromatic index (0–11) of a root note, checking both scales.
 * @param {string} root — e.g. "C", "F#", "Bb"
 * @returns {number} index in chromatic scale, or -1 if not found
 */
function rootIndex(root) {
  let idx = CHROMATIC_SHARP.indexOf(root);
  if (idx !== -1) return idx;
  idx = CHROMATIC_FLAT.indexOf(root);
  return idx;
}

/**
 * Convert a single chord to a Nashville number string.
 * @param {string} chord — e.g. "Am7", "F#m", "G/B", "Bbsus4"
 * @param {string} key — the song key, e.g. "C", "G", "Bb"
 * @returns {string} Nashville representation, e.g. "6m7", "4", "5/7"
 */
export function chordToNashville(chord, key) {
  if (!chord || !key) return chord;

  // Handle slash chords recursively
  if (chord.includes("/")) {
    const [main, bass] = chord.split("/");
    return `${chordToNashville(main, key)}/${chordToNashville(bass, key)}`;
  }

  // Extract root note (e.g. "A", "F#", "Bb") and quality (e.g. "m7", "sus4", "")
  const match = chord.match(/^([A-G][b#]?)(.*)/);
  if (!match) return chord;

  const [, root, quality] = match;

  const keyIdx = rootIndex(key);
  const chordIdx = rootIndex(root);
  if (keyIdx === -1 || chordIdx === -1) return chord;

  const interval = ((chordIdx - keyIdx) % 12 + 12) % 12;
  return NASHVILLE_NUMBERS[interval] + quality;
}

/**
 * Convert all chords in a ChordPro string to Nashville numbers.
 * @param {string} input — raw ChordPro text with [brackets]
 * @param {string} key — the song key
 * @returns {string}
 */
export function nashvilleChordPro(input, key) {
  if (!key) return input;
  return input.replace(/\[([^\]]+)\]/g, (_match, chord) => {
    return `[${chordToNashville(chord, key)}]`;
  });
}
