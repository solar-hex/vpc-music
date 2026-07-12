import { describe, it, expect } from "vitest";
import { transposeChord, transposeChordPro, composeTranspose, spellForTarget } from "@vpc-music/shared";

describe("composeTranspose", () => {
  it("combines a set-list key override into a net shift and target key", () => {
    // G stored, overridden to Bb → up 3, spelled flat
    const r = composeTranspose({ sourceKey: "G", overrideKey: "Bb" });
    expect(r.semis).toBe(3);
    expect(r.preferFlats).toBe(true);
    expect(r.displayKey).toBe("Bb");
  });

  it("adds a live nudge on top of the override, wrapping 0-11", () => {
    const r = composeTranspose({ sourceKey: "G", overrideKey: "A", nudge: -2 });
    // G→A is +2, nudge −2 → net 0
    expect(r.semis).toBe(0);
    expect(r.displayKey).toBe("G");
  });

  it("treats a no-op override (same key) as zero", () => {
    expect(composeTranspose({ sourceKey: "C", overrideKey: "C" }).semis).toBe(0);
  });

  it("returns a null display key when the source is unknown", () => {
    const r = composeTranspose({ sourceKey: null, nudge: 2 });
    expect(r.displayKey).toBeNull();
    expect(r.preferFlats).toBeUndefined();
  });
});

describe("spellForTarget", () => {
  it("spells for the target key (into a flat key → flats)", () => {
    expect(spellForTarget("G", 3)).toEqual({ preferFlats: true, targetKey: "Bb" });
  });

  it("spells sharp when the target is a sharp key", () => {
    expect(spellForTarget("G", 2)).toEqual({ preferFlats: false, targetKey: "A" });
  });

  it("is undefined-safe when the source key is missing", () => {
    expect(spellForTarget(null, 3)).toEqual({ preferFlats: undefined, targetKey: null });
  });
});

describe("transposeChord", () => {
  it("transposes a simple major chord up by 2 semitones", () => {
    expect(transposeChord("C", 2)).toBe("D");
  });

  it("transposes up wrapping around the octave", () => {
    expect(transposeChord("B", 1)).toBe("C");
  });

  it("transposes down (negative steps)", () => {
    expect(transposeChord("D", -2)).toBe("C");
  });

  it("preserves chord quality", () => {
    expect(transposeChord("Am", 2)).toBe("Bm");
    expect(transposeChord("G7", 5)).toBe("C7");
    expect(transposeChord("Dm7", 3)).toBe("Fm7");
  });

  it("handles sharp notes", () => {
    expect(transposeChord("F#", 1)).toBe("G");
    expect(transposeChord("C#m", 2)).toBe("D#m");
  });

  it("handles flat notes using flat scale", () => {
    expect(transposeChord("Bb", 2)).toBe("C");
    expect(transposeChord("Eb", 1)).toBe("E");
  });

  it("handles slash chords — transposes both parts", () => {
    expect(transposeChord("C/E", 2)).toBe("D/F#");
    expect(transposeChord("G/B", 5)).toBe("C/E");
  });

  it("returns unrecognized chords unchanged", () => {
    expect(transposeChord("N.C.", 3)).toBe("N.C.");
    expect(transposeChord("xyz", 1)).toBe("xyz");
  });

  it("transpose by 0 returns the same chord", () => {
    expect(transposeChord("G", 0)).toBe("G");
  });

  it("transpose by 12 returns the same chord", () => {
    expect(transposeChord("A", 12)).toBe("A");
  });
});

describe("transposeChordPro", () => {
  it("transposes all chords in a ChordPro string", () => {
    const input = "[G]Amazing [C]grace [D7]how sweet";
    const result = transposeChordPro(input, 2);
    expect(result).toBe("[A]Amazing [D]grace [E7]how sweet");
  });

  it("preserves lyrics and formatting", () => {
    const input = "No chords here";
    expect(transposeChordPro(input, 5)).toBe("No chords here");
  });

  it("handles empty input", () => {
    expect(transposeChordPro("", 3)).toBe("");
  });

  it("transposes across multiple lines", () => {
    const input = `[C]First line
[G]Second line`;
    const result = transposeChordPro(input, 2);
    expect(result).toBe(`[D]First line
[A]Second line`);
  });
});
