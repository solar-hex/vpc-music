/**
 * Extract positioned text from a PDF, locally.
 *
 * It replaced an earlier pipeline that uploaded every file to the paid PDF.co
 * API. That was wrong on three counts: ~1,450 files of purchased church
 * material would leave the machine, it cost per call, and a batch job should
 * not need the network. The app's own PDF import now uses this too.
 *
 * It returns the element shape `detectColumns` (corpus/pdfLayout.js) consumes.
 *
 * Hand-rolling this was tempting and would have been wrong: the charts use
 * subset TrueType and Type0/CIDFontType2 fonts with custom encodings, so the
 * raw bytes are meaningless without each font's ToUnicode CMap. That is
 * exactly what pdf.js gets right.
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

let pdfjs = null;
async function getPdfjs() {
  if (!pdfjs) {
    // The legacy build is the one that runs under plain Node.
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    // The ESM loader needs a file:// URL — a bare Windows path is read as a
    // "c:" protocol and rejected.
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
      require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs"),
    ).href;
  }
  return pdfjs;
}

/**
 * Convert one pdf.js text item into the element shape the pipeline expects.
 *
 * THE LOAD-BEARING LINE IS THE Y FLIP. PDF's origin is bottom-left and y
 * increases upward, but `assembleLines` sorts ascending y assuming top-down
 * (PDF.co returned top-down). Miss this and every chart comes out reversed,
 * silently — which is why it has its own test.
 *
 * @param {{str:string, transform:number[], width:number, height:number, fontName:string}} item
 * @param {number} pageHeight
 * @param {number} pageIndex
 * @param {Record<string,{fontFamily?:string}>} [fontMap]
 * @param {number} [pageWidth] carried on every element, so column detection
 *   can find the page's real centre instead of guessing it from the text
 */
export function itemToElement(item, pageHeight, pageIndex, fontMap = {}, pageWidth) {
  const [scaleX, , , scaleY, x, yUp] = item.transform;
  const fontSize = Math.abs(scaleY || scaleX || 0);
  const name = fontMap[item.fontName]?.fontFamily || item.fontName || "";
  const lower = String(name).toLowerCase();
  return {
    text: item.str,
    x,
    y: pageHeight - yUp, // ← bottom-left origin becomes top-down
    width: item.width ?? 0,
    height: item.height || fontSize,
    fontName: name,
    fontSize,
    fontIsBold: /bold|black|heavy|semibold/.test(lower),
    fontIsItalic: /italic|oblique/.test(lower),
    pageIndex,
    ...(Number.isFinite(pageWidth) ? { pageWidth } : {}),
  };
}

/**
 * Positioned text for a whole PDF.
 * @param {Buffer|Uint8Array} buffer
 * @returns {Promise<Array>} elements, in the shape `detectColumns` consumes
 */
