import { ALL_KEYS, normalizeEnharmonicKey } from "@vpc-music/shared";

/**
 * Computes the "distance" in semitones between two musical keys.
 * Returns the minimum of clockwise and counter-clockwise distance (0–6).
 *
 * Returns null if either key is not in ALL_KEYS.
 *
 * Distances:
 *   0       → same key (perfect)
 *   1–2     → close keys (easy transition)
 *   3–4     → moderate
 *   5–6     → distant (awkward)
 */
export function getKeyDistance(key1: string, key2: string): number | null {
  const i1 = ALL_KEYS.indexOf(normalizeEnharmonicKey(key1));
  const i2 = ALL_KEYS.indexOf(normalizeEnharmonicKey(key2));
  if (i1 === -1 || i2 === -1) return null;

  const diff = Math.abs(i1 - i2);
  return Math.min(diff, 12 - diff);
}

/**
 * Returns a human-friendly label for a key distance.
 */
export function keyTransitionLabel(distance: number | null): { label: string; level: "good" | "ok" | "warn" } {
  if (distance === null) return { label: "Unknown", level: "ok" };
  if (distance === 0) return { label: "Same key", level: "good" };
  if (distance <= 2) return { label: "Close", level: "good" };
  if (distance <= 4) return { label: "Moderate", level: "ok" };
  return { label: "Distant", level: "warn" };
}

/**
 * Checks all adjacent songs in a setlist and returns transition warnings.
 */
export interface KeyTransition {
  fromIndex: number;
  toIndex: number;
  fromKey: string;
  toKey: string;
  distance: number;
  level: "good" | "ok" | "warn";
}

export function analyzeKeyTransitions(
  songs: { key?: string | null; songKey?: string | null }[]
): KeyTransition[] {
  const transitions: KeyTransition[] = [];
  for (let i = 0; i < songs.length - 1; i++) {
    const k1 = songs[i].key || songs[i].songKey;
    const k2 = songs[i + 1].key || songs[i + 1].songKey;
    if (!k1 || !k2) continue;
    const dist = getKeyDistance(k1, k2);
    if (dist === null) continue;
    const { level } = keyTransitionLabel(dist);
    transitions.push({
      fromIndex: i,
      toIndex: i + 1,
      fromKey: k1,
      toKey: k2,
      distance: dist,
      level,
    });
  }
  return transitions;
}
