import { describe, it, expect } from "vitest";
import { parseChart, chartToText, transposeChart, parseBarLine } from "@vpc-music/shared";

// Deliberately gnarly: comments, directives, sections (including [Ending],
// which parses as a chord under naive grammars), unpadded pipes, a bar row
// with trailing whitespace, an annotation token, indentation, and blanks.
const GNARLY = [
  "{title: Amazing Grace}",
  "{key: G}",
  "# arranger note — keep the ritard",
  "",
  "[Intro]",
  "| G | C/E | D |",
  "|Em|C|  ",
  "",
  "[Verse 1]",
  "[G]Amazing [C]grace how [D]sweet",
  "   indented plain lyric",
  "",
  "[Ending]",
  "| G  D/F# |  C x2 | G |",
].join("\n");

describe("chart AST", () => {
  describe("round-trip losslessness", () => {
    it("chartToText(parseChart(x)) is byte-identical for gnarly input", () => {
      expect(chartToText(parseChart(GNARLY))).toBe(GNARLY);
    });

    it("preserves CRLF, trailing spaces, and odd spacing verbatim", () => {
      const input = "{title: T}\r\n| G |  C |\r\n  [G]lyric  ";
      expect(chartToText(parseChart(input))).toBe(input);
    });

    it("zero-net transpose returns the same object", () => {
      const chart = parseChart(GNARLY);
      expect(transposeChart(chart, 0)).toBe(chart);
      expect(transposeChart(chart, 12)).toBe(chart);
      expect(transposeChart(chart, -12)).toBe(chart);
    });
  });

  describe("line classification", () => {
    const chart = parseChart(GNARLY);
    const types = chart.lines.map((l) => l.type);

    it("classifies every line", () => {
      expect(types).toEqual([
        "directive", "directive", "comment", "blank",
        "section", "bars", "bars", "blank",
        "section", "lyric", "lyric", "blank",
        "section", "bars",
      ]);
    });

    it("[Ending] is a section, never a chord", () => {
      const ending = chart.lines[12];
      expect(ending.type).toBe("section");
      expect(ending.name).toBe("Ending");
    });

    it("directives keep key and value", () => {
      expect(chart.lines[0]).toMatchObject({ type: "directive", key: "title", value: "Amazing Grace" });
    });

    it("lyric parts classify bracket tokens with the strict grammar", () => {
      const verse = chart.lines[9];
      const tokens = verse.parts.filter((p) => p.type === "token");
      expect(tokens.map((t) => t.value)).toEqual(["G", "C", "D"]);
      expect(tokens.every((t) => t.isChord)).toBe(true);
    });
  });

  describe("parseBarLine", () => {
    it("tokenizes unpadded pipes", () => {
      const row = parseBarLine("|Em|C|");
      expect(row.measures).toEqual([
        [{ type: "chord", value: "Em" }],
        [{ type: "chord", value: "C" }],
      ]);
    });

    it("keeps annotations as text tokens alongside chords", () => {
      const row = parseBarLine("| C x2 | . . G |");
      expect(row.measures[0]).toEqual([
        { type: "chord", value: "C" },
        { type: "text", value: "x2" },
      ]);
      expect(row.measures[1]).toEqual([
        { type: "text", value: "." },
        { type: "text", value: "." },
        { type: "chord", value: "G" },
      ]);
    });

    it("tolerates a missing trailing pipe and preserves empty measures", () => {
      expect(parseBarLine("| G | C").measures).toHaveLength(2);
      expect(parseBarLine("| G |  | C |").measures).toEqual([
        [{ type: "chord", value: "G" }],
        [],
        [{ type: "chord", value: "C" }],
      ]);
    });

    it("returns null for non-bar lines", () => {
      expect(parseBarLine("[G]Amazing grace")).toBeNull();
    });
  });

  describe("transposeChart", () => {
    it("transposes bars and inline chords with target-key flat spelling", () => {
      const up3 = transposeChart(parseChart(GNARLY), 3, true); // G → Bb
      expect(up3.lines[5].raw).toBe("| Bb | Eb/G | F |");
      expect(up3.lines[6].raw).toBe("|Gm|Eb|  ");
      expect(up3.lines[9].raw).toBe("[Bb]Amazing [Eb]grace how [F]sweet");
    });

    it("leaves sections, comments, directives, and annotations untouched", () => {
      const up3 = transposeChart(parseChart(GNARLY), 3, true);
      expect(up3.lines[2].raw).toBe("# arranger note — keep the ritard");
      expect(up3.lines[4].raw).toBe("[Intro]");
      expect(up3.lines[12].raw).toBe("[Ending]");
      expect(up3.lines[13].raw).toContain("x2");
    });

    it("agrees with the flat string engine by construction (round-trip via text)", () => {
      const chart = parseChart(GNARLY);
      const there = transposeChart(chart, 3, true);
      const back = transposeChart(there, 9, false); // +3 then +9 = +12 net
      // Not byte-identical through a real round-trip (spelling may normalize),
      // but structurally every chord returns to its original pitch class.
      const chordsOf = (c) =>
        c.lines
          .filter((l) => l.type === "bars")
          .flatMap((l) => l.measures.flat())
          .filter((t) => t.type === "chord")
          .map((t) => t.value);
      expect(chordsOf(back).join(" ").replace(/F#/g, "Gb")).toBe(
        chordsOf(chart).join(" ").replace(/F#/g, "Gb"),
      );
    });
  });
});
