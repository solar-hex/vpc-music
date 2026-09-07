/**
 * Legacy `.chrd` conversion against the real library's conventions: chords
 * are already bracketed, drafts are marked by filename, `^` secondary lines
 * become inline `[*x]` tokens and `*` comments become `{ci}` notes.
 */
import { describe, it, expect } from "vitest";
import {
  convertChrdToChordPro,
  normalizeLegacyText,
  parseChordPro,
  toChordProString,
  transposeChordPro,
  transposeToken,
  chordProToPlainText,
  chordProToOnSong,
} from "@vpc-music/shared";

const AMAZING_GRACE = [
  "Amazing Grace",
  "G",
  "Author: John Newton",
  "Year: 1779",
  "",
  "Chorus",
  "# [G]    [G7]        [C]       [G]",
  "@ Amazing Grace! (how sweet the sound)",
  "#                         [D]",
  "@ That saved a wretch like me!",
].join("\r\n");

const JESUS_IS = [
  "Jesus Is",
  "E",
  "",
  "Verse 1",
  "* staccato chords",
  "#[E]                      [B2]",
  "@ My strength whenever I am weak",
  "^                      [e]  [gb] [a]",
  "#                [A]   [B8-Db8-Eb8]",
  "@ The one that I adore, Je - sus  is",
  "",
  "Chorus",
  "^   [ab]   [gb]            [db]      [a]",
  "#   [E]    [B]     [Cdim]  [Dbm]     [A]",
  "@ He is the Truth,    the   Life, the Way",
].join("\n");

