import { describe, it, expect } from "vitest";
import { assembleLines, detectColumns } from "../corpus/pdfLayout.js";

// ── Test data helpers ───────────────────────────────────────────

function makeElement(text, x, y, opts = {}) {
  return {
    text,
    x,
    y,
    width: opts.width ?? text.length * 7,
    height: opts.height ?? 14,
    fontName: opts.fontName ?? "Helvetica",
    fontSize: opts.fontSize ?? 12,
    fontIsBold: opts.fontIsBold ?? false,
    fontIsItalic: opts.fontIsItalic ?? false,
    pageIndex: opts.pageIndex ?? 0,
    ...(opts.pageWidth ? { pageWidth: opts.pageWidth } : {}),
    ...(opts.columnRank !== undefined ? { columnRank: opts.columnRank } : {}),
  };
}

// ── Column Detection ────────────────────────────────────────────

describe("detectColumns", () => {
  it("returns elements unchanged for single-column layout", () => {
    const elements = [
      makeElement("Line 1", 50, 10),
      makeElement("Line 2", 50, 24),
      makeElement("Line 3", 55, 38),
    ];
    const result = detectColumns(elements);
    expect(result).toHaveLength(3);
  });

  it("returns empty array for empty input", () => {
    expect(detectColumns([])).toEqual([]);
  });

  /*
   * A US Letter page, 612 points wide, laid out the way the church's chord
   * charts are: a two-row credit block, then a left column at x=36 and a right
   * column at x=324.
   */
  const onLetter = (text, x, y, opts = {}) => makeElement(text, x, y, { pageWidth: 612, ...opts });
  const lineTexts = (elements) => assembleLines(detectColumns(elements)).map((l) => l.elements.map((e) => e.text).join(" "));

  const creditBlock = [
    onLetter("Covered", 36, 63, { fontSize: 28, width: 100 }),
    onLetter("Written by Mark Yandris", 440, 63, { width: 130 }),
    onLetter("Mark Yandris – Covered (Single)", 36, 86, { width: 170 }),
    onLetter("Key: Eb Tempo: 143 Time: 4/4", 392, 86, { width: 160 }),
  ];
  const leftColumn = [
    onLetter("Intro", 36, 128),
    onLetter("| Eb / / / |", 36, 141),
    onLetter("Verse 1", 36, 187),
    onLetter("Eb", 36, 204),
    onLetter("No more sacrificing lambs,", 36, 217),
  ];
  const rightColumn = [
    onLetter("Verse 3", 324, 128),
    onLetter("F", 324, 141),
    onLetter("What can wash away my sins?", 324, 154),
    onLetter("Dm7", 324, 167),
    onLetter("What can make me whole again?", 324, 180),
  ];

  it("reads a two-column page as the header, the left column, then the right", () => {
    // Shuffled, as extraction order promises nothing.
    const page = [...rightColumn, ...leftColumn, ...creditBlock].sort((a, b) => a.text.localeCompare(b.text));
    expect(lineTexts(page)).toEqual([
      "Covered Written by Mark Yandris",
      "Mark Yandris – Covered (Single) Key: Eb Tempo: 143 Time: 4/4",
      "Intro",
      "| Eb / / / |",
      "Verse 1",
      "Eb",
      "No more sacrificing lambs,",
      "Verse 3",
      "F",
      "What can wash away my sins?",
      "Dm7",
      "What can make me whole again?",
    ]);
  });

  it("never joins the two columns into one line, however exactly their baselines agree", () => {
    // "Intro" and "Verse 3" share y=128. Joining them printed "INTRO VERSE 3".
    const lines = assembleLines(detectColumns([...creditBlock, ...leftColumn, ...rightColumn]));
    const shared = lines.filter((l) => Math.abs(l.y - 128) < 1);
    expect(shared.map((l) => l.elements.map((e) => e.text))).toEqual([["Intro"], ["Verse 3"]]);
  });

  it("keeps the credit block whole and marks it as the header", () => {
    const tagged = detectColumns([...creditBlock, ...leftColumn, ...rightColumn]);
    const header = tagged.filter((e) => e.region === "header").map((e) => e.text);
    expect([...header].sort()).toEqual(creditBlock.map((e) => e.text).sort());
    expect(tagged.filter((e) => e.region === "header").every((e) => e.columnRank === 0)).toBe(true);
  });

  it("keeps a chart set out on a grid in one column when its lines cross the centre", () => {
    // God Almighty: a single column typeset on tab stops at 36, 144, 252, 360.
    const grid = [36, 144, 252, 360];
    const rows = [
      ["Eb", "Bb", "F/A", "Gm7"],
      ["God Almighty,", "Lord of glory.", "Oh we worship", "You."],
      ["Eb", "Bb", "F/A", "Gm7"],
      ["Oh,", "oh.", "Oh we worship", "You."],
    ];
    const page = [
      onLetter("Chorus", 36, 120),
      ...rows.flatMap((words, r) => words.map((w, i) => onLetter(w, grid[i], 140 + r * 18))),
    ];
    expect(lineTexts(page)).toContain("God Almighty, Lord of glory. Oh we worship You.");
  });

  it("does not split a tab-stop chart that leaves the centre clear, because no section opens on the right", () => {
    // Made a Way, page 4: nothing happens to cross x=306, but the right-hand
    // text finishes the left-hand line, and no section starts over there.
    const page = [
      onLetter("Ending", 36, 150),
      ...[178, 222].flatMap((y) => [onLetter("C#m7", 108, y), onLetter("B", 180, y), onLetter("F#", 324, y)]),
      ...[195, 240, 260].flatMap((y) => [
        onLetter("And we're standing", 36, y, { width: 115 }),
        onLetter("here only because", 180, y, { width: 109 }),
        onLetter("You", 324, y, { width: 22 }),
        onLetter("made…", 360, y, { width: 48 }),
      ]),
    ];
    expect(lineTexts(page)).toContain("And we're standing here only because You made…");
  });

  it("finds the fold from the page itself, not from how far the text happens to reach", () => {
    // No right-aligned credits here, and a short right column: the middle of
    // the printed text sits well left of the page's centre, and a long left
    // line would look as if it crossed it.
    const page = [
      onLetter("Verse 1", 36, 100),
      onLetter("Eb", 36, 113),
      onLetter("No more sacrificing lambs, no more", 36, 126, { width: 244 }),
      onLetter("Cm7", 36, 139),
      onLetter("bullocks, goats, or rams.", 36, 152, { width: 150 }),
      onLetter("Tag", 324, 100),
      onLetter("Eb", 324, 113),
      onLetter("the Lamb.", 324, 126, { width: 60 }),
    ];
    expect(lineTexts(page)).toEqual(["Verse 1", "Eb", "No more sacrificing lambs, no more", "Cm7", "bullocks, goats, or rams.", "Tag", "Eb", "the Lamb."]);
  });

  it("reads the page as one column when a single line runs across the fold", () => {
    // Two columns never share a run of text, so one long line settles it.
    const page = [...creditBlock, ...leftColumn, ...rightColumn, onLetter("Great is the Lord and greatly to be praised, forever and ever", 36, 240, { width: 420 })];
    expect(lineTexts(page)).toContain("Intro Verse 3");
  });

  it("does not take a lone label out on the right for a column, even a section name", () => {
    const page = [
      onLetter("Chorus", 36, 100),
      onLetter("Oh we worship You.", 36, 120, { width: 120 }),
      onLetter("Tag", 432, 120),
      onLetter("Oh we worship You.", 36, 140, { width: 120 }),
      onLetter("(2x)", 432, 140),
      onLetter("Oh we worship You.", 36, 160, { width: 120 }),
    ];
    expect(lineTexts(page)).toEqual(["Chorus", "Oh we worship You. Tag", "Oh we worship You. (2x)", "Oh we worship You."]);
  });

  it("does not take a note out on the right for a column", () => {
    const page = [
      onLetter("Chorus", 36, 100),
      onLetter("Oh we worship You.", 36, 120, { width: 120 }),
      onLetter("(2x)", 432, 120),
      onLetter("Oh we worship You.", 36, 140, { width: 120 }),
      onLetter("(2x)", 432, 140),
    ];
    expect(lineTexts(page)).toEqual(["Chorus", "Oh we worship You. (2x)", "Oh we worship You. (2x)"]);
  });

  it("lays each page out on its own", () => {
    const pageTwo = [
      onLetter("Bridge", 36, 100, { pageIndex: 1 }),
      onLetter("Great is the Lord and greatly to be praised, forever and ever", 36, 120, { pageIndex: 1, width: 420 }),
    ];
    const texts = lineTexts([...pageTwo, ...creditBlock, ...leftColumn, ...rightColumn]);
    expect(texts.indexOf("What can make me whole again?")).toBeLessThan(texts.indexOf("Bridge"));
    expect(texts.slice(-2)).toEqual(["Bridge", "Great is the Lord and greatly to be praised, forever and ever"]);
  });
});

