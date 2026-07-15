import { describe, it, expect } from "vitest";
import { parseChordPro, toChordProString } from "@vpc-music/shared";

describe("parseChordPro", () => {
  it("extracts directives from the header", () => {
    const input = `{title: Amazing Grace}
{artist: John Newton}
{key: G}`;
    const doc = parseChordPro(input);
    expect(doc.directives).toEqual({
      title: "Amazing Grace",
      artist: "John Newton",
      key: "G",
    });
    expect(doc.sections).toHaveLength(0);
  });

  it("parses inline chords into structured objects", () => {
    const input = `[G]Amazing [C]grace how [G]sweet the sound`;
    const doc = parseChordPro(input);
    expect(doc.sections).toHaveLength(1);
    const line = doc.sections[0].lines[0];
    expect(line.lyrics).toBe("Amazing grace how sweet the sound");
    expect(line.chords).toEqual([
      { chord: "G", position: 0 },
      { chord: "C", position: 8 },
      { chord: "G", position: 18 },
    ]);
  });

  it("handles comment directives as section names", () => {
    const input = `{comment: Verse 1}
[G]Amazing [C]grace

{comment: Chorus}
[D]Through many [G]dangers`;
    const doc = parseChordPro(input);
    expect(doc.sections).toHaveLength(2);
    expect(doc.sections[0].name).toBe("Verse 1");
    expect(doc.sections[1].name).toBe("Chorus");
  });

  it("handles start_of_chorus / end_of_chorus", () => {
    const input = `{soc}
[G]Praise the Lord
{eoc}`;
    const doc = parseChordPro(input);
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0].name).toBe("Chorus");
  });

  it("splits on blank lines as section breaks", () => {
    const input = `[G]Line one

[D]Line two`;
    const doc = parseChordPro(input);
    expect(doc.sections).toHaveLength(2);
  });

  it("returns empty sections for empty input", () => {
    const doc = parseChordPro("");
    expect(doc.directives).toEqual({});
    expect(doc.sections).toHaveLength(0);
  });

  it("handles lines with no chords", () => {
    const input = "Just plain lyrics";
    const doc = parseChordPro(input);
    expect(doc.sections[0].lines[0].lyrics).toBe("Just plain lyrics");
    expect(doc.sections[0].lines[0].chords).toEqual([]);
  });
});

describe("toChordProString", () => {
  it("round-trips a simple document", () => {
    const input = `{title: Test Song}
{key: G}

{comment: Verse 1}
[G]Hello [C]world`;
    const doc = parseChordPro(input);
    const output = toChordProString(doc);
    expect(output).toContain("{title: Test Song}");
    expect(output).toContain("{key: G}");
    expect(output).toContain("{comment: Verse 1}");
    expect(output).toContain("[G]Hello [C]world");
  });

  it("preserves directives in output", () => {
    const doc = {
      directives: { title: "My Song", artist: "Me" },
      sections: [],
    };
    const output = toChordProString(doc);
    expect(output).toContain("{title: My Song}");
    expect(output).toContain("{artist: Me}");
  });
});

describe("parseChordPro — environments (verse/bridge/tab)", () => {
  it("opens a Verse section from {sov} and closes on {eov}", () => {
    const input = `{sov}
[G]Amazing grace
{eov}
[C]After the verse`;
    const doc = parseChordPro(input);
    expect(doc.sections[0].name).toBe("Verse");
    expect(doc.sections[0].lines).toHaveLength(1);
    expect(doc.sections[1].name).toBe("");
  });

  it("honors a label on {start_of_verse: Verse 2}", () => {
    const doc = parseChordPro(`{start_of_verse: Verse 2}\n[G]Line\n{end_of_verse}`);
    expect(doc.sections[0].name).toBe("Verse 2");
  });

  it("opens a Bridge section from {sob}", () => {
    const doc = parseChordPro(`{sob}\n[Em]Bridge line\n{eob}`);
    expect(doc.sections[0].name).toBe("Bridge");
  });

  it("keeps tab content verbatim — no chord extraction", () => {
    const input = `{sot}
e|--0--2--3--|
B|--[1]--3---|
{eot}`;
    const doc = parseChordPro(input);
    expect(doc.sections[0].name).toBe("Tab");
    expect(doc.sections[0].raw).toBe(true);
    // The [1] inside the tab must NOT be eaten as a chord token
    expect(doc.sections[0].lines[1].lyrics).toBe("B|--[1]--3---|");
    expect(doc.sections[0].lines[1].chords).toHaveLength(0);
  });
});

describe("parseChordPro — chord definitions", () => {
  it("parses {define:} into chordDefinitions", () => {
    const doc = parseChordPro(`{define: G base-fret 1 frets 3 2 0 0 0 3}\n[G]Line`);
    expect(doc.chordDefinitions?.G).toEqual({
      name: "G",
      baseFret: 1,
      frets: [3, 2, 0, 0, 0, 3],
      fingers: null,
    });
  });

  it("parses muted strings and fingers", () => {
    const doc = parseChordPro(`{define: C base-fret 1 frets x 3 2 0 1 0 fingers x 3 2 0 1 0}`);
    expect(doc.chordDefinitions?.C.frets).toEqual([-1, 3, 2, 0, 1, 0]);
    expect(doc.chordDefinitions?.C.fingers).toEqual([-1, 3, 2, 0, 1, 0]);
  });

  it("ignores malformed define values", () => {
    const doc = parseChordPro(`{define: nonsense}`);
    expect(doc.chordDefinitions).toEqual({});
  });
});
