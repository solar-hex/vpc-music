import { describe, expect, it } from "vitest";
import { transposeChordPro } from "@vpc-music/shared";
import { chartBody, classifyChartLine, mergeByPosition, readChartRow } from "../corpus/pdfSong.js";
import { charOffsets, coalesceRuns, itemToElement, readChartHeader } from "../corpus/pdfTextLocal.js";

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

describe("section names as the charts write them", () => {
  it("keeps every note a section name carries", () => {
    expect(classifyChartLine("Verse 2 (Key Change) (Parts)")).toMatchObject({ type: "section", name: "Verse 2", note: "Key Change, Parts" });
    expect(classifyChartLine("Bridge 1 (Unison) (2xs)")).toMatchObject({ type: "section", name: "Bridge 1", note: "Unison, 2xs" });
  });

  it("reads a dash before a note as punctuation, not part of the name", () => {
    expect(classifyChartLine("Intro – (loop only)")).toMatchObject({ type: "section", name: "Intro", note: "loop only" });
  });

  it("reads how a section is played, written after its name", () => {
    expect(classifyChartLine("Interlude Guitars riffing")).toMatchObject({ name: "Interlude", note: "Guitars riffing" });
    expect(classifyChartLine("Intro (2x) Guitars riffing")).toMatchObject({ name: "Intro", note: "2x, Guitars riffing" });
    expect(classifyChartLine("Vamp 1& 2 same as Chorus")).toMatchObject({ name: "Vamp 1 & 2", note: "same as Chorus" });
    expect(classifyChartLine("Verse 1&2")).toMatchObject({ type: "section", name: "Verse 1 & 2" });
    expect(classifyChartLine("Chorus 1 1st time: 2x 2nd time: 1x")).toMatchObject({ name: "Chorus 1", note: "1st time: 2x 2nd time: 1x" });
    expect(classifyChartLine("Interlude to Chorus")).toMatchObject({ type: "section", name: "Interlude to Chorus" });
  });

  it("still reads a lyric that opens with a section word as a lyric", () => {
    expect(classifyChartLine("Bridge over troubled water carries me home today").type).toBe("lyric");
    expect(classifyChartLine("Chorus all the earth").type).toBe("lyric");
  });

  it("reads a road map as a note, whichever arrow arrived", () => {
    // The arrow is a symbol-font glyph that pdf.js hands back as "à".
    expect(classifyChartLine("Pre-Chorus à Chorus")).toEqual({ type: "note", text: "Pre-Chorus → Chorus" });
  });

  it("answers at once on a line built to make the match backtrack", () => {
    for (const hostile of ["Chorus " + "& ".repeat(40) + "x", "Chorus " + "1st time ".repeat(12) + "zz", "Bridge " + "(".repeat(40) + " x"]) {
      const started = performance.now();
      expect(classifyChartLine(hostile).type).toBe("lyric");
      expect(performance.now() - started).toBeLessThan(50);
    }
  });
});

describe("reading a row of a chart", () => {
  /** Words laid out as pdf.js gives them: each run with its own x. */
  const words = (...parts) =>
    parts.map(([text, x]) => ({ text, x, y: 0, width: text.length * 6, height: 11, fontSize: 11, pageIndex: 0 }));
  const kinds = (...parts) => readChartRow(words(...parts)).map((t) => `${t.kind}:${t.text}`);

  it("rejoins a bracketed note pdf.js split into words", () => {
    expect(kinds(["(cut", 324], ["music)", 354], ["Cm7", 456], ["Cm7", 480])).toEqual(["note:cut music", "chord:Cm7", "chord:Cm7"]);
  });

  it("makes a cue part of the chord it follows", () => {
    expect(kinds(["Dm7", 324], ["(hits)", 350], ["C(hits)", 400])).toEqual(["chord:Dm7(hits)", "chord:C(hits)"]);
  });

  it("peels a count off the chord it is stuck to", () => {
    expect(kinds(["Intro", 36], ["B", 80], ["G#11(2x)", 100])).toEqual(["word:Intro", "chord:B", "chord:G#11", "note:2x"]);
  });

  it("reads quick chords linked by dashes, and a hit mark, as music", () => {
    expect(kinds(["C#/E#", 36], ["-", 72], ["D#m", 84], ["-", 110], ["C#", 122], ["x", 150])).toEqual([
      "chord:C#/E#", "dash:-", "chord:D#m", "dash:-", "chord:C#", "dash:x",
    ]);
    expect(kinds(["G#m-", 36], ["Eb/G", 70])).toEqual(["chord:G#m", "dash:-", "chord:Eb/G"]);
  });

  it("reads directions written among the chords as notes", () => {
    expect(kinds(["To", 36], ["Verse:", 54], ["E2/G#", 100], ["F#/A#", 140])).toEqual(["note:To Verse", "chord:E2/G#", "chord:F#/A#"]);
    expect(kinds(["Gm7", 36], ["2nd", 70], ["time", 92], ["only:", 122], ["Cb2", 160])).toEqual(["chord:Gm7", "note:2nd time only", "chord:Cb2"]);
  });

  it("reads a passing-chord run in brackets as one chord the transposer can move", () => {
    const [run] = readChartRow(words(["(Ab", 36], ["–", 60], ["G)", 72]));
    expect(run).toMatchObject({ kind: "chord", text: "(Ab-G)" });
    expect(transposeChordPro(`[${run.text}]`, 2)).toBe("[(Bb-A)]");
  });

  it("writes every chord the way the transposer reads it", () => {
    const tokens = readChartRow(words(["G#o7", 36], ["Dº", 70], ["A#Ø7", 100], ["C7(b9/#5)", 140], ["/Ab", 210], ["Cm-G7", 240]));
    expect(tokens.map((t) => t.text)).toEqual(["G#°7", "D°", "A#ø7", "C7(b9#5)", "/Ab", "Cm-G7"]);
    for (const token of tokens) expect(transposeChordPro(`[${token.text}]`, 2)).not.toBe(`[${token.text}]`);
  });

  it("does not take the words Go and Do for chords", () => {
    expect(kinds(["Go", 36], ["Do", 60])).toEqual(["word:Go", "word:Do"]);
  });
});

