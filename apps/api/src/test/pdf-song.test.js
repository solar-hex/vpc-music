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
  /**
   * Build the elements a line of text would produce, laid out the way a real
   * PDF does: each word directly after the last with one space between, so the
   * gap-aware reconstruction sees exactly one space.
   */
  const line = (text, { y, size = 10, x = 72 }) => {
    const charWidth = size * 0.5;
    let cursor = x;
    return text.split(" ").map((word) => {
      const el = {
        text: word, x: cursor, y, width: word.length * charWidth,
        height: size, fontName: "f", fontSize: size, fontIsBold: false, fontIsItalic: false, pageIndex: 0,
      };
      cursor += el.width + charWidth; // the space
      return el;
    });
  };

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

describe("run reconstruction", () => {
  const run = (text, x, width, fontSize = 10) => ({ text, x, width, fontSize });

  it("joins runs pdf.js split mid-chord", async () => {
    const { coalesceRuns } = await import("../corpus/pdfSong.js");
    // "Bm7" arrives as "Bm" + "7"; "A/C#" as "A/C" + "#".
    const out = coalesceRuns([run("Bm", 0, 10), run("7", 10, 5), run("A/C", 60, 15), run("#", 75, 5)]);
    expect(out.map((t) => t.text)).toEqual(["Bm7", "A/C#"]);
  });

  it("splits a run that carries a whole chord line inside it", async () => {
    const { coalesceRuns } = await import("../corpus/pdfSong.js");
    // The other direction: one run holding "D    A/C#   Bm7".
    const out = coalesceRuns([run("D    A/C#   Bm7", 0, 150)]);
    expect(out.map((t) => t.text)).toEqual(["D", "A/C#", "Bm7"]);
    expect(out[0].x).toBeLessThan(out[1].x);
    expect(out[1].x).toBeLessThan(out[2].x);
  });

  it("does not insert a space where there is only kerning", async () => {
    const { renderLine } = await import("../corpus/pdfSong.js");
    // This is the bug that cost most of the chords: "Bm7" must not read "Bm 7".
    expect(renderLine([run("Bm", 0, 10), run("7", 10, 5)]).text).toBe("Bm7");
  });

  it("keeps a real gap as a space", async () => {
    const { renderLine } = await import("../corpus/pdfSong.js");
    expect(renderLine([run("D", 0, 8), run("G", 60, 8)]).text).toMatch(/^D\s+G$/);
  });

  it("reports an x for every character it emits", async () => {
    const { renderLine } = await import("../corpus/pdfSong.js");
    const r = renderLine([run("abc", 0, 30), run("def", 60, 30)]);
    expect(r.xs).toHaveLength(r.text.length);
  });
});

describe("flat keys", () => {
  it("reads Bb as Bb, not B", async () => {
    // pdf.js splits "Bb" into "B" + "b". Joining with a space made `Key: Bb`
    // read as `Key: B`, and every chord then transposed from the wrong tonic.
    const { readChartHeader } = await import("../corpus/pdfTextLocal.js");
    const size = 10;
    const cw = size * 0.5;
    const runs = [];
    let x = 72;
    for (const piece of ["Key:", " ", "B", "b", " ", "Tempo:", " ", "70"]) {
      if (piece === " ") { x += cw; continue; }
      runs.push({
        text: piece, x, y: 80, width: piece.length * cw,
        height: size, fontName: "f", fontSize: size, fontIsBold: false, fontIsItalic: false, pageIndex: 0,
      });
      x += piece.length * cw;
    }
    const title = [{
      text: "Complete Surrender", x: 72, y: 50, width: 18 * 14,
      height: 28, fontName: "f", fontSize: 28, fontIsBold: true, fontIsItalic: false, pageIndex: 0,
    }];
    const h = readChartHeader([...title, ...runs]);
    expect(h.key).toBe("Bb");
    expect(h.tempo).toBe(70);
  });

  it("still reads a natural key as itself", async () => {
    const { readChartHeader } = await import("../corpus/pdfTextLocal.js");
    const el = (text, x, size = 10) => ({
      text, x, y: 80, width: text.length * size * 0.5,
      height: size, fontName: "f", fontSize: size, fontIsBold: false, fontIsItalic: false, pageIndex: 0,
    });
    const h = readChartHeader([
      { ...el("Way Maker", 72, 28), y: 50, fontSize: 28 },
      el("Key:", 72), el("B", 95),
    ]);
    expect(h.key).toBe("B");
  });
});