export async function extractPdfElements(buffer) {
  const lib = await getPdfjs();
  const task = lib.getDocument({
    data: new Uint8Array(buffer),
    // These charts carry embedded subset fonts; nothing needs to be fetched.
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
  });
  const doc = await task.promise;

  const elements = [];
  try {
    for (let p = 1; p <= doc.numPages; p += 1) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const fontMap = {};
      for (const item of content.items) {
        if (!item.str || !item.str.trim()) continue;
        elements.push(itemToElement(item, viewport.height, p - 1, content.styles || fontMap, viewport.width));
      }
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return elements;
}

/** Does this PDF carry a text layer at all, or is it engraved notation? */
export async function hasTextLayer(buffer, { minElements = 15 } = {}) {
  const elements = await extractPdfElements(buffer);
  return { hasText: elements.length >= minElements, elements };
}

/*
 * Relative glyph widths, from Helvetica's metrics (thousandths of an em).
 *
 * pdf.js measures a whole run, not each letter. Sharing that width out evenly
 * drifts by a letter or two across a lyric, because "i" and "l" are a quarter
 * the width of "m" and "w", and the chord lands on the wrong letter. The charts
 * are not set in Helvetica, but the proportions of one sans serif letter to
 * another hold across them, and only the proportions are used: each run's
 * measured width is shared out by them. Scored against the 20 songs that also
 * have a chart a person typed, this puts 81% of chords on the right word,
 * against 73% with even spacing.
 */
const GLYPH_WIDTHS = (() => {
  const table = { " ": 278, "!": 278, '"': 355, "#": 556, $: 556, "%": 889, "&": 667, "'": 191, "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278, ":": 278, ";": 278, "<": 584, "=": 584, ">": 584, "?": 556, "@": 1015, "[": 278, "\\": 278, "]": 278, "^": 469, _: 556, "`": 333, "{": 334, "|": 260, "}": 334, "~": 584, "‘": 222, "’": 222, "“": 333, "”": 333, "–": 556, "—": 1000, "…": 1000, "°": 400 };
  const upper = [667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611];
  const lower = [556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500];
  for (let i = 0; i < 26; i += 1) {
    table[String.fromCharCode(65 + i)] = upper[i];
    table[String.fromCharCode(97 + i)] = lower[i];
  }
  for (let d = 0; d < 10; d += 1) table[String(d)] = 556;
  return table;
})();

/**
 * The x of each character of a run, plus one more entry for where the run
 * ends, with the run's measured width shared out by glyph proportion.
 */
export function charOffsets(el) {
  const text = String(el.text ?? "");
  const widths = [];
  for (let i = 0; i < text.length; i += 1) widths.push(GLYPH_WIDTHS[text[i]] ?? (/\s/.test(text[i]) ? 278 : 556));
  const total = widths.reduce((sum, w) => sum + w, 0);
  const scale = total > 0 ? (el.width ?? 0) / total : 0;
  const xs = [];
  let acc = 0;
  for (const w of widths) {
    xs.push(el.x + acc * scale);
    acc += w;
  }
  xs.push(el.x + acc * scale);
  return xs;
}

/**
 * Join runs that sit adjacent on the page into one token.
 *
 * A chord is frequently three runs — "Bm", "7" — and each must become one
 * token or the merge emits `[Bm][7]` instead of `[Bm7]`.
 */
export function coalesceRuns(elements) {
  // pdf.js splits in both directions: a chord can arrive as several runs
  // ("Bm" + "7"), and a whole chord line can arrive as ONE run with the
  // spacing inside it ("D        A/C#   Bm7"). Split first, then join, or the
  // second case becomes a single nonsense token.
  const pieces = [];
  for (const el of [...(elements || [])].sort((a, b) => a.x - b.x)) {
    const text = String(el.text);
    const offsets = charOffsets(el);
    for (const m of text.matchAll(/\S+/g)) {
      const end = m.index + m[0].length;
      pieces.push({
        ...el,
        text: m[0],
        x: offsets[m.index],
        width: offsets[end] - offsets[m.index],
        // A space the PDF wrote is a word break whatever the gap measures:
        // a superscript "11 " is narrow enough that its space can measure
        // under the joining threshold, and "Gm11" then fused with "Gm7".
        spaceBefore: m.index > 0,
        spaceAfter: end < text.length,
      });
    }
  }

  const out = [];
  for (const piece of pieces) {
    const last = out[out.length - 1];
    const gap = last ? piece.x - (last.x + last.width) : Infinity;
    const threshold = Math.max(piece.fontSize, last?.fontSize ?? 0, 1) * 0.25;
    if (last && !last.spaceAfter && !piece.spaceBefore && gap <= threshold) {
      last.text += piece.text;
      last.width = piece.x + piece.width - last.x;
      last.spaceAfter = piece.spaceAfter;
    } else {
      out.push({ ...piece });
    }
  }
  return out.map(({ spaceBefore, spaceAfter, ...token }) => token);
}

/**
 * Rebuild a line's text from its runs, honouring the gaps between them.
 *
 * pdf.js splits a line into glyph runs wherever the font or kerning changes,
 * so a chord or a key arrives as several pieces. Joining them with a space
 * unconditionally turns "Bm7" into "Bm 7" and "Bb" into "B b" — neither reads
 * correctly, and that single mistake cost most of the chords on every chart
 * and truncated every flat key.
 *
 * @returns {{ text: string, xs: number[] }} xs[i] is the x of text[i]
 */
export function renderLine(elements) {
  let text = "";
  const xs = [];
  const runs = [...(elements || [])].sort((a, b) => a.x - b.x);
  for (let i = 0; i < runs.length; i += 1) {
    const el = runs[i];
    if (i > 0) {
      const prev = runs[i - 1];
      const gap = el.x - (prev.x + prev.width);
      // Anything under a quarter of the type size is kerning, not a space.
      const threshold = Math.max(el.fontSize, prev.fontSize, 1) * 0.25;
      if (gap > threshold) {
        // Wide gaps are real layout: keep enough of them to preserve columns.
        const spaces = Math.max(1, Math.round(gap / Math.max(el.fontSize * 0.5, 1)));
        for (let s = 0; s < spaces; s += 1) { text += " "; xs.push(prev.x + prev.width); }
      }
    }
    const offsets = charOffsets(el);
    for (let c = 0; c < el.text.length; c += 1) { text += el.text[c]; xs.push(offsets[c]); }
  }
  return { text, xs };
}

/**
 * Metadata from a UPCI-style chart header, which is denser than the generic
 * extractor assumes: "UPCI Music Ministry | Key: B | Way Maker | Sinach".
 *
 * Returns only what it is confident about — a wrong artist is worse than none.
 */
export function readChartHeader(elements, { filename = "" } = {}) {
  const page1 = elements.filter((e) => e.pageIndex === 0).sort((a, b) => a.y - b.y || a.x - b.x);
  const empty = { title: null, artist: null, album: null, writers: null, key: null, tempo: null, time: null };
  if (page1.length === 0) return empty;

  // Group the top of the page into visual lines.
  const lines = [];
  for (const e of page1.slice(0, 60)) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - e.y) < 4) last.parts.push(e);
    else lines.push({ y: e.y, parts: [e] });
  }

  /*
   * These charts right-align the songwriter credit on the SAME baseline as the
   * title: "It Is Well" sits at x=36 and "Horatio Spafford" at x=498, with a
   * small "Written by" label above it. Reading the line left to right glued
   * the two together, so ~20 songs were titled "It Is Well Horatio Spafford"
   * — the title wrong AND the writers lost, in one move.
   *
   * Split the title line at the gap. Guarded twice, because a wrong cut would
   * truncate a legitimate two-part title: only on the largest type on the
   * page, and only when the page actually carries the "Written by" label.
   */
  const creditParts = [];
  const labelled = lines.some((l) => /^written\s+by\b/i.test(renderLine(l.parts).text.trim()));
  if (labelled) {
    const sizeOf = (l) => Math.max(...l.parts.map((p) => p.fontSize));
    const biggest = Math.max(...lines.map(sizeOf));
    for (const line of lines) {
      if (sizeOf(line) < biggest * 0.95) continue;
      const sorted = [...line.parts].sort((a, b) => a.x - b.x);
      let cut = -1;
      for (let i = 1; i < sorted.length; i += 1) {
        const prev = sorted[i - 1];
        const gap = sorted[i].x - (prev.x + prev.width);
        // Two and a half line-heights of white space is a column boundary, not
        // a word space — a wide word space is well under one.
        if (gap > Math.max(sorted[i].fontSize, prev.fontSize) * 2.5) { cut = i; break; }
      }
      if (cut > 0) {
        creditParts.push({ y: line.y, parts: sorted.slice(cut) });
        line.parts = sorted.slice(0, cut);
      }
    }
  }

  // Gap-aware, or a flat key is truncated: pdf.js splits "Bb" into "B" + "b",
  // and joining with a space made `Key: Bb` read as `Key: B `. Every chord on
  // the chart then transposes from the wrong tonic.
  const rendered = lines.map((l) => ({
    y: l.y,
    size: Math.max(...l.parts.map((p) => p.fontSize)),
    text: renderLine(l.parts).text.replace(/\s+/g, " ").trim(),
  })).filter((l) => l.text);

  const out = { ...empty };

  /*
   * These charts carry one dense credit line, and it is the richest metadata
   * in the whole corpus:
   *
   *   CeCe Winans – "Holy Forever (Single)" Key: F Tempo: 72 Time: 4/4
   *
   * performer, album, key, tempo and time signature in a single run.
   */
  for (const line of rendered) {
    if (!/key\s*:/i.test(line.text)) continue;

    const key = line.text.match(/key\s*:\s*([A-G][b#]?m?(?:in)?)/i);
    if (key && !out.key) out.key = key[1];

    const tempo = line.text.match(/tempo\s*:\s*(\d{2,3})(?:\.\d+)?/i);
    if (tempo && !out.tempo) out.tempo = Number(tempo[1]);

    const time = line.text.match(/time\s*:\s*(\d{1,2}\s*\/\s*\d{1,2})/i);
    if (time && !out.time) out.time = time[1].replace(/\s+/g, "");

    const album = line.text.match(/[“"]([^”"]+)[”"]/);
    if (album && !out.album) out.album = album[1].trim();

    // The performer is whatever precedes the en-dash before the album.
    const performer = line.text.split(/\s+[–—-]\s+/)[0].trim();
    if (!out.artist && performer && !/key\s*:/i.test(performer) && performer.length <= 60) {
      out.artist = performer;
    }
    break;
  }

  // Songwriters are credited separately and may wrap over several lines.
  const writerParts = [];
  for (let i = 0; i < rendered.length; i += 1) {
    const m = rendered[i].text.match(/written\s+by\s*(.*)$/i);
    if (!m) continue;
    if (m[1].trim()) writerParts.push(m[1].trim());
    // continuation lines: same size, name-shaped, before the credit line
    for (let j = i + 1; j < rendered.length; j += 1) {
      const next = rendered[j];
      if (Math.abs(next.size - rendered[i].size) > 0.6) break;
      if (/key\s*:/i.test(next.text)) break;
      if (!/^[A-Z][A-Za-z.'’-]*(\s+[A-Z][A-Za-z.'’-]*)*,?$/.test(next.text)) break;
      writerParts.push(next.text.trim());
    }
    break;
  }
  // Whatever sat in the credit column of the title line belongs here too.
  for (const credit of creditParts.sort((a, b) => a.y - b.y)) {
    const text = renderLine(credit.parts).text.replace(/\s+/g, " ").trim();
    if (text && !/^written\s+by\b/i.test(text)) writerParts.push(text);
  }
  if (writerParts.length > 0) {
    out.writers = writerParts.join(" ").replace(/\s*,\s*/g, ", ").replace(/,\s*$/, "").trim() || null;
  }

  // Title: the largest type on the page, minus any credit that shares the line.
  const NOISE = /^(upci music ministry|www\.|copyright|©|ccli|page \d+)$/i;
  const titleish = rendered.filter((l) => !NOISE.test(l.text) && !/key\s*:/i.test(l.text));
  if (titleish.length > 0) {
    const max = Math.max(...titleish.map((l) => l.size));
    const run = titleish.filter((l) => l.size >= max * 0.95);
    out.title = run.map((l) => l.text).join(" ")
      .replace(/\s*written\s+by\b.*$/i, "")
      .replace(/\s+/g, " ")
      .trim() || null;
  }
  /*
   * NOT attempted: splitting a credit off the title by reading the words. One
   * chart sets its writers in the title's own type with no gap and no label
   * ("Glory Zebrina Anderson, Sarah Benibo"), and no word pattern separates
   * that from a real title — "Jesus, There Is Something, About That Name" has
   * the same shape and was mangled by every rule tried. Geometry is evidence;
   * guessing at names is not. That one title stays for a human.
   */

  /*
   * A chart with no large type at all makes every body line "the title", and
   * one song came out titled with its entire first page of chords. No song is
   * called that; the filename is a better answer than a paragraph.
   */
  if (out.title && (out.title.length > 90 || out.title.split(/\s+/).length > 14)) out.title = null;
  if (!out.title && filename) {
    out.title = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim() || null;
  }

  // "UPCI Music" is the publisher on their own releases, not an artist worth
  // recording — but the songwriter is.
  if (out.artist && /^upci music$/i.test(out.artist)) out.artist = null;

  return out;
}
