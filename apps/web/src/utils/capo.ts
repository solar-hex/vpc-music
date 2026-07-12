import { CHROMATIC_SHARP, CHROMATIC_FLAT } from "@vpc-music/shared";

// Re-exported for back-compat; the canonical formatter lives in lib/format.
export { formatDuration } from "@/lib/format";

export type CapoDifficulty = "EASY" | "MODERATE" | "DIFFICULT";

export interface CapoOption {
  capo: number;
  /** Shape key: what the guitarist plays with the capo on. */
  shapeKey: string;
  difficulty: CapoDifficulty;
}

function keyIndex(key: string): number {
  const normalized = key.trim();
  const sharpIdx = CHROMATIC_SHARP.indexOf(normalized);
  if (sharpIdx !== -1) return sharpIdx;
  return CHROMATIC_FLAT.indexOf(normalized);
}

/** Semitone distance from one key to another, normalized to (-6, 6]. */
export function semitonesBetween(fromKey: string, toKey: string): number {
  const from = keyIndex(fromKey);
  const to = keyIndex(toKey);
  if (from === -1 || to === -1) return 0;
  let diff = to - from;
  if (diff > 6) diff -= 12;
  if (diff <= -6) diff += 12;
  return diff;
}

function transposeKeyName(key: string, steps: number): string {
  const idx = keyIndex(key);
  if (idx === -1) return key;
  const scale = key.includes("b") ? CHROMATIC_FLAT : CHROMATIC_SHARP;
  return scale[(idx + steps + 120) % 12];
}

// Open-chord shapes guitarists prefer; capo suggestions aim for one of these.
const OPEN_SHAPES = ["C", "A", "G", "E", "D", "Am", "Em", "Dm"];

function difficultyFor(capo: number): CapoDifficulty {
  return capo <= 2 ? "EASY" : capo <= 5 ? "MODERATE" : "DIFFICULT";
}

/**
 * Suggest capo positions to play `targetKey` using friendlier open-chord
 * shapes. Ordered by fret (lowest first), skipping capo 0 (no capo needed).
 */
export function suggestCapoOptions(targetKey: string): CapoOption[] {
  const target = keyIndex(targetKey);
  if (target === -1) return [];

  const options: CapoOption[] = [];
  for (let capo = 1; capo <= 7; capo++) {
    const shapeKey = transposeKeyName(targetKey, -capo);
    if (OPEN_SHAPES.includes(shapeKey)) {
      options.push({ capo, shapeKey, difficulty: difficultyFor(capo) });
    }
  }
  return options;
}
