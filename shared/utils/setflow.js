/**
 * flow — the consolidated public API for set-list flow analysis.
 *
 * A thin FACADE over the primitives in ./flow.js. It adds no analysis of its
 * own beyond presentation: every signal, the energy curve, and the timing math
 * come straight from flow.js's analyze() — the single source of truth. What
 * this layer adds is ergonomics:
 *
 *   analyze(items, options)  — accepts the public snake_case set shape
 *                              (song_id / song_key / duration_seconds / …) and
 *                              treats `live_ready` (not just `ready`) as stage
 *                              ready; re-presents transitions as { from, to,
 *                              grade, note }.
 *   keyTransition(from, to)  — grades a key change: same | smooth | ok |
 *                              notable | harsh (relative & parallel major/minor
 *                              are smooth; enharmonic-equal keys are same).
 *   fmt(seconds)             — "m:ss" for display.
 *
 * Exported NAMESPACED from @vpc-music/shared as `flow` (see index.js) so its
 * analyze() doesn't clash with flow.js's flat analyze() export.
 */
import {
  analyze as analyzeBase,
  circleDistance,
  keyPitchClass,
} from "./flow.js";

// Statuses that count as stage-ready. flow.js's primitive only knows "ready",
// so ready-ish values are normalized to it before analysis.
const READY_STATUSES = new Set(["ready", "live_ready"]);

/**
 * Grade a key change: { grade, note? }.
 *  same    — enharmonically the same key (Db → C#)
 *  smooth  — adjacent on the circle, or relative/parallel major-minor
 *  ok      — two or three steps
 *  notable — four steps
 *  harsh   — five or six steps
 */
export function keyTransition(fromKey, toKey) {
  const a = keyPitchClass(fromKey);
  const b = keyPitchClass(toKey);
  if (!a || !b) return { grade: "unknown" };

  if (a.pitch === b.pitch && a.minor === b.minor) return { grade: "same" };
  if (a.pitch === b.pitch && a.minor !== b.minor) return { grade: "smooth", note: "parallel key" };

  const distance = circleDistance(fromKey, toKey);
  if (a.minor !== b.minor && distance === 0) return { grade: "smooth", note: "relative key" };

  let grade;
  if (distance <= 1) grade = "smooth";
  else if (distance <= 3) grade = "ok";
  else if (distance === 4) grade = "notable";
  else grade = "harsh";

  return grade === "smooth"
    ? { grade }
    : { grade, note: `${distance} steps on the circle of fifths` };
}

/** Format seconds as "m:ss" (or "-m:ss" for a negative duration). */
export function fmt(seconds) {
  const value = seconds ?? 0;
  const negative = value < 0;
  const total = Math.round(Math.abs(value));
  const minutes = Math.floor(total / 60);
  return `${negative ? "-" : ""}${minutes}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Analyze a set list (in running order). Items accept the public snake_case
 * shape or the flow.js camelCase shape. Options: { targetSeconds,
 * recentlyPlayed, gapSeconds }. Returns { curve, keys, transitions, timing,
 * signals } — transitions carry { from, to, grade, note }.
 */
export function analyze(items, options = {}) {
  const mapped = items.map((it) => {
    const status = it.status ?? null;
    return {
      songId: it.song_id ?? it.songId ?? null,
      title: it.title ?? "Song",
      key: it.song_key ?? it.key ?? null,
      bpm: it.bpm ?? null,
      energy: it.energy ?? null,
      durationSeconds: it.duration_seconds ?? it.durationSeconds ?? 0,
      talkSeconds: it.talk_seconds ?? it.talkSeconds ?? 0,
      status: status && READY_STATUSES.has(status) ? "ready" : status,
    };
  });

  const base = analyzeBase(mapped, options);

  const transitions = base.transitions.map((t) => {
    const { grade, note } = keyTransition(t.fromKey, t.toKey);
    return { fromIndex: t.fromIndex, toIndex: t.toIndex, from: t.fromKey, to: t.toKey, grade, note };
  });

  return { ...base, transitions };
}