// ── Line Assembly ───────────────────────────────────────────────

describe("assembleLines", () => {
  it("groups elements on the same baseline into one line", () => {
    const elements = [
      makeElement("Hello", 50, 10),
      makeElement("World", 100, 10),
    ];
    const lines = assembleLines(elements);
    expect(lines).toHaveLength(1);
    expect(lines[0].elements).toHaveLength(2);
  });

  it("separates elements on different baselines", () => {
    const elements = [
      makeElement("Line 1", 50, 10),
      makeElement("Line 2", 50, 30),
    ];
    const lines = assembleLines(elements);
    expect(lines).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(assembleLines([])).toEqual([]);
  });

  it("sorts elements within a line by x position", () => {
    const elements = [
      makeElement("World", 100, 10),
      makeElement("Hello", 50, 10),
    ];
    const lines = assembleLines(elements);
    expect(lines[0].elements[0].text).toBe("Hello");
    expect(lines[0].elements[1].text).toBe("World");
  });

  it("never joins elements from two columns, even on one baseline", () => {
    // The last line of one column and the first of the next can meet in the
    // sort order at the same y; they are still two lines.
    const elements = [
      makeElement("the Lamb.", 36, 700, { columnRank: 1 }),
      makeElement("Verse 2", 324, 700, { columnRank: 2 }),
    ];
    const lines = assembleLines(elements);
    expect(lines.map((l) => l.elements.map((e) => e.text))).toEqual([["the Lamb."], ["Verse 2"]]);
    expect(lines.map((l) => l.columnRank)).toEqual([1, 2]);
  });

  it("handles multi-page elements", () => {
    const elements = [
      makeElement("Page 1", 50, 10, { pageIndex: 0 }),
      makeElement("Page 2", 50, 10, { pageIndex: 1 }),
    ];
    const lines = assembleLines(elements);
    expect(lines).toHaveLength(2);
    expect(lines[0].pageIndex).toBe(0);
    expect(lines[1].pageIndex).toBe(1);
  });
});
