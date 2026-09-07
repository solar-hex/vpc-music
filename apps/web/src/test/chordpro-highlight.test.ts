import { describe, it, expect } from "vitest";
import { tokenizeLine, tokenizeChordPro } from "@/utils/chordpro-highlight";

describe("chordpro-highlight", () => {
  // ── tokenizeLine ──

  describe("tokenizeLine", () => {
    it("tokenizes a plain lyric line", () => {
      const tokens = tokenizeLine("Amazing grace how sweet the sound");
      expect(tokens).toEqual([
        { type: "lyrics", text: "Amazing grace how sweet the sound" },
      ]);
    });

    it("tokenizes a line with chords", () => {
      const tokens = tokenizeLine("[G]Amazing [C]grace");
      expect(tokens).toEqual([
        { type: "chord", text: "[G]" },
        { type: "lyrics", text: "Amazing " },
        { type: "chord", text: "[C]" },
        { type: "lyrics", text: "grace" },
      ]);
    });

    it("tokenizes a section comment directive", () => {
      const tokens = tokenizeLine("{comment: Verse 1}");
      expect(tokens).toEqual([{ type: "section", text: "{comment: Verse 1}" }]);
    });

    it("tokenizes {c: Chorus} as a section", () => {
      const tokens = tokenizeLine("{c: Chorus}");
      expect(tokens).toEqual([{ type: "section", text: "{c: Chorus}" }]);
    });

    it("tokenizes a metadata directive", () => {
      const tokens = tokenizeLine("{title: Amazing Grace}");
      expect(tokens).toEqual([{ type: "directive", text: "{title: Amazing Grace}" }]);
    });

    it("tokenizes {key: G} as directive", () => {
      const tokens = tokenizeLine("{key: G}");
      expect(tokens).toEqual([{ type: "directive", text: "{key: G}" }]);
    });

    it("tokenizes {tempo: 120} as directive", () => {
      const tokens = tokenizeLine("{tempo: 120}");
      expect(tokens).toEqual([{ type: "directive", text: "{tempo: 120}" }]);
    });

    it("marks unclosed bracket as invalid", () => {
      const tokens = tokenizeLine("[G Amazing grace");
      expect(tokens).toEqual([{ type: "invalid", text: "[G Amazing grace" }]);
    });

    it("marks unclosed brace as invalid", () => {
      const tokens = tokenizeLine("{title: No close");
      expect(tokens).toEqual([{ type: "invalid", text: "{title: No close" }]);
    });

    it("handles mixed chords and lyrics correctly", () => {
      const tokens = tokenizeLine("[G]Amazing [G/B]grace, how [C]sweet the [G]sound");
      expect(tokens.length).toBe(8);
      expect(tokens[0]).toEqual({ type: "chord", text: "[G]" });
      expect(tokens[1]).toEqual({ type: "lyrics", text: "Amazing " });
      expect(tokens[2]).toEqual({ type: "chord", text: "[G/B]" });
      expect(tokens[3]).toEqual({ type: "lyrics", text: "grace, how " });
    });

    it("handles slash chords", () => {
      const tokens = tokenizeLine("[C/E]text");
      expect(tokens[0]).toEqual({ type: "chord", text: "[C/E]" });
    });

    it("handles complex chords like [Dm7b5]", () => {
      const tokens = tokenizeLine("[Dm7b5]some text");
      expect(tokens[0]).toEqual({ type: "chord", text: "[Dm7b5]" });
    });

    it("preserves leading whitespace as lyrics", () => {
      const tokens = tokenizeLine("  [G]indented");
      expect(tokens[0]).toEqual({ type: "lyrics", text: "  " });
      expect(tokens[1]).toEqual({ type: "chord", text: "[G]" });
    });

    it("returns empty array for empty line", () => {
      const tokens = tokenizeLine("");
      expect(tokens).toEqual([]);
    });

    it("handles standalone directive like {soc}", () => {
      const tokens = tokenizeLine("{start_of_chorus}");
      expect(tokens).toEqual([{ type: "directive", text: "{start_of_chorus}" }]);
    });
  });

  // ── tokenizeChordPro ──

  describe("tokenizeChordPro", () => {
    it("tokenizes a multi-line source", () => {
      const source = `{title: Test}
{key: G}

{comment: Verse 1}
[G]Amazing [C]grace`;
      const lines = tokenizeChordPro(source);
      expect(lines).toHaveLength(5);
      expect(lines[0][0].type).toBe("directive");
      expect(lines[1][0].type).toBe("directive");
      expect(lines[2]).toEqual([]); // blank line
      expect(lines[3][0].type).toBe("section");
      expect(lines[4][0].type).toBe("chord");
    });

    it("returns one array per line", () => {
      const source = "line1\nline2\nline3";
      expect(tokenizeChordPro(source)).toHaveLength(3);
    });
  });
});