describe("the body of a chart", () => {
  const row = (y, parts, { page = 0, region = "body" } = {}) => ({
    y,
    pageIndex: page,
    columnRank: 0,
    elements: parts.map(([text, x, width]) => ({ text, x, y, width: width ?? text.length * 6, height: 11, fontSize: 11, pageIndex: page, region })),
  });
  const plain = (line) => line.replace(/\[[^\]]*\]/g, "");

  it("reads a note ahead of the chords first, and one after them after the lyric", () => {
    const { body } = chartBody([
      row(10, [["(cut", 36], ["music)", 66], ["Cm7", 120]]),
      row(22, [["No more sacrificing lambs,", 36]]),
      row(40, [["Bb", 36], ["Cm7", 100], ["(build)", 200]]),
      row(52, [["We have access to the throne", 36]]),
    ]);
    expect(body[0]).toBe("{ci: cut music}");
    expect(plain(body[1])).toBe("No more sacrificing lambs,");
    expect(body[1]).toContain("[Cm7]");
    expect(plain(body[2])).toBe("We have access to the throne");
    expect(body[3]).toBe("{ci: build}");
  });

  it("puts chords ahead of a bar line on the lyric below, then the bar, then its note", () => {
    const { body } = chartBody([
      row(10, [["Cm7", 36], ["Bb/D", 70], ["|", 110], ["/", 120], ["/", 130], ["/", 140], ["Bb/C", 150], ["(key", 190], ["change)", 222]]),
      row(22, [["the Lamb.", 36]]),
    ]);
    expect(plain(body[0])).toBe("the Lamb.");
    expect(body[0]).toMatch(/\[Cm7\].*\[Bb\/D\]/);
    expect(body.slice(1)).toEqual(["| / / / Bb/C", "{ci: key change}"]);
  });

  it("splits a section name from the chords on its row", () => {
    expect(chartBody([row(10, [["Intro", 36], ["D", 90], ["Bm7", 120], ["A", 160], ["G", 190]])]).body).toEqual([
      "{comment: Intro}",
      "[D] [Bm7] [A] [G]",
    ]);
  });

  it("reads a dash between a section name and its chords as punctuation", () => {
    expect(chartBody([row(10, [["Interlude", 36], ["–", 100], ["(C-D-F-G)", 112], ["F", 190]])]).body).toEqual([
      "{comment: Interlude}",
      "[(C-D-F-G)] [F]",
    ]);
  });

  it("drops the page footer even when it shares a line with the music", () => {
    const { body } = chartBody([
      row(10, [["Dm", 90], ["F", 150]]),
      row(22, [["His name is Jesus Jesus", 36], ["UPCI Music Ministry", 485]]),
    ]);
    expect(body).toHaveLength(1);
    expect(plain(body[0])).toBe("His name is Jesus Jesus");
    expect(body[0]).toContain("[Dm]");
  });

  it("keeps a passing-chord run after a section name a chord, not the name's note", () => {
    // Lord, You Reign: "Intro (Ab - G) DbM7" made "Ab-G" an italic note that
    // would never transpose.
    expect(chartBody([row(10, [["Intro", 36], ["(Ab", 90], ["-", 114], ["G)", 126], ["DbM7", 160]])]).body).toEqual([
      "{comment: Intro}",
      "[(Ab-G)] [DbM7]",
    ]);
    expect(chartBody([row(10, [["Intro", 36], ["(Bb-B-C-Eb)", 90]])]).body).toEqual(["{comment: Intro}", "[(Bb-B-C-Eb)]"]);
    // a real note in the same place is still a note
    expect(chartBody([row(10, [["Verse", 36], ["1", 76], ["(Unison)", 90], ["Cm7", 160]])]).body).toEqual([
      "{comment: Verse 1}",
      "{ci: Unison}",
      "[Cm7]",
    ]);
  });

  it("keeps a chorus line that sings the title, and drops the title above the music", () => {
    const { body, dropped } = chartBody(
      [
        row(0, [["Speak The Name", 36]]),
        row(20, [["Chorus", 36]]),
        row(40, [["Db", 90]]),
        row(52, [["Speak the Name", 36]]),
      ],
      { title: "Speak The Name" },
    );
    expect(dropped).toBe(1);
    expect(body[0]).toBe("{comment: Chorus}");
    expect(plain(body[1])).toBe("Speak the Name");
    expect(body[1]).toContain("[Db]");
  });

  it("drops the credit block on every page it repeats on", () => {
    // The performer-and-album row carries no label, so only its place in the
    // header says it is not a lyric.
    const { body } = chartBody([
      row(86, [["Mark Yandris – Covered (Single)", 36]], { region: "header" }),
      row(120, [["Verse 1", 36]]),
      row(86, [["Mark Yandris – Covered (Single)", 36]], { page: 1, region: "header" }),
      row(120, [["No more sacrificing lambs,", 36]], { page: 1 }),
    ]);
    expect(body).toEqual(["{comment: Verse 1}", "No more sacrificing lambs,"]);
  });

  it("puts quick chords linked by dashes on the lyric below, dropping the dashes", () => {
    const { body } = chartBody([
      row(10, [["C#/E#", 36], ["-", 90], ["D#m", 110], ["-", 150], ["C#", 170]]),
      row(22, [["before my first step, my first step", 36]]),
    ]);
    expect(body).toHaveLength(1);
    expect(plain(body[0])).toBe("before my first step, my first step");
    expect(body[0].match(/\[[^\]]+\]/g)).toEqual(["[C#/E#]", "[D#m]", "[C#]"]);
  });

  it("reads a section carried from the foot of one column to the head of the next as one", () => {
    const { body } = chartBody([row(700, [["Chorus", 36]]), row(128, [["Chorus", 324]]), row(141, [["Covered, covered", 324]])]);
    expect(body).toEqual(["{comment: Chorus}", "Covered, covered"]);
  });

  it("closes up a lyric spaced out on tab stops, leaving a held beat where chords sit", () => {
    expect(chartBody([row(0, [["B", 36], ["A", 144]]), row(12, [["Oh,", 36], ["oh.", 144]])]).body).toEqual(["[B]Oh,    [A]oh."]);
    // With no chords over it there is nothing to hold room for.
    expect(chartBody([row(10, [["Oh,", 36], ["oh.", 144]])]).body).toEqual(["Oh, oh."]);
  });

  it("lifts an instruction off the end of a lyric into a note", () => {
    expect(chartBody([row(10, [["Reign, reign, reign.", 36], ["(repeat)", 180]])]).body).toEqual(["Reign, reign, reign.", "{ci: repeat}"]);
    expect(chartBody([row(10, [["Oh we worship You.", 36], ["2x", 180]])]).body).toEqual(["Oh we worship You.", "{ci: 2x}"]);
  });
});

