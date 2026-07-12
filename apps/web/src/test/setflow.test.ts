import { describe, it, expect } from "vitest";
import { flow } from "@vpc-music/shared";

const { analyze, keyTransition, fmt } = flow;

describe("flow — key transitions", () => {
  it("G→D adjacent → smooth", () => expect(keyTransition("G", "D").grade).toBe("smooth"));
  it("C→Am relative → smooth", () => expect(keyTransition("C", "Am").grade).toBe("smooth"));
  it("C→Cm parallel → smooth", () => expect(keyTransition("C", "Cm").grade).toBe("smooth"));
  it("C→F# tritone → harsh", () => expect(keyTransition("C", "F#").grade).toBe("harsh"));
  it("G→Eb → notable", () => expect(keyTransition("G", "Eb").grade).toBe("notable"));
  it("C→D two steps → ok", () => expect(keyTransition("C", "D").grade).toBe("ok"));
  it("C→A three steps → ok (not notable)", () => expect(keyTransition("C", "A").grade).toBe("ok"));
  it("enharmonic Db→C# → same", () => expect(keyTransition("Db", "C#").grade).toBe("same"));
});

describe("flow — fmt", () => {
  it("formats m:ss with zero-padding", () => {
    expect(fmt(1410)).toBe("23:30");
    expect(fmt(80)).toBe("1:20");
    expect(fmt(1200)).toBe("20:00");
  });

  it("formats a negative duration with a leading minus, not clamped to zero", () => {
    expect(fmt(-90)).toBe("-1:30");
  });
});

describe("flow — analyze a deliberately bad set", () => {
  const set = [
    { song_id: 1, title: "Still Waters", song_key: "C", bpm: 64, duration_seconds: 290, status: "live_ready" },
    { song_id: 2, title: "Quiet Ground", song_key: "Am", bpm: 66, duration_seconds: 305, status: "live_ready" },
    { song_id: 3, title: "Slow Burn", song_key: "F", bpm: 62, duration_seconds: 270, status: "learning" },
    { song_id: 4, title: "Sharp Turn", song_key: "F#", bpm: 128, duration_seconds: 215, status: "live_ready" },
    { song_id: 5, title: "Last Light", song_key: "B", bpm: 58, duration_seconds: 330, status: "rehearsed" },
  ];
  const r = analyze(set, { targetSeconds: 20 * 60, recentlyPlayed: [1, 2, 3, 5] });
  const types = r.signals.map((s) => s.type);

  it("catches energy plateau", () => expect(types).toContain("energy_plateau"));
  it("catches key clash", () => expect(types).toContain("key_clash"));
  it("catches an unrehearsed song", () => expect(types).toContain("not_ready"));
  it("catches soft close", () => expect(types).toContain("soft_close"));
  it("catches repeat set", () => expect(types).toContain("repeat_set"));
  it("catches over-time", () => expect(types).toContain("over_time"));
  it("counts gaps (4 × 20s)", () => expect(r.timing.gapSeconds).toBe(80));
  it("total = music + gaps", () => expect(r.timing.totalSeconds).toBe(1410 + 80));

  it("grades the F→F# jump as harsh and C→Am as smooth", () => {
    const grades = Object.fromEntries(r.transitions.map((t) => [`${t.from}->${t.to}`, t.grade]));
    expect(grades["F->F#"]).toBe("harsh");
    expect(grades["C->Am"]).toBe("smooth");
  });
});

describe("flow — a well-built set is quiet", () => {
  const good = [
    { song_id: 9, title: "Open Road", song_key: "G", bpm: 118, duration_seconds: 200, status: "live_ready" },
    { song_id: 10, title: "Higher", song_key: "D", bpm: 132, duration_seconds: 210, status: "live_ready" },
    { song_id: 11, title: "Hold On", song_key: "Em", bpm: 88, duration_seconds: 240, status: "live_ready" },
    { song_id: 12, title: "Rise", song_key: "C", bpm: 124, duration_seconds: 225, status: "live_ready" },
  ];
  const g = analyze(good, { targetSeconds: 20 * 60 });

  it("raises no warnings", () => {
    expect(g.signals.filter((s) => s.severity === "warn")).toHaveLength(0);
  });
});
