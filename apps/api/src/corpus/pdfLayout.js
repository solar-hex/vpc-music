/**
 * The layout of a PDF chart: which text sits in which column, and which runs
 * of text make up one line.
 *
 * Shared by the chart converter (corpus/pdfSong.js), which reads what each
 * line is, and the number-chart check (corpus/nashvilleCheck.js). The column
 * rule is surveyed and settled: see the comments on detectColumns.
 *
 * This was steps 2 and 3 of an earlier pipeline that sent every PDF to PDF.co
 * for its text. The text now comes from pdf.js on this server
 * (corpus/pdfTextLocal.js), and the rest of that pipeline is gone.
 */

/** Metadata rather than music: the credit block at the top of a chart. */
const HEADER_LABEL = /\b(?:key|tempo|bpm)\s*[:=]|\btime\s*:\s*\d|written\s+by|ccli|©|copyright/i;

/** A section name opening a line, which is how a column announces itself. */
const SECTION_START =
  /^(?:intro|verse|chorus|pre[- ]?chorus|bridge|tag|outro|ending|interlude|instrumental|vamp|refrain|turnaround|breakdown|solo|hook|coda|reprise|channel)\b/i;

/** The credit block never runs deeper than this many rows. */
const HEADER_SEARCH_ROWS = 6;

/** Fewer rows than this on a side is an annotation, not a column. */
const MIN_COLUMN_ROWS = 3;

/** One page's elements grouped into rows by baseline, top to bottom. */
function rowsOfPage(elements) {
  const rows = [];
  for (const el of [...elements].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(el.y - row.y) <= Math.max(el.height * 0.6, 3)) row.elements.push(el);
    else rows.push({ y: el.y, elements: [el] });
  }
  return rows;
}

function textOf(elements) {
  return [...elements]
    .sort((a, b) => a.x - b.x)
    .map((e) => e.text)
    .join(" ")
    .trim();
}

/**
 * Split one page into its header rows and one or two columns.
 *
 * A page is two columns only when all three hold, measured over every page of
 * the church's 282 chord-chart PDFs:
 *
 *  1. Nothing in the body crosses the page's centre line. Two columns never
 *     share a run of text, so one run across the fold settles it.
 *  2. Both sides have at least three rows. A lone "(2x)" out on the right is
 *     an annotation, not a column.
 *  3. Something on the right OPENS A SECTION at the right column's edge
 *     ("Verse 3", "Chorus 2 (2x)"). The older charts are typeset on tab stops
 *     half an inch apart, so a single-column line such as "And we're standing
 *     here only because | You made" can leave the centre clear by chance and
 *     pass the first two tests. Every one of the 315 real two-column pages
 *     opens a section at its right edge; no grid chart does.
 *
 * The rows down to and including the last credit line ("Key: G  Tempo: 75")
 * are the header, and stay whole even on a two-column page: the title and the
 * writer credit share a baseline, and splitting them would scatter half a
 * credit into the song.
 */