describe("convertChrdToChordPro — real library conventions", () => {
  it("keeps already-bracketed chords single-bracketed and column-aligned", () => {
    const result = convertChrdToChordPro("amazing_grace.chrd", AMAZING_GRACE);

    expect(result.metadata).toEqual({
      title: "Amazing Grace",
      artist: "John Newton",
      key: "G",
      tempo: null,
      year: "1779",
      isDraft: false,
    });
    expect(result.chordProContent).not.toContain("[[");
    expect(result.chordProContent).toContain("{comment: Chorus}");
    // identical to the old site's own OnSong export of this song
    expect(result.chordProContent).toContain("A[G]mazing [G7]Grace! (how [C]sweet the [G]sound)");
    expect(result.chordProContent).toContain("That saved a wretch like [D]me!");
    expect(result.warnings).toEqual([]);
  });

  it("marks drafts by filename, emits [*x] secondary tokens and {ci} notes", () => {
    const result = convertChrdToChordPro("~jesus_is.chrd", JESUS_IS);

    expect(result.metadata.title).toBe("Jesus Is");
    expect(result.metadata.isDraft).toBe(true);
    expect(result.chordProContent).toContain("{ci: staccato chords}");
    expect(result.chordProContent).not.toContain("Secondary chords");
    // secondary token before the primary token when they share a column
    expect(result.chordProContent).toContain("He [*ab][E]is the [*gb][B]Truth,  [Cdim]  the   [*db][Dbm]Life, the [*a][A]Way");
    // compound tokens survive verbatim
    expect(result.chordProContent).toContain("The one that I a[A]dore, [*e][B8-Db8-Eb8]Je - [*gb]sus  [*a]is");
    expect(result.warnings).toEqual([]);
  });

  it("emits a chord-only line when a primary line has no lyric of its own", () => {
    const input = ["Title", "E", "", "[Verse 1]", "#[E]      [B]", "#[A]", "@ Sing"].join("\n");
    const result = convertChrdToChordPro("title.chrd", input);
    const lines = result.chordProContent.split("\n");

    expect(lines).toContain("{comment: Verse 1}");
    expect(lines).toContain(`[E]${" ".repeat(9)}[B]`);
    expect(lines).toContain("[A]Sing");
  });

  it("treats a section name that directly follows the key as a section, not metadata", () => {
    const result = convertChrdToChordPro("t.chrd", ["Title", "G", "Verse 1", "#[G]", "@ Hi"].join("\n"));

    expect(result.chordProContent).toContain("{comment: Verse 1}");
    expect(result.chordProContent).not.toContain("{artist:");
    expect(result.metadata.artist).toBeNull();
  });

  it("uses unlabeled header lines as artist, then subtitle, with warnings", () => {
    const input = ["Love Letter", "C", "Kevin Duncan", "September 2026", "", "Verse", "#[C]", "@ La"].join("\n");
    const result = convertChrdToChordPro("~love_letter.chrd", input);

    expect(result.metadata.artist).toBe("Kevin Duncan");
    expect(result.chordProContent).toContain("{subtitle: September 2026}");
    expect(result.warnings).toHaveLength(2);
  });

  it("cleans zero-width characters and non-ASCII spaces, with warnings", () => {
    const input = ["Title", "D", "", "Verse", "#[\u200BBm7]\u2005\u2005[G]", "@ Faithful"].join("\n");
    const result = convertChrdToChordPro("t.chrd", input);

    expect(result.chordProContent).toContain("[Bm7]");
    expect(result.chordProContent).not.toMatch(/[\u200B\u2005]/);
    expect(result.warnings.some((warning) => warning.includes("zero-width"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("non-ASCII space"))).toBe(true);
  });

  it("warns about unrecognized primary chords and missing keys", () => {
    const result = convertChrdToChordPro("t.chrd", ["Title", "", "Verse", "#[x2]", "@ Go"].join("\n"));

    expect(result.warnings).toContain("No key line found");
    expect(result.warnings).toContain('Unrecognized chord "x2"');
  });

  it("normalizeLegacyText maps typographic quotes to ASCII", () => {
    const warnings = [];
    expect(normalizeLegacyText("don’t “stop”", warnings)).toBe("don't \"stop\"");
    expect(warnings).toHaveLength(1);
  });
});

describe("ChordPro note lines and secondary tokens", () => {
  it("parses {ci} as an in-section note line and round-trips it", () => {
    const doc = parseChordPro("{title: T}\n\n{comment: Verse}\n{ci: staccato}\n[G]Go");

    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0].lines[0]).toEqual({ chords: [], lyrics: "", note: "staccato" });
    expect(doc.sections[0].lines[1].chords).toEqual([{ chord: "G", position: 0 }]);
    expect(doc.directives.ci).toBeUndefined();
    expect(toChordProString(doc)).toContain("{ci: staccato}");
  });

  it("transposes compound tokens, lowercase notes and starred secondary tokens", () => {
    expect(transposeToken("B8-Db8-Eb8", 2, true)).toBe("Db8-Eb8-F8");
    expect(transposeToken("*e-gb-ab", 2, true)).toBe("*gb-ab-bb");
    expect(transposeToken("*ab", 2, true)).toBe("*bb");
    expect(transposeToken("C-7", 2, true)).toBe("D-7");
    expect(transposeToken("C+", 2, true)).toBe("D+");
    expect(transposeToken("*staccato", 2, true)).toBe("*staccato");
    expect(transposeToken("Chorus", 2, true)).toBe("Chorus");
  });

  it("transposes secondary tokens inside charts and bracket chords on bar lines", () => {
    expect(transposeChordPro("[*ab][E]He is", 2, true)).toBe("[*bb][Gb]He is");
    expect(transposeChordPro("| [Gm7] / | [F] |", 2, false)).toBe("| [Am7] / | [G] |");
    const source = "[*e][B8-Db8-Eb8]Je - [*gb]sus";
    expect(transposeChordPro(transposeChordPro(source, 3, true), -3, true)).toBe(source);
  });

  it("prints a secondary chord row above the primary row in plain text", () => {
    const text = chordProToPlainText("{title: T}\n\n{comment: Chorus}\n{ci: slowly}\nHe [*ab][E]is the [*gb][B]Truth");

    expect(text).toBe(["T", "", "CHORUS", "* slowly", "   ab     gb", "   E      B", "He is the Truth", ""].join("\n"));
    expect(chordProToPlainText("He [*ab][E]is", { lyricsOnly: true })).toBe("He is\n");
  });

  it("exports secondary chords as a bracketed row and notes as text in OnSong", () => {
    const onsong = chordProToOnSong("{title: T}\n\n{comment: Chorus}\n{ci: slowly}\nHe [*ab][E]is the [*gb][B]Truth");

    expect(onsong).toContain("Chorus:\nslowly\n   [ab]   [gb]\nHe [E]is the [B]Truth");
    expect(onsong).not.toContain("[*");
  });
});
