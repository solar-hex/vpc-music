/**
 * Built-in guitar chord shapes (standard tuning, low E → high E).
 * frets: -1 = muted, 0 = open, N = fret relative to baseFret.
 * A song's own {define:} directives override these at lookup time.
 */
export const GUITAR_SHAPES = {
  // Majors
  C:  { baseFret: 1, frets: [-1, 3, 2, 0, 1, 0] },
  D:  { baseFret: 1, frets: [-1, -1, 0, 2, 3, 2] },
  E:  { baseFret: 1, frets: [0, 2, 2, 1, 0, 0] },
  F:  { baseFret: 1, frets: [1, 3, 3, 2, 1, 1] },
  G:  { baseFret: 1, frets: [3, 2, 0, 0, 0, 3] },
  A:  { baseFret: 1, frets: [-1, 0, 2, 2, 2, 0] },
  B:  { baseFret: 2, frets: [-1, 1, 3, 3, 3, 1] },
  "C#": { baseFret: 4, frets: [-1, 1, 3, 3, 3, 1] },
  Db: { baseFret: 4, frets: [-1, 1, 3, 3, 3, 1] },
  "D#": { baseFret: 6, frets: [-1, 1, 3, 3, 3, 1] },
  Eb: { baseFret: 6, frets: [-1, 1, 3, 3, 3, 1] },
  "F#": { baseFret: 2, frets: [1, 3, 3, 2, 1, 1] },
  Gb: { baseFret: 2, frets: [1, 3, 3, 2, 1, 1] },
  "G#": { baseFret: 4, frets: [1, 3, 3, 2, 1, 1] },
  Ab: { baseFret: 4, frets: [1, 3, 3, 2, 1, 1] },
  "A#": { baseFret: 1, frets: [-1, 1, 3, 3, 3, 1] },
  Bb: { baseFret: 1, frets: [-1, 1, 3, 3, 3, 1] },

  // Minors
  Am: { baseFret: 1, frets: [-1, 0, 2, 2, 1, 0] },
  Bm: { baseFret: 2, frets: [-1, 1, 3, 3, 2, 1] },
  Cm: { baseFret: 3, frets: [-1, 1, 3, 3, 2, 1] },
  "C#m": { baseFret: 4, frets: [-1, 1, 3, 3, 2, 1] },
  Dm: { baseFret: 1, frets: [-1, -1, 0, 2, 3, 1] },
  "D#m": { baseFret: 6, frets: [-1, 1, 3, 3, 2, 1] },
  Ebm: { baseFret: 6, frets: [-1, 1, 3, 3, 2, 1] },
  Em: { baseFret: 1, frets: [0, 2, 2, 0, 0, 0] },
  Fm: { baseFret: 1, frets: [1, 3, 3, 1, 1, 1] },
  "F#m": { baseFret: 2, frets: [1, 3, 3, 1, 1, 1] },
  Gm: { baseFret: 3, frets: [1, 3, 3, 1, 1, 1] },
  "G#m": { baseFret: 4, frets: [1, 3, 3, 1, 1, 1] },
  Abm: { baseFret: 4, frets: [1, 3, 3, 1, 1, 1] },
  "A#m": { baseFret: 1, frets: [-1, 1, 3, 3, 2, 1] },
  Bbm: { baseFret: 1, frets: [-1, 1, 3, 3, 2, 1] },

  // Dominant 7ths
  C7: { baseFret: 1, frets: [-1, 3, 2, 3, 1, 0] },
  D7: { baseFret: 1, frets: [-1, -1, 0, 2, 1, 2] },
  E7: { baseFret: 1, frets: [0, 2, 0, 1, 0, 0] },
  F7: { baseFret: 1, frets: [1, 3, 1, 2, 1, 1] },
  G7: { baseFret: 1, frets: [3, 2, 0, 0, 0, 1] },
  A7: { baseFret: 1, frets: [-1, 0, 2, 0, 2, 0] },
  B7: { baseFret: 1, frets: [-1, 2, 1, 2, 0, 2] },
  Bb7: { baseFret: 1, frets: [-1, 1, 3, 1, 3, 1] },
  Eb7: { baseFret: 6, frets: [-1, 1, 3, 1, 3, 1] },

  // Minor 7ths
  Am7: { baseFret: 1, frets: [-1, 0, 2, 0, 1, 0] },
  Bm7: { baseFret: 2, frets: [-1, 1, 3, 1, 2, 1] },
  Dm7: { baseFret: 1, frets: [-1, -1, 0, 2, 1, 1] },
  Em7: { baseFret: 1, frets: [0, 2, 2, 0, 3, 0] },
  "F#m7": { baseFret: 2, frets: [1, 3, 1, 1, 1, 1] },
  Gm7: { baseFret: 3, frets: [1, 3, 1, 1, 1, 1] },

  // Major 7ths
  Cmaj7: { baseFret: 1, frets: [-1, 3, 2, 0, 0, 0] },
  Dmaj7: { baseFret: 1, frets: [-1, -1, 0, 2, 2, 2] },
  Fmaj7: { baseFret: 1, frets: [-1, -1, 3, 2, 1, 0] },
  Gmaj7: { baseFret: 1, frets: [3, 2, 0, 0, 0, 2] },
  Amaj7: { baseFret: 1, frets: [-1, 0, 2, 1, 2, 0] },

  // Suspended
  Csus4: { baseFret: 1, frets: [-1, 3, 3, 0, 1, 1] },
  Dsus4: { baseFret: 1, frets: [-1, -1, 0, 2, 3, 3] },
  Dsus2: { baseFret: 1, frets: [-1, -1, 0, 2, 3, 0] },
  Esus4: { baseFret: 1, frets: [0, 2, 2, 2, 0, 0] },
  Gsus4: { baseFret: 1, frets: [3, 3, 0, 0, 1, 3] },
  Asus4: { baseFret: 1, frets: [-1, 0, 2, 2, 3, 0] },
  Asus2: { baseFret: 1, frets: [-1, 0, 2, 2, 0, 0] },

  // Add/other common worship voicings
  Cadd9: { baseFret: 1, frets: [-1, 3, 2, 0, 3, 0] },
  Gadd9: { baseFret: 1, frets: [3, 0, 0, 2, 0, 3] },
  Em9: { baseFret: 1, frets: [0, 2, 0, 0, 0, 2] },
  D2: { baseFret: 1, frets: [-1, -1, 0, 2, 3, 0] },
};