function layoutPage(elements) {
  const rows = rowsOfPage(elements);

  let headerRows = 0;
  for (let i = 0; i < Math.min(rows.length, HEADER_SEARCH_ROWS); i += 1) {
    if (HEADER_LABEL.test(textOf(rows[i].elements))) headerRows = i + 1;
  }
  const header = rows.slice(0, headerRows);
  const body = rows.slice(headerRows);

  // The real centre when the extractor knows the page size; otherwise the
  // middle of what is printed, which the right-aligned credits push out to
  // the margins on these charts.
  const pageWidth = elements.find((e) => Number.isFinite(e.pageWidth) && e.pageWidth > 0)?.pageWidth;
  const fold = pageWidth
    ? pageWidth / 2
    : (Math.min(...elements.map((e) => e.x)) + Math.max(...elements.map((e) => e.x + e.width))) / 2;
  const side = (el) => (el.x + el.width <= fold + 1 ? "left" : el.x >= fold - 1 ? "right" : "across");

  const tag = (els, columnRank, region) => els.map((el) => ({ ...el, columnRank, region }));
  const headerElements = header.flatMap((row) => tag(row.elements, 0, "header"));
  const singleColumn = () => [...headerElements, ...body.flatMap((row) => tag(row.elements, 0, "body"))];

  if (body.some((row) => row.elements.some((el) => side(el) === "across"))) return singleColumn();

  const leftRows = body.filter((row) => row.elements.some((el) => side(el) === "left"));
  const rightParts = body
    .map((row) => row.elements.filter((el) => side(el) === "right").sort((a, b) => a.x - b.x))
    .filter((part) => part.length > 0);
  if (leftRows.length < MIN_COLUMN_ROWS || rightParts.length < MIN_COLUMN_ROWS) return singleColumn();

  const edge = Math.min(...rightParts.map((part) => part[0].x));
  const opensSection = rightParts.some((part) => Math.abs(part[0].x - edge) < 4 && SECTION_START.test(textOf(part)));
  if (!opensSection) return singleColumn();

  const bodyElements = body.flatMap((row) => row.elements);
  return [
    ...headerElements,
    ...tag(bodyElements.filter((el) => side(el) === "left"), 1, "body"),
    ...tag(bodyElements.filter((el) => side(el) === "right"), 2, "body"),
  ];
}

/**
 * Lay each page out for reading: its header, then the left column top to
 * bottom, then the right. Every element comes back tagged with `columnRank`
 * (0 header or single column, 1 left, 2 right) and `region` ("header" or
 * "body"), in reading order.
 *
 * Charts stay ONE column top to bottom in the app. Showing a chart in two
 * columns is a display option for later, not something copied from the
 * publisher's page.
 *
 * @param {Array} elements
 * @returns {Array} elements in reading order, tagged
 */
export function detectColumns(elements) {
  if (elements.length === 0) return elements;

  const pages = new Map();
  for (const el of elements) {
    if (!pages.has(el.pageIndex)) pages.set(el.pageIndex, []);
    pages.get(el.pageIndex).push(el);
  }

  const out = [];
  for (const pageIndex of [...pages.keys()].sort((a, b) => a - b)) {
    const laidOut = layoutPage(pages.get(pageIndex));
    laidOut.sort((a, b) => a.columnRank - b.columnRank || a.y - b.y || a.x - b.x);
    out.push(...laidOut);
  }
  return out;
}

/**
 * Group text elements by baseline proximity (same y ≈ same line).
 * Returns an array of "assembled lines", each an array of elements sorted by x.
 *
 * Columns are respected: elements are read in `columnRank` order (see
 * detectColumns), and two elements in different columns are never one line,
 * however exactly their baselines agree. Joining them is what printed
 * "Intro … Verse 3" as one heading and glued a chord from one column onto a
 * lyric from the other. Elements with no rank read as one column.
 *
 * @param {Array} elements
 * @returns {Array<{elements: Array, y: number, pageIndex: number, columnRank: number}>}
 */
export function assembleLines(elements) {
  if (elements.length === 0) return [];

  const rank = (el) => el.columnRank ?? 0;
  const sorted = [...elements].sort(
    (a, b) => a.pageIndex - b.pageIndex || rank(a) - rank(b) || a.y - b.y || a.x - b.x,
  );

  const lines = [];
  let current = null;
  const finish = () => {
    current.elements.sort((a, b) => a.x - b.x);
    lines.push(current);
  };

  for (const el of sorted) {
    // Same line if within ~60% of the element's height
    const tolerance = Math.max(el.height * 0.6, 3);
    if (
      current &&
      el.pageIndex === current.pageIndex &&
      rank(el) === current.columnRank &&
      Math.abs(el.y - current.y) <= tolerance
    ) {
      current.elements.push(el);
    } else {
      if (current) finish();
      current = { elements: [el], y: el.y, pageIndex: el.pageIndex, columnRank: rank(el) };
    }
  }
  finish();

  return lines;
}
