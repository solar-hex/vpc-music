/**
 * Pull plain text out of a .docx.
 *
 * A .docx is a zip holding `word/document.xml`. We need paragraph boundaries
 * (they carry the line structure of a lyric sheet) and nothing else, so this
 * walks the XML rather than pulling in a document library.
 *
 * jszip is already an apps/api dependency, so this adds nothing new.
 */
import JSZip from "jszip";

/** Decode the five XML entities that can appear in w:t text. */
function decodeEntities(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

/**
 * One string per `<w:p>` paragraph, in document order.
 * Tabs become tabs and `<w:br/>` becomes a newline, because a lyric sheet's
 * line breaks are its structure.
 *
 * @param {Buffer|Uint8Array} buffer
 * @returns {Promise<string[]>}
 */
export async function extractDocxParagraphs(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("not a Word document: word/document.xml is missing");
  const xml = await entry.async("string");

  const paragraphs = [];
  // Each <w:p ...> … </w:p> is one paragraph.
  for (const match of xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)) {
    const body = match[1];
    let text = "";
    // Walk text runs, tabs and breaks in document order.
    for (const piece of body.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g)) {
      if (piece[1] !== undefined) text += decodeEntities(piece[1]);
      else if (piece[0].startsWith("<w:tab")) text += "\t";
      else text += "\n";
    }
    // Split on any embedded <w:br/> so each visual line is its own entry.
    for (const line of text.split("\n")) paragraphs.push(line.trimEnd());
  }
  return paragraphs;
}

/** True when this looks like a Word document rather than some other zip. */
export async function isDocx(buffer) {
  try {
    const zip = await JSZip.loadAsync(buffer);
    return Boolean(zip.file("word/document.xml"));
  } catch {
    return false;
  }
}