/**
 * Resolve a chord name to a shape. Order: the song's own {define:}
 * definitions, exact dictionary hit, then progressively simplified names
 * (slash bass dropped, extensions dropped, bare root).
 * @returns {{ name: string, baseFret: number, frets: number[], fingers?: number[]|null } | null}
 */
export function resolveChordShape(chordName, definitions = {}) {
  if (!chordName) return null;
  const candidates = [];
  const trimmed = chordName.trim();
  candidates.push(trimmed);
  // Drop slash bass: G/B → G
  const noSlash = trimmed.split("/")[0];
  if (noSlash !== trimmed) candidates.push(noSlash);
  // Root + minor quality: Am7b5 → Am; root only: Gsus4 → G
  const rootMinor = noSlash.match(/^([A-G][#b]?m?)/);
  if (rootMinor && rootMinor[1] !== noSlash) candidates.push(rootMinor[1]);
  const rootOnly = noSlash.match(/^([A-G][#b]?)/);
  if (rootOnly && rootOnly[1] !== noSlash) candidates.push(rootOnly[1]);

  for (const candidate of candidates) {
    if (definitions[candidate]) return { name: candidate, ...definitions[candidate] };
    if (GUITAR_SHAPES[candidate]) return { name: candidate, ...GUITAR_SHAPES[candidate] };
  }
  return null;
}
