import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { chordProToOnSong, onSongToChordPro } from "@vpc-music/shared";

describe("OnSong Converter", () => {
  // ===================== BASIC CONVERSION =====================
  describe("basic conversion", () => {
    it("converts title directive to OnSong metadata", () => {
      const input = "{title: Amazing Grace}\n[G]Amazing grace";
      const result = chordProToOnSong(input);
      expect(result).toContain("Title: Amazing Grace");
    });

    it("converts artist directive to OnSong metadata", () => {
      const input = "{artist: John Newton}\n[G]Amazing grace";
      const result = chordProToOnSong(input);
      expect(result).toContain("Artist: John Newton");
    });

    it("converts key directive to OnSong metadata", () => {
      const input = "{key: G}\n[G]Amazing grace";
      const result = chordProToOnSong(input);
      expect(result).toContain("Key: G");
    });

    it("converts tempo directive to OnSong metadata", () => {
      const input = "{tempo: 120}\n[G]Amazing grace";
      const result = chordProToOnSong(input);
      expect(result).toContain("Tempo: 120");
    });

    it("preserves inline chords in brackets", () => {
      const input = "[G]Amazing [C]grace";
      const result = chordProToOnSong(input);
      expect(result).toContain("[G]Amazing [C]grace");
    });

    it("converts comment directives to section labels", () => {
      const input = "{comment: Verse 1}\n[G]Amazing grace";
      const result = chordProToOnSong(input);
      expect(result).toContain("Verse 1:");
    });

    it("converts chorus section markers", () => {
      const input = "{start_of_chorus}\n[G]Sing out\n{end_of_chorus}";
      const result = chordProToOnSong(input);
      expect(result).toContain("Chorus:");
    });

    it("separates metadata from content with blank line", () => {
      const input = "{title: Test Song}\n{key: C}\n[C]Hello world";
      const result = chordProToOnSong(input);
      const lines = result.split("\n");
      // After metadata lines, there should be a blank line
      const keyIdx = lines.findIndex((l) => l.startsWith("Key:"));
      const contentStart = lines.findIndex((l, i) => i > keyIdx && l.trim() !== "");
      // There should be at least one blank line between metadata and content
      expect(contentStart).toBeGreaterThan(keyIdx + 1);
    });

    it("handles multiple sections", () => {
      const input = "{comment: Verse 1}\n[G]Line one\n\n{comment: Chorus}\n[C]Chorus line";
      const result = chordProToOnSong(input);
      expect(result).toContain("Verse 1:");
      expect(result).toContain("Chorus:");
    });

    it("preserves lyrics without chords", () => {
      const input = "Just a plain line of text";
      const result = chordProToOnSong(input);
      expect(result).toContain("Just a plain line of text");
    });

    it("handles empty input", () => {
      const result = chordProToOnSong("");
      expect(result).toBeDefined();
    });

    it("handles song with only directives", () => {
      const input = "{title: Empty Song}\n{key: D}";
      const result = chordProToOnSong(input);
      expect(result).toContain("Title: Empty Song");
      expect(result).toContain("Key: D");
    });
  });

  // ===================== EDGE CASES =====================
  describe("edge cases", () => {
    it("handles complex chord with slash", () => {
      const input = "[G/B]Walking along";
      const result = chordProToOnSong(input);
      expect(result).toContain("[G/B]Walking along");
    });

    it("handles chord-only lines (no lyrics)", () => {
      const input = "[G] [C] [D]";
      const result = chordProToOnSong(input);
      expect(result).toContain("[G]");
    });

    it("handles multiple directives at start", () => {
      const input = "{title: My Song}\n{artist: Me}\n{key: E}\n{tempo: 140}\nHello";
      const result = chordProToOnSong(input);
      expect(result).toContain("Title: My Song");
      expect(result).toContain("Artist: Me");
      expect(result).toContain("Key: E");
      expect(result).toContain("Tempo: 140");
    });
  });

  // ===================== IMPORT TO CHORDPRO =====================
  describe("OnSong/OpenSong import", () => {
    it("converts OnSong metadata back to ChordPro directives", () => {
      const input = "Title: Amazing Grace\nArtist: John Newton\nKey: G\nTempo: 72\n\nVerse 1:\n[G]Amazing [C]grace";
      const result = onSongToChordPro(input);

      expect(result).toContain("{title: Amazing Grace}");
      expect(result).toContain("{artist: John Newton}");
      expect(result).toContain("{key: G}");
      expect(result).toContain("{tempo: 72}");
      expect(result).toContain("{comment: Verse 1}");
      expect(result).toContain("[G]Amazing [C]grace");
    });

    it("preserves plain lyric lines during OnSong import", () => {
      const input = "Title: Test\n\nVerse 1:\nJust a plain line";
      const result = onSongToChordPro(input);
      expect(result).toContain("Just a plain line");
    });

    it("converts OpenSong XML metadata and lyrics to ChordPro", () => {
      const input = `
<song>
  <title>How Great Thou Art</title>
  <author>Carl Boberg</author>
  <key>G</key>
  <tempo>88</tempo>
  <lyrics>[V1]
[G]O Lord my God
[C]When I in awesome wonder
[C]
[C]
[C]Consider all
[C]the worlds Thy Hands have made</lyrics>
</song>`.trim();

      const result = onSongToChordPro(input);

      expect(result).toContain("{title: How Great Thou Art}");
      expect(result).toContain("{artist: Carl Boberg}");
      expect(result).toContain("{key: G}");
      expect(result).toContain("{tempo: 88}");
      expect(result).toContain("{comment: Verse 1}");
      expect(result).toContain("[G]O Lord my God");
    });

    it("returns empty string for empty input", () => {
      expect(onSongToChordPro("")).toBe("");
    });
  });

  // ===================== SOURCE-LEVEL =====================
  describe("source-level", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../../../shared/utils/onsong.js"),
      "utf-8",
    );

    it("exports chordProToOnSong function", () => {
      expect(src).toContain("export function chordProToOnSong");
    });

    it("exports onSongToChordPro function", () => {
      expect(src).toContain("export function onSongToChordPro");
    });

    it("exports docToOnSong function", () => {
      expect(src).toContain("export function docToOnSong");
    });

    it("imports parseChordPro from chordpro.js", () => {
      expect(src).toContain('import { parseChordPro');
    });
  });
});
