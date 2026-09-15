/**
 * Tempo from taps: tap along with the song and read the BPM.
 *
 * The first tap only starts the clock. From the second on, the tempo is the
 * average gap across the last eight taps (seven gaps), so it settles as you
 * keep tapping and one late tap barely moves it. A pause longer than
 * RESTART_MS starts over, so stopping and tapping again measures afresh
 * instead of averaging in the pause.
 */

export const TAPS_AVERAGED = 8;
/** 3 seconds between taps is 20 BPM, the slowest tempo the song field takes. */
export const RESTART_MS = 3000;
export const MIN_BPM = 20;
export const MAX_BPM = 300;

/** The taps to keep after a new one at `now`: the last eight, or a fresh start after a pause. */
export function addTap(taps: number[], now: number): number[] {
  const last = taps[taps.length - 1];
  if (last === undefined || now - last > RESTART_MS || now <= last) return [now];
  return [...taps, now].slice(-TAPS_AVERAGED);
}

/** Whole BPM from the kept taps, or null until there are two. */
export function tempoFromTaps(taps: number[]): number | null {
  if (taps.length < 2) return null;
  const averageGap = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
  if (averageGap <= 0) return null;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(60000 / averageGap)));
}