describe("the credit column", () => {
  /** One run on the page, positioned exactly where the real charts put it. */
  const run = (text, { x, y, size }) => ({
    text, x, y, width: text.length * size * 0.5,
    height: size, fontName: "f", fontSize: size, fontIsBold: false, fontIsItalic: false, pageIndex: 0,
  });

  it("does not read the right-aligned writer credit as part of the title", async () => {
    const { readChartHeader } = await import("../corpus/pdfTextLocal.js");
    // The exact layout of It-is-Well-Chord-Chart.pdf: "Written by" is a small
    // label at x=525, and the writer's name sits at x=498 on the SAME baseline
    // as the title at x=36 — so reading left to right titled the song
    // "It Is Well Horatio Spafford" and lost the writer.
    const h = readChartHeader([
      run("Written by", { x: 525, y: 30, size: 11 }),
      run("It Is Well", { x: 36, y: 60, size: 28 }),
      run("Horatio Spafford", { x: 498, y: 60, size: 28 }),
      run("Key: C Tempo: 104 Time: 4/4", { x: 36, y: 80, size: 10 }),
    ]);
    expect(h.title).toBe("It Is Well");
    expect(h.writers).toBe("Horatio Spafford");
    expect(h.key).toBe("C");
    expect(h.tempo).toBe(104);
  });

  it("leaves a title alone when the page carries no such label", async () => {
    const { readChartHeader } = await import("../corpus/pdfTextLocal.js");
    // Without the "Written by" label the split must not fire, or a genuine
    // two-part title laid out across the page would be truncated.
    const h = readChartHeader([
      run("Go Tell It", { x: 36, y: 60, size: 28 }),
      run("Wonderful Child", { x: 400, y: 60, size: 28 }),
      run("Key: F", { x: 36, y: 80, size: 10 }),
    ]);
    expect(h.title).toBe("Go Tell It Wonderful Child");
  });

  it("refuses a title that is really a page of chords", async () => {
    const { readChartHeader } = await import("../corpus/pdfTextLocal.js");
    // One chart has no large type at all, so every body line was "the title"
    // and the song came out named with its whole first page.
    const body = "INTRO [Ab-Bb-Cb-C-Eb-F-Gb-F] | (x2) [Ab-Bb-Cb-C] Db/Gb Cbmaj7 Db9 | CHORUS Ye shall have the power";
    const h = readChartHeader([run(body, { x: 36, y: 60, size: 11 })], { filename: "Power-Chord-Chart.pdf" });
    expect(h.title).toBe("Power Chord Chart");
  });
});

describe("artistFromLine", () => {
  it("takes the performer from the line under the title", async () => {
    const { artistFromLine } = await import("../corpus/pdfSong.js");
    expect(artistFromLine("Sinach")).toBe("Sinach");
    expect(artistFromLine("Indiana Bible College")).toBe("Indiana Bible College");
  });

  it("keeps the performer and drops the album beside it", async () => {
    const { artistFromLine } = await import("../corpus/pdfSong.js");
    expect(artistFromLine('Eddie James - "Magnify"')).toBe("Eddie James");
  });

  it("refuses the arrangement, which is what sits there on a chart with no credit", async () => {
    const { artistFromLine } = await import("../corpus/pdfSong.js");
    // These two were stored as artists: an artist never opens with a section
    // word, and a name never contains a chord.
    expect(artistFromLine("Intro F G C")).toBeNull();
    expect(artistFromLine("Intro Chorus (Parts) (2x)")).toBeNull();
    expect(artistFromLine("| Dm C/E Dm |")).toBeNull();
    expect(artistFromLine("Key: C Tempo: 104")).toBeNull();
  });
});
