import { describe, expect, it } from "vitest";
import { classifyChartLine, mergeByPosition } from "../corpus/pdfSong.js";
import { itemToElement, readChartHeader } from "../corpus/pdfTextLocal.js";

describe("classifyChartLine", () => {
  it("recognises section headers as these charts actually write them", () => {
    expect(classifyChartLine("Intro")).toMatchObject({ type: "section", name: "Intro" });
    expect(classifyChartLine("Verse 1")).toMatchObject({ type: "section", name: "Verse 1" });
    // the cases the generic classifier misses
    expect(classifyChartLine("Verse 1 & 2")).toMatchObject({ type: "section", name: "Verse 1 & 2" });
    expect(classifyChartLine("Chorus (2x)")).toMatchObject({ type: "section", name: "Chorus", note: "2x" });
    expect(classifyChartLine("Pre-Chorus")).toMatchObject({ type: "section" });
  });

  it("keeps a cross-reference rather than dropping it", () => {
    const r = classifyChartLine("Verse 3 & Verse 4 (same as Verse 1 & 2)");
    expect(r.type).toBe("section");
    expect(r.name).toBe("Verse 3 & Verse 4");
    expect(r.note).toBe("same as Verse 1 & 2");
  });

  it("treats performance directions as notes, not sections", () => {
    expect(classifyChartLine("1st time only:")).toMatchObject({ type: "note" });
    expect(classifyChartLine("(a cappella)")).toMatchObject({ type: "note" });
  });

  it("recognises a chord-only line", () => {
    expect(classifyChartLine("E B F# G#m").type).toBe("chord");
    expect(classifyChartLine("G#m F#/A# B").type).toBe("chord");
  });

  it("treats everything else as lyrics", () => {
    expect(classifyChartLine("Way maker, miracle worker").type).toBe("lyric");
    expect(classifyChartLine("1. You are here moving in our midst.").type).toBe("lyric");
  });

  it("does not mistake a lyric that starts with a section word", () => {
    // "Bridge over troubled water" is a lyric, not a section — it runs on.
    expect(classifyChartLine("Bridge over troubled water carries me home today").type).toBe("lyric");
  });
});

describe("mergeByPosition", () => {
  const el = (text, x, width) => ({ text, x, width });

  it("places each chord at the lyric character nearest its x", () => {
    const chords = { elements: [el("C", 0, 8), el("G", 40, 8)] };
    const lyric = { elements: [el("Hello there friend", 0, 80)] };
    const out = mergeByPosition(chords, lyric);
    expect(out.startsWith("[C]")).toBe(true);
    expect(out).toContain("[G]");
    // the plain text survives once the chords are stripped
    expect(out.replace(/\[[^\]]+\]/g, "")).toBe("Hello there friend");
  });

  it("never stacks two chords on the same character", () => {
    const chords = { elements: [el("C", 0, 8), el("G", 1, 8), el("D", 2, 8)] };
    const lyric = { elements: [el("abcdefgh", 0, 80)] };
    const out = mergeByPosition(chords, lyric);
    expect(out.match(/\[[^\]]+\]/g)).toHaveLength(3);
    expect(out).not.toMatch(/\]\[/);
  });

  it("keeps a chord that falls past the end of the lyric", () => {
    const chords = { elements: [el("C", 0, 8), el("G", 500, 8)] };
    const lyric = { elements: [el("Hi", 0, 10)] };
    const out = mergeByPosition(chords, lyric);
    expect(out.replace(/\[[^\]]+\]/g, "")).toBe("Hi");
    expect(out).toContain("[G]");
  });

  it("returns null for an empty lyric rather than inventing a line", () => {
    expect(mergeByPosition({ elements: [el("C", 0, 8)] }, { elements: [] })).toBeNull();
  });
});

describe("itemToElement", () => {
  it("flips the y axis from PDF's bottom-left origin to top-down", () => {
    // THE bug that would silently reverse every chart. A run near the TOP of a
    // 800pt page sits at a high PDF y, and must come back as a small y.
    const top = itemToElement({ str: "Title", transform: [28, 0, 0, 28, 72, 760], width: 90, fontName: "g_d0_f1" }, 800, 0);
    const bottom = itemToElement({ str: "Footer", transform: [9, 0, 0, 9, 72, 40], width: 50, fontName: "g_d0_f1" }, 800, 0);
    expect(top.y).toBe(40);
    expect(bottom.y).toBe(760);
    expect(top.y).toBeLessThan(bottom.y);
  });

  it("carries font size and style through", () => {
    const e = itemToElement(
      { str: "x", transform: [11, 0, 0, 11, 10, 700], width: 6, fontName: "f1" },
      800, 2, { f1: { fontFamily: "Helvetica-Bold" } },
    );
    expect(e.fontSize).toBe(11);
    expect(e.fontIsBold).toBe(true);
    expect(e.pageIndex).toBe(2);
  });
});

describe("readChartHeader", () => {
  /** Build the elements a line of text would produce. */
  const line = (text, { y, size = 10, x = 72 }) =>
    text.split(" ").map((word, i) => ({
      text: word, x: x + i * 30, y, width: word.length * 5,
      height: size, fontName: "f", fontSize: size, fontIsBold: false, fontIsItalic: false, pageIndex: 0,
    }));

  it("reads the dense credit line these charts carry", () => {
    const els = [
      ...line("Written by Brian Johnson, Chris Tomlin", { y: 30, size: 11 }),
      ...line("Holy Forever", { y: 60, size: 28 }),
      ...line('CeCe Winans – "Holy Forever (Single)" Key: F Tempo: 72 Time: 4/4', { y: 80, size: 10 }),
    ];
    const h = readChartHeader(els, { filename: "Holy-Forever-Chord-Chart.pdf" });
    expect(h.title).toBe("Holy Forever");
    expect(h.artist).toBe("CeCe Winans");
    expect(h.key).toBe("F");
    expect(h.tempo).toBe(72);
    expect(h.time).toBe("4/4");
    expect(h.album).toBe("Holy Forever (Single)");
    expect(h.writers).toMatch(/Brian Johnson/);
  });

  it("drops the publisher credit rather than storing it as an artist", () => {
    const els = [
      ...line("Heaven", { y: 60, size: 28 }),
      ...line('UPCI Music – "Heaven (Single)" Key: E Tempo: 110 Time: 4/4', { y: 80, size: 10 }),
    ];
    expect(readChartHeader(els).artist).toBeNull();
  });

  it("falls back to the filename when there is no text to read", () => {
    expect(readChartHeader([], { filename: "Way-Maker-Chord-Chart.pdf" }).title).toBeNull();
  });
});
