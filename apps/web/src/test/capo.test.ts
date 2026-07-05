import { describe, it, expect } from "vitest";
import { suggestCapoOptions, semitonesBetween, formatDuration } from "@/utils/capo";

describe("capo utilities", () => {
  it("computes semitone distance normalized to (-6, 6]", () => {
    expect(semitonesBetween("C", "D")).toBe(2);
    expect(semitonesBetween("C", "B")).toBe(-1);
    expect(semitonesBetween("G", "C")).toBe(5);
    expect(semitonesBetween("C", "F#")).toBe(6);
    expect(semitonesBetween("C", "C")).toBe(0);
  });

  it("handles flat key names", () => {
    expect(semitonesBetween("Bb", "C")).toBe(2);
    expect(semitonesBetween("Eb", "F")).toBe(2);
  });

  it("suggests open shapes for B (capo 2 → A, capo 4 → G, capo 7 → E)", () => {
    const options = suggestCapoOptions("B");
    expect(options).toEqual([
      { capo: 2, shapeKey: "A", difficulty: "EASY" },
      { capo: 4, shapeKey: "G", difficulty: "MODERATE" },
      { capo: 7, shapeKey: "E", difficulty: "DIFFICULT" },
    ]);
  });

  it("suggests nothing helpful beyond fret 7", () => {
    for (const option of suggestCapoOptions("F#")) {
      expect(option.capo).toBeLessThanOrEqual(7);
      expect(option.capo).toBeGreaterThanOrEqual(1);
    }
  });

  it("returns empty for unknown keys", () => {
    expect(suggestCapoOptions("H")).toEqual([]);
  });

  it("formats durations", () => {
    expect(formatDuration(90)).toBe("1:30");
    expect(formatDuration(3605)).toBe("60:05");
  });
});
