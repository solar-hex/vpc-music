import { describe, it, expect } from "vitest";
import {
  analyze,
  circleDistance,
  circlePosition,
  songEnergy,
  DEFAULT_GAP_SECONDS,
  flow,
} from "@vpc-music/shared";

const song = (overrides = {}) => ({
  songId: overrides.songId ?? "s1",
  title: "Song",
  key: "G",
  bpm: 100,
  durationSeconds: 240,
  status: "ready",
  ...overrides,
});

describe("flow engine — circle of fifths", () => {
  it("places minor keys at their relative major (the classic bug)", () => {
    // Em and G share a key signature → same position
    expect(circlePosition("Em")).toBe(circlePosition("G"));
    // Em → C is a one-step move, not four
    expect(circleDistance("Em", "C")).toBe(1);
    // Measuring from the minor root would give 4 — make sure we don't
    expect(circleDistance("E", "C")).toBe(4);
  });

  it("computes distances both ways around the circle", () => {
    expect(circleDistance("C", "G")).toBe(1);
    expect(circleDistance("C", "F")).toBe(1);
    expect(circleDistance("C", "F#")).toBe(6);
    expect(circleDistance("G", "Bb")).toBe(3);
  });

  it("resolves unusual enharmonic roots (Cb, Fb, E#, B#) via the shared pitch table", () => {
    // keyPitchClass delegates to transpose.js's noteIndex rather than keeping
    // its own note table — B# (== C) used to fall through both.
    expect(circleDistance("B#", "D")).toBe(2); // C -> D
    expect(circlePosition("B#")).toBe(circlePosition("C"));
  });

  // Grading (smooth/ok/notable/harsh) lives in the flow facade's
  // keyTransition(), which also special-cases parallel/relative major-minor —
  // raw circle distance alone can't. Full grading matrix is covered in
  // apps/web/src/test/setflow.test.ts; this just confirms it's reachable here.
  it("grades transition quality via the flow facade", () => {
    expect(flow.keyTransition("C", "G").grade).toBe("smooth");
    expect(flow.keyTransition("C", "D").grade).toBe("ok");
    expect(flow.keyTransition("C", "A").grade).toBe("ok");
    expect(flow.keyTransition("C", "E").grade).toBe("notable");
    expect(flow.keyTransition("C", "F#").grade).toBe("harsh");
    expect(flow.keyTransition("C", null).grade).toBe("unknown");
  });
});

describe("flow engine — energy", () => {
  it("derives energy 1-5 from BPM bands", () => {
    expect(songEnergy({ bpm: 60 })).toBe(1);
    expect(songEnergy({ bpm: 75 })).toBe(2);
    expect(songEnergy({ bpm: 100 })).toBe(3);
    expect(songEnergy({ bpm: 120 })).toBe(4);
    expect(songEnergy({ bpm: 140 })).toBe(5);
    expect(songEnergy({})).toBe(null);
  });

  it("explicit energy override beats BPM", () => {
    // A 70bpm anthem carries more weight than the BPM band suggests
    expect(songEnergy({ bpm: 70, energy: 5 })).toBe(5);
  });
});

describe("flow engine — timing includes gaps", () => {
  it("adds changeover gaps and talk time to music time", () => {
    const items = [
      song({ durationSeconds: 300, talkSeconds: 60 }),
      song({ durationSeconds: 300 }),
      song({ durationSeconds: 300 }),
    ];
    const { timing } = analyze(items, { targetSeconds: 20 * 60 });
    expect(timing.musicSeconds).toBe(900);
    expect(timing.gapSeconds).toBe(2 * DEFAULT_GAP_SECONDS + 60);
    expect(timing.totalSeconds).toBe(900 + 2 * DEFAULT_GAP_SECONDS + 60);
  });

  it("fires over_time using the gap-inclusive total", () => {
    // 3 × 14min music = 42min fits a 45min slot… until gaps push it over
    const items = [
      song({ durationSeconds: 14 * 60, talkSeconds: 120 }),
      song({ durationSeconds: 14 * 60, talkSeconds: 120 }),
      song({ durationSeconds: 14 * 60 }),
    ];
    const { signals } = analyze(items, { targetSeconds: 45 * 60 });
    expect(signals.some((signal) => signal.type === "over_time")).toBe(true);
  });

  it("fires under_time when 5+ minutes go unused", () => {
    const { signals } = analyze([song({ durationSeconds: 240 })], { targetSeconds: 20 * 60 });
    expect(signals.some((signal) => signal.type === "under_time")).toBe(true);
  });
});