describe("chord placement past the words", () => {
  it("puts a chord printed after the last word after it, not on its last letter", () => {
    const lyric = { elements: [{ text: "the Lamb.", x: 36, width: 54, fontSize: 11 }] };
    expect(mergeByPosition({ tokens: [{ text: "Bb/D", x: 200, width: 24 }] }, lyric)).toBe("the Lamb.[Bb/D]");
  });
});

describe("letter positions inside a run", () => {
  it("shares a run's width by letter, so a narrow letter takes less of it", () => {
    // "i" is about a quarter the width of "m". Even spacing put chords two
    // letters out by the end of a lyric.
    const [start, afterI, afterM, end] = charOffsets({ text: "imi", x: 0, width: 100 });
    expect(start).toBe(0);
    expect(afterI).toBeLessThan(100 / 3);
    expect(afterM).toBeGreaterThan((2 * 100) / 3);
    expect(end).toBeCloseTo(100);
  });

  it("never fuses two chords across a space written inside a run", () => {
    // pdf.js gave "Gm" "11 " "Gm" "7": the superscript's own space measured
    // under the joining threshold, and "Gm11" fused with "Gm7".
    const runs = [
      { text: "Gm", x: 100, width: 14 },
      { text: "11 ", x: 114, width: 9 },
      { text: "Gm", x: 123.5, width: 14 },
      { text: "7", x: 137.5, width: 5 },
    ].map((r) => ({ ...r, y: 0, height: 11, fontSize: 11, pageIndex: 0 }));
    expect(coalesceRuns(runs).map((t) => t.text)).toEqual(["Gm11", "Gm7"]);
  });

  it("carries the page width, so columns are found from the page's real centre", () => {
    const item = { str: "x", transform: [10, 0, 0, 10, 5, 700], width: 5, fontName: "f" };
    expect(itemToElement(item, 792, 0, {}, 612).pageWidth).toBe(612);
    expect(itemToElement(item, 792, 0)).not.toHaveProperty("pageWidth");
  });
});
