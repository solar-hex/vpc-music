/**
 * Set flow analysis — energy curve, key transitions, timing, and advisory
 * signals for a set list. Pure and O(n); safe to run client-side on every
 * reorder. All signals are advisory — nothing here blocks anything.
 *
 * Two corrections every naive implementation misses:
 *  - Minor keys sit at their RELATIVE MAJOR's position on the circle of
 *    fifths (Em and G share a signature, so Em → C is one step, not four).
 *  - Duration must include gaps: track lengths alone lie. A default
 *    changeover gap per song plus optional per-item talk time is added.
 */

// Circle of fifths positions keyed by pitch class (C=0 … B=11)
const FIFTHS_POSITION = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: 7, 8: 8, 3: 9, 10: 10, 5: 11 };

const NOTE_INDEX = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, F: 5, "E#": 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
};

export const DEFAULT_GAP_SECONDS = 20;

/**
 * Parse a key into its pitch class (0-11) and mode. Returns null for
 * unparseable keys. ("Bb" → {pitch:10, minor:false}, "Em" → {pitch:4, minor:true})
 */
export function keyPitchClass(key) {
  const match = String(key || "").trim().match(/^([A-G][b#]?)\s*(m|min|minor)?/i);
  if (!match || !match[1]) return null;
  const root = match[1][0].toUpperCase() + (match[1][1] ?? "");
  const pitch = NOTE_INDEX[root];
  if (pitch === undefined) return null;
  return { pitch, minor: Boolean(match[2]) };
}

/**
 * Position of a key on the circle of fifths (0-11), with minor keys mapped
 * to their relative major. Returns null for unparseable keys.
 */
export function circlePosition(key) {
  const info = keyPitchClass(key);
  if (!info) return null;
  // Relative major of a minor key is 3 semitones up
  const pitch = info.minor ? (info.pitch + 3) % 12 : info.pitch;
  return FIFTHS_POSITION[pitch];
}

/** Steps between two keys around the circle of fifths (0-6). */
export function circleDistance(fromKey, toKey) {
  const from = circlePosition(fromKey);
  const to = circlePosition(toKey);
  if (from === null || to === null) return null;
  const diff = Math.abs(from - to);
  return Math.min(diff, 12 - diff);
}

/** Transition quality between adjacent keys. */
export function transitionQuality(fromKey, toKey) {
  const distance = circleDistance(fromKey, toKey);
  if (distance === null) return "unknown";
  if (distance <= 1) return "smooth";
  if (distance <= 2) return "ok";
  if (distance <= 3) return "notable";
  return "harsh";
}

/**
 * Energy 1-5. Explicit per-song energy wins; otherwise derived from BPM
 * (<70 → 1, 70-89 → 2, 90-109 → 3, 110-129 → 4, 130+ → 5). Null when
 * neither is known.
 */
export function songEnergy(item) {
  if (item.energy != null && item.energy >= 1 && item.energy <= 5) {
    return Math.round(item.energy);
  }
  const bpm = item.bpm;
  if (bpm == null || !Number.isFinite(bpm) || bpm <= 0) return null;
  if (bpm < 70) return 1;
  if (bpm < 90) return 2;
  if (bpm < 110) return 3;
  if (bpm < 130) return 4;
  return 5;
}

/**
 * Analyze a set list.
 *
 * @param {Array<{
 *   songId?: string|null,
 *   title?: string,
 *   key?: string|null,
 *   bpm?: number|null,
 *   energy?: number|null,          // explicit 1-5 override
 *   durationSeconds?: number|null,
 *   talkSeconds?: number|null,
 *   status?: string|null,          // song rehearsal status
 * }>} items — in running order
 * @param {{ targetSeconds?: number|null, recentlyPlayed?: string[], gapSeconds?: number }} [options]
 * @returns {{ curve, keys, transitions, timing, signals }}
 */
export function analyze(items, options = {}) {
  const gapSeconds = options.gapSeconds ?? DEFAULT_GAP_SECONDS;
  const targetSeconds = options.targetSeconds ?? null;
  const recentlyPlayed = new Set(options.recentlyPlayed ?? []);

  const curve = items.map((item) => songEnergy(item));
  const keys = items.map((item) => item.key ?? null);

  // Key transitions between adjacent songs
  const transitions = [];
  for (let i = 1; i < items.length; i++) {
    const fromKey = keys[i - 1];
    const toKey = keys[i];
    transitions.push({
      fromIndex: i - 1,
      toIndex: i,
      fromKey,
      toKey,
      distance: circleDistance(fromKey, toKey),
      quality: transitionQuality(fromKey, toKey),
    });
  }

  // Timing: music + gaps (changeover + talk) vs the slot
  const musicSeconds = items.reduce((sum, item) => sum + (item.durationSeconds ?? 0), 0);
  const talkSecondsTotal = items.reduce((sum, item) => sum + (item.talkSeconds ?? 0), 0);
  const changeoverSeconds = items.length > 1 ? (items.length - 1) * gapSeconds : 0;
  const gapTotal = changeoverSeconds + talkSecondsTotal;
  const totalSeconds = musicSeconds + gapTotal;
  const timing = {
    musicSeconds,
    gapSeconds: gapTotal,
    totalSeconds,
    targetSeconds,
    overBySeconds: targetSeconds != null ? Math.max(0, totalSeconds - targetSeconds) : null,
    underBySeconds: targetSeconds != null ? Math.max(0, targetSeconds - totalSeconds) : null,
  };

  // ── Signals (all advisory) ─────────────────────
  const signals = [];

  for (const transition of transitions) {
    if (transition.distance != null && transition.distance >= 4) {
      signals.push({
        type: "key_clash",
        severity: transition.distance >= 5 ? "warn" : "info",
        index: transition.toIndex,
        message: `${transition.fromKey} → ${transition.toKey} is ${transition.distance} steps around the circle of fifths`,
      });
    }
  }

  // Energy plateau: 3+ consecutive songs at the same known level
  let runStart = 0;
  for (let i = 1; i <= curve.length; i++) {
    const sameRun = i < curve.length && curve[i] != null && curve[i] === curve[runStart];
    if (!sameRun) {
      const runLength = i - runStart;
      if (runLength >= 3 && curve[runStart] != null) {
        signals.push({
          type: "energy_plateau",
          severity: "warn",
          index: runStart,
          message: `${runLength} consecutive songs at energy ${curve[runStart]}`,
        });
      }
      runStart = i;
    }
  }

  // Flat curve: the whole set spans ≤1 energy level
  const knownEnergies = curve.filter((energy) => energy != null);
  if (items.length >= 3 && knownEnergies.length >= 3) {
    const span = Math.max(...knownEnergies) - Math.min(...knownEnergies);
    if (span <= 1) {
      signals.push({
        type: "flat_curve",
        severity: "info",
        message: "The whole set stays within one energy level",
      });
    }
  }

  // Readiness: statuses that mean "not stage-ready"
  for (let i = 0; i < items.length; i++) {
    const status = items[i].status;
    if (status && status !== "ready") {
      signals.push({
        type: "not_ready",
        severity: "warn",
        index: i,
        message: `"${items[i].title ?? "Song"}" is marked ${String(status).replace(/_/g, " ")}`,
      });
    }
  }

  // Slot fit
  if (targetSeconds != null && totalSeconds > targetSeconds) {
    signals.push({
      type: "over_time",
      severity: "warn",
      message: `Runs ${Math.ceil((totalSeconds - targetSeconds) / 60)} min over the slot (gaps included)`,
    });
  }
  if (targetSeconds != null && targetSeconds - totalSeconds >= 5 * 60 && items.length > 0) {
    signals.push({
      type: "under_time",
      severity: "info",
      message: `${Math.floor((targetSeconds - totalSeconds) / 60)} min of the slot unused`,
    });
  }

  // Soft open / close: starting or ending on the set's lowest energy
  if (knownEnergies.length >= 2) {
    const minEnergy = Math.min(...knownEnergies);
    const maxEnergy = Math.max(...knownEnergies);
    if (maxEnergy > minEnergy) {
      if (curve[0] === minEnergy) {
        signals.push({ type: "soft_open", severity: "info", index: 0, message: "Opens on the lowest-energy song" });
      }
      if (curve[curve.length - 1] === minEnergy) {
        signals.push({
          type: "soft_close",
          severity: "info",
          index: curve.length - 1,
          message: "Closes on the lowest-energy song",
        });
      }
    }
  }

  // Repeat set: 70%+ of songs were played at the last event
  const withIds = items.filter((item) => item.songId);
  if (recentlyPlayed.size > 0 && withIds.length > 0) {
    const repeats = withIds.filter((item) => recentlyPlayed.has(item.songId)).length;
    if (repeats / withIds.length >= 0.7) {
      signals.push({
        type: "repeat_set",
        severity: "info",
        message: `${Math.round((repeats / withIds.length) * 100)}% of this set was played at the last event`,
      });
    }
  }

  return { curve, keys, transitions, timing, signals };
}
