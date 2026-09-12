import { describe, expect, it } from "vitest";
import { parseChordPro } from "@vpc-music/shared";
import {
  convertLyricSheetToChordPro,
  isChordLine,
  mergeChordLine,
  normalizeSectionLabel,
} from "../corpus/lyricSheet.js";

/** The "5. Imported" shape: title + key, bracketed chords over lyrics. */
const WITH_CHORDS = [
  "Amazing grace        [F]",
  "",
  "Chorus",
  "[F]     [F/A]     [Bb]       [F]",
  "Amazing grace how sweet the sound",
  "     [Dm]     [G]        [C]  [C/E]",
  "That saved a wretch like me",
  "",
  "V1",
  "  [F]   [Bb]",
  "T'was grace that taught",
];

/** The "1. Incomplete" shape: lyrics only, blank paragraph between each line. */
const LYRICS_ONLY = [
  "Just a little talk with Jesus - 174",
  "",
  "Chorus",
  "",
  "Now let us have a little talk with Jesus,",
  "",
  "Tell Him all about our troubles",
  "",
  "V1",
  "",
  "I once was lost in sin, but Jesus took me in",
];

describe("normalizeSectionLabel", () => {
  it("maps the shorthand these documents use", () => {
    expect(normalizeSectionLabel("V1")).toBe("Verse 1");
    expect(normalizeSectionLabel("V 2")).toBe("Verse 2");
    expect(normalizeSectionLabel("Verse 3")).toBe("Verse 3");
    expect(normalizeSectionLabel("Verse II")).toBe("Verse 2");
    expect(normalizeSectionLabel("Chorus")).toBe("Chorus");
    expect(normalizeSectionLabel("Ch")).toBe("Chorus");
    expect(normalizeSectionLabel("Br")).toBe("Bridge");
    expect(normalizeSectionLabel("Pre-Chorus")).toBe("Pre-Chorus");
    expect(normalizeSectionLabel("Tag:")).toBe("Tag");
  });

  it("rejects anything that is not a section label", () => {
    expect(normalizeSectionLabel("I go to the rock of my salvation")).toBeNull();
    expect(normalizeSectionLabel("")).toBeNull();
    expect(normalizeSectionLabel("V")).toBeNull(); // too ambiguous
    expect(normalizeSectionLabel("Amazing grace how sweet the sound")).toBeNull();
  });

  it("produces labels the engine recognises as sections", () => {
    // Round-trip through the parser: each must open a real section.
    const doc = parseChordPro(`{comment: ${normalizeSectionLabel("V1")}}\nla`);
    expect(doc.sections[0].name).toBe("Verse 1");
  });
});

describe("isChordLine", () => {
  it("recognises a bracketed chord line", () => {
    expect(isChordLine("[F]     [F/A]     [Bb]       [F]")).toBe(true);
    expect(isChordLine("  [Dm]  [G]")).toBe(true);
  });

  it("rejects lyrics, section labels and blanks", () => {
    expect(isChordLine("Amazing grace how sweet the sound")).toBe(false);
    expect(isChordLine("Chorus")).toBe(false);
    expect(isChordLine("")).toBe(false);
    // text outside the brackets means it is already a merged lyric line
    expect(isChordLine("[F]Amazing grace")).toBe(false);
  });
});

describe("mergeChordLine", () => {
  it("attaches each chord at the column it was written at", () => {
    expect(mergeChordLine("[F]  [C]", "Hello there")).toBe("[F]Hello[C] there");
  });

  it("keeps a chord that runs past the end of the lyric", () => {
    expect(mergeChordLine("[F]        [C]", "Hi")).toBe("[F]Hi[C]");
  });

  it("returns the lyric untouched when there are no chords", () => {
    expect(mergeChordLine("   ", "Hello")).toBe("Hello");
  });
});

describe("convertLyricSheetToChordPro", () => {
  it("converts a chorded sheet, merging chords onto the lyrics", () => {
    const r = convertLyricSheetToChordPro("Amazing grace.docx", WITH_CHORDS);
    expect(r.title).toBe("Amazing grace");
    expect(r.metadata.key).toBe("F");
    expect(r.metadata.hasChords).toBe(true);
    expect(r.confidence.band).toBe("high");
    expect(r.chordProContent).toContain("{title: Amazing grace}");
    expect(r.chordProContent).toContain("{key: F}");
    expect(r.chordProContent).toContain("[F]Amazing ");
    expect(r.chordProContent).toContain("{comment: Verse 1}");

    const doc = parseChordPro(r.chordProContent);
    expect(doc.sections.map((s) => s.name)).toEqual(["Chorus", "Verse 1"]);
  });

  it("keeps a lyrics-only sheet lyrics-only and never invents chords", () => {
    const r = convertLyricSheetToChordPro("Just a little talk.docx", LYRICS_ONLY);
    expect(r.metadata.hasChords).toBe(false);
    expect(r.chordProContent).not.toMatch(/\[[A-G]/);
    expect(r.warnings.join(" ")).toMatch(/Lyrics only/);
    expect(r.confidence.band).toBe("low");
  });

  it("does not shatter verses on the blank paragraph between every line", () => {
    // The source has a blank line between each lyric; in ChordPro a blank line
    // is a section break, so emitting them would make one-line sections.
    const r = convertLyricSheetToChordPro("x.docx", LYRICS_ONLY);
    const doc = parseChordPro(r.chordProContent);
    expect(doc.sections.map((s) => s.name)).toEqual(["Chorus", "Verse 1"]);
    expect(doc.sections[0].lines).toHaveLength(2);
  });

  it("lifts a hymnal number out of the title into a note", () => {
    const r = convertLyricSheetToChordPro("x.docx", LYRICS_ONLY);
    expect(r.title).toBe("Just a little talk with Jesus");
    expect(r.metadata.hymnalNumber).toBe("174");
    expect(r.chordProContent).toContain("{subtitle: Hymnal 174}");
  });

  it("takes a bare trailing key off the title, but not a chord-shaped word", () => {
    expect(convertLyricSheetToChordPro("a.docx", ["I got the Lord      G"]).metadata.key).toBe("G");
    expect(convertLyricSheetToChordPro("a.docx", ["I got the Lord      G"]).title).toBe("I got the Lord");
    // "Am" after a single space is part of the title, not a key
    const great = convertLyricSheetToChordPro("b.docx", ["The great I Am"]);
    expect(great.title).toBe("The great I Am");
    expect(great.metadata.key).toBeNull();
  });

  it("always marks a Word import as a draft", () => {
    expect(convertLyricSheetToChordPro("a.docx", WITH_CHORDS).metadata.isDraft).toBe(true);
    expect(convertLyricSheetToChordPro("a.docx", LYRICS_ONLY).metadata.isDraft).toBe(true);
  });

  it("falls back to the filename when the document has no title", () => {
    const r = convertLyricSheetToChordPro("I go to the rock.docx", ["", "Chorus", "la la"]);
    // first non-blank line is "Chorus", which is a section — so the title is empty
    expect(r.title).toBeTruthy();
  });

  it("is deterministic", () => {
    const a = convertLyricSheetToChordPro("x.docx", WITH_CHORDS);
    const b = convertLyricSheetToChordPro("x.docx", WITH_CHORDS);
    expect(a.chordProContent).toBe(b.chordProContent);
    expect(a.confidence).toEqual(b.confidence);
  });
});