describe("flow engine — signals", () => {
  it("flags key clashes 4+ steps apart", () => {
    const items = [song({ key: "C" }), song({ key: "E" })]; // 4 steps
    const { signals } = analyze(items);
    const clash = signals.find((signal) => signal.type === "key_clash");
    expect(clash).toBeTruthy();
    expect(clash.severity).toBe("info");
  });

  it("does not flag relative-minor moves", () => {
    const items = [song({ key: "Em" }), song({ key: "G" }), song({ key: "C" })];
    const { signals } = analyze(items);
    expect(signals.some((signal) => signal.type === "key_clash")).toBe(false);
  });

  it("flags 3+ songs at the same energy as a plateau", () => {
    const items = [song({ bpm: 100 }), song({ bpm: 95 }), song({ bpm: 105 }), song({ bpm: 140 })];
    const { signals } = analyze(items);
    const plateau = signals.find((signal) => signal.type === "energy_plateau");
    expect(plateau).toBeTruthy();
    expect(plateau.index).toBe(0);
  });

  it("flags a flat curve when the set spans ≤1 energy level", () => {
    const items = [song({ bpm: 95 }), song({ bpm: 100 }), song({ bpm: 115 })];
    const { signals } = analyze(items);
    expect(signals.some((signal) => signal.type === "flat_curve")).toBe(true);
  });

  it("flags songs that aren't stage-ready", () => {
    const items = [song(), song({ title: "New One", status: "in_rehearsal" })];
    const { signals } = analyze(items);
    const notReady = signals.find((signal) => signal.type === "not_ready");
    expect(notReady).toBeTruthy();
    expect(notReady.message).toContain("New One");
  });

  it("flags soft open and soft close on the lowest-energy song", () => {
    const items = [song({ bpm: 60 }), song({ bpm: 140 }), song({ bpm: 60 })];
    const { signals } = analyze(items);
    expect(signals.some((signal) => signal.type === "soft_open")).toBe(true);
    expect(signals.some((signal) => signal.type === "soft_close")).toBe(true);
  });

  it("flags a repeat set when 70%+ matches the last event", () => {
    const items = [song({ songId: "a" }), song({ songId: "b" }), song({ songId: "c" })];
    const { signals } = analyze(items, { recentlyPlayed: ["a", "b", "x"] });
    // 2/3 = 66% → no signal
    expect(signals.some((signal) => signal.type === "repeat_set")).toBe(false);
    const repeat = analyze(items, { recentlyPlayed: ["a", "b", "c"] }).signals.find(
      (signal) => signal.type === "repeat_set",
    );
    expect(repeat).toBeTruthy();
  });

  it("stays quiet on a well-shaped set", () => {
    const items = [
      song({ songId: "a", key: "G", bpm: 125, durationSeconds: 240 }),
      song({ songId: "b", key: "D", bpm: 140, durationSeconds: 240 }),
      song({ songId: "c", key: "Em", bpm: 90, durationSeconds: 240 }),
      song({ songId: "d", key: "C", bpm: 72, energy: 4, durationSeconds: 240 }),
      song({ songId: "e", key: "G", bpm: 130, durationSeconds: 240 }),
    ];
    const { signals } = analyze(items, { targetSeconds: 22 * 60, recentlyPlayed: ["x", "y"] });
    expect(signals).toEqual([]);
  });
});
