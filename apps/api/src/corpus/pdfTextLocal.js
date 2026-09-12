/**
 * Extract positioned text from a PDF, locally.
 *
 * Replaces step 1 of `features/songs/pdfToChordPro.js`, which uploads every
 * file to the paid PDF.co API. That is wrong for this corpus on three counts:
 * ~1,450 files of purchased church material would leave the machine, it costs
 * per call, and a batch job should not need the network.
 *
 * Steps 2-7 of that pipeline are pure and local, so this returns the EXACT
 * element shape `detectColumns` already consumes and the rest is reused
 * unchanged.
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
 */
export function itemToElement(item, pageHeight, pageIndex, fontMap = {}) {
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
        elements.push(itemToElement(item, viewport.height, p - 1, content.styles || fontMap));
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
  const rendered = lines.map((l) => ({
    y: l.y,
    size: Math.max(...l.parts.map((p) => p.fontSize)),
    text: l.parts.map((p) => p.text).join(" ").replace(/\s+/g, " ").trim(),
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
  if (!out.title && filename) {
    out.title = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim() || null;
  }

  // "UPCI Music" is the publisher on their own releases, not an artist worth
  // recording — but the songwriter is.
  if (out.artist && /^upci music$/i.test(out.artist)) out.artist = null;

  return out;
}
