import { describe, it, expect } from "vitest";
import { chordToNashville, nashvilleChordPro } from "@vpc-music/shared";

describe("Nashville Number System", () => {
  // ===================== chordToNashville =====================

  describe("chordToNashville", () => {
    // — Major chords in key of C —
    it("C → 1 in key of C", () => {
      expect(chordToNashville("C", "C")).toBe("1");
    });

    it("D → 2 in key of C", () => {
      expect(chordToNashville("D", "C")).toBe("2");
    });

    it("E → 3 in key of C", () => {
      expect(chordToNashville("E", "C")).toBe("3");
    });

    it("F → 4 in key of C", () => {
      expect(chordToNashville("F", "C")).toBe("4");
    });

    it("G → 5 in key of C", () => {
      expect(chordToNashville("G", "C")).toBe("5");
    });

    it("A → 6 in key of C", () => {
      expect(chordToNashville("A", "C")).toBe("6");
    });

    it("B → 7 in key of C", () => {
      expect(chordToNashville("B", "C")).toBe("7");
    });

    // — Minor chords with quality preserved —
    it("Am → 6m in key of C", () => {
      expect(chordToNashville("Am", "C")).toBe("6m");
    });

    it("Em7 → 3m7 in key of C", () => {
      expect(chordToNashville("Em7", "C")).toBe("3m7");
    });

    it("Dm → 2m in key of C", () => {
      expect(chordToNashville("Dm", "C")).toBe("2m");
    });

    // — Sharp/flat chords —
    it("F# → b5 in key of C", () => {
      expect(chordToNashville("F#", "C")).toBe("b5");
    });

    it("Bb → b7 in key of C", () => {
      expect(chordToNashville("Bb", "C")).toBe("b7");
    });

    it("Eb → b3 in key of C", () => {
      expect(chordToNashville("Eb", "C")).toBe("b3");
    });

    // — Different keys —
    it("D → 1 in key of D", () => {
      expect(chordToNashville("D", "D")).toBe("1");
    });

    it("G → 4 in key of D", () => {
      expect(chordToNashville("G", "D")).toBe("4");
    });

    it("A → 5 in key of D", () => {
      expect(chordToNashville("A", "D")).toBe("5");
    });

    it("Bm → 6m in key of D", () => {
      expect(chordToNashville("Bm", "D")).toBe("6m");
    });

    it("E → 5 in key of A", () => {
      expect(chordToNashville("E", "A")).toBe("5");
    });

    it("F#m → 2m in key of E", () => {
      expect(chordToNashville("F#m", "E")).toBe("2m");
    });

    // — Flat key songs —
    it("Bb → 1 in key of Bb", () => {
      expect(chordToNashville("Bb", "Bb")).toBe("1");
    });

    it("Eb → 4 in key of Bb", () => {
      expect(chordToNashville("Eb", "Bb")).toBe("4");
    });

    it("F → 5 in key of Bb", () => {
      expect(chordToNashville("F", "Bb")).toBe("5");
    });

    // — Complex qualities —
    it("Gsus4 → 5sus4 in key of C", () => {
      expect(chordToNashville("Gsus4", "C")).toBe("5sus4");
    });

    it("Cmaj7 → 1maj7 in key of C", () => {
      expect(chordToNashville("Cmaj7", "C")).toBe("1maj7");
    });

    it("Bdim → 7dim in key of C", () => {
      expect(chordToNashville("Bdim", "C")).toBe("7dim");
    });

    it("Fadd9 → 4add9 in key of C", () => {
      expect(chordToNashville("Fadd9", "C")).toBe("4add9");
    });

    // — Slash chords —
    it("C/E → 1/3 in key of C", () => {
      expect(chordToNashville("C/E", "C")).toBe("1/3");
    });

    it("G/B → 5/7 in key of C", () => {
      expect(chordToNashville("G/B", "C")).toBe("5/7");
    });

    it("Am/G → 6m/5 in key of C", () => {
      expect(chordToNashville("Am/G", "C")).toBe("6m/5");
    });

    // — Edge cases —
    it("returns chord as-is when no key provided", () => {
      expect(chordToNashville("Am", "")).toBe("Am");
    });

    it("returns chord as-is when empty chord", () => {
      expect(chordToNashville("", "C")).toBe("");
    });

    it("returns chord as-is when not a valid chord", () => {
      expect(chordToNashville("N.C.", "C")).toBe("N.C.");
    });
  });

  // ===================== nashvilleChordPro =====================

  describe("nashvilleChordPro", () => {
    it("converts all bracketed chords to Nashville numbers", () => {
      const input = "[G]Amazing [C]grace, [D]how sweet";
      const result = nashvilleChordPro(input, "G");
      expect(result).toBe("[1]Amazing [4]grace, [5]how sweet");
    });

    it("preserves chord quality in ChordPro conversion", () => {
      const input = "[Am]Why do [F]I [G]feel";
      const result = nashvilleChordPro(input, "C");
      expect(result).toBe("[6m]Why do [4]I [5]feel");
    });

    it("handles slash chords in ChordPro", () => {
      const input = "[C]Start [G/B]walk [Am]down";
      const result = nashvilleChordPro(input, "C");
      expect(result).toBe("[1]Start [5/7]walk [6m]down");
    });

    it("returns input as-is when no key provided", () => {
      const input = "[C]Hello [G]world";
      expect(nashvilleChordPro(input, "")).toBe("[C]Hello [G]world");
    });

    it("handles multiple sections", () => {
      const input = "{start_of_verse}\n[D]Verse [A]line\n{end_of_verse}\n{start_of_chorus}\n[G]Chorus [D]line\n{end_of_chorus}";
      const result = nashvilleChordPro(input, "D");
      expect(result).toContain("[1]Verse [5]line");
      expect(result).toContain("[4]Chorus [1]line");
    });
  });

  // ===================== Source-level checks =====================

  describe("source-level checks", () => {
    it("NASHVILLE_NUMBERS constant exists in shared", async () => {
      const fs = await import("fs");
      const src = fs.readFileSync("../../shared/constants/music.js", "utf-8");
      expect(src).toContain("NASHVILLE_NUMBERS");
    });

    it("nashville.js is exported from shared/index.js", async () => {
      const fs = await import("fs");
      const src = fs.readFileSync("../../shared/index.js", "utf-8");
      expect(src).toContain("nashville.js");
    });

    it("ChordProRenderer accepts nashville prop", async () => {
      const fs = await import("fs");
      const src = fs.readFileSync("src/components/songs/ChordProRenderer.tsx", "utf-8");
      expect(src).toContain("nashville?:");
      expect(src).toContain("chordToNashville");
    });

    it("SongChartPage toolbar has a Nashville toggle", async () => {
      const fs = await import("fs");
      const toolbar = fs.readFileSync("src/components/songs/ChartToolbar.tsx", "utf-8");
      expect(toolbar).toContain("onToggleNashville");
      expect(toolbar).toContain("Nashville numbers");
      // The toggle lives in the chart view both the member page and a share link render.
      const view = fs.readFileSync("src/components/songs/ChartView.tsx", "utf-8");
      expect(view).toContain("onToggleNashville");
      expect(fs.readFileSync("src/pages/songs/SongChartPage.tsx", "utf-8")).toContain("<ChartView");
    });

    it("SharedSongPage has Nashville toggle", async () => {
      const fs = await import("fs");
      // A share link renders the same chart view, toolbar and all.
      const src = fs.readFileSync("src/pages/SharedSongPage.tsx", "utf-8");
      expect(src).toContain("<ChartView");
    });
  });
});
