/**
 * Transpose utility — shift chords by semitone steps.
 */
import { CHROMATIC_SHARP, CHROMATIC_FLAT } from "../constants/music.js";

/**
 * Transpose a single chord name by `steps` semitones.
 * @param {string} chord — e.g. "G", "Bm", "F#m7", "C/E"
 * @param {number} steps — positive = up, negative = down
 * @returns {string}
 */
export function transposeChord(chord, steps) {
  // Handle slash chords: "C/E" → transpose both parts
  if (chord.includes("/")) {
    const [root, bass] = chord.split("/");
    return `${transposeChord(root, steps)}/${transposeChord(bass, steps)}`;
  }

  // Extract root note and quality
  const match = chord.match(/^([A-G][b#]?)(.*)/);
  if (!match) return chord;

  const [, root, quality] = match;
  const useFlats = root.includes("b");
  const scale = useFlats ? CHROMATIC_FLAT : CHROMATIC_SHARP;

  const index = scale.indexOf(root);
  if (index === -1) {
    // Try the other scale
    const altScale = useFlats ? CHROMATIC_SHARP : CHROMATIC_FLAT;
    const altIndex = altScale.indexOf(root);
    if (altIndex === -1) return chord;
    const newIndex = ((altIndex + steps) % 12 + 12) % 12;
    return altScale[newIndex] + quality;
  }

  const newIndex = ((index + steps) % 12 + 12) % 12;
  return scale[newIndex] + quality;
}

/**
 * Transpose all chords in a ChordPro string by `steps` semitones.
 * @param {string} input — raw ChordPro text
 * @param {number} steps
 * @returns {string}
 */
export function transposeChordPro(input, steps) {
  return input.replace(/\[([^\]]+)\]/g, (_match, chord) => {
    return `[${transposeChord(chord, steps)}]`;
  });
}
