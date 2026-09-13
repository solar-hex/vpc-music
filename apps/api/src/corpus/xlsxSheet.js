/**
 * Read rows out of an .xlsx workbook.
 *
 * The song lists this corpus has to be measured against are spreadsheets —
 * 8,315 titles in one, 467 curated titles with a status column in the other —
 * and asking a person to "Save As → CSV" before every gap report is a manual
 * step that will be forgotten.
 *
 * An .xlsx is a zip of XML, and `jszip` is already an apps/api dependency
 * (it is what reads .docx), so this needs no new package. It reads exactly
 * what a gap report needs — cell text, in row and column order — and nothing
 * else: no formulas, no styles, no dates, no merged cells.
 */
import JSZip from "jszip";

/** `BC` → 54. Columns can be skipped in the XML, so position must be read, not counted. */
export function columnIndex(ref) {
  const letters = String(ref || "").replace(/[^A-Z]/gi, "").toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXml(text) {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => ENTITIES[name]);
}

/** All the `<t>` text inside one XML fragment, concatenated — a cell can be several runs. */
function textOf(fragment) {
  let out = "";
  for (const m of String(fragment).matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) out += decodeXml(m[1]);
  return out;
}

/** The shared string table every text cell points into. */
export function parseSharedStrings(xml) {
  if (!xml) return [];
  const out = [];
  for (const m of String(xml).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) out.push(textOf(m[1]));
  return out;
}

/**
 * One worksheet as an array of row arrays. Empty trailing cells are dropped;
 * a gap inside a row becomes an empty string, so column positions line up.
 */
export function parseSheet(xml, strings = []) {
  const rows = [];
  for (const rowMatch of String(xml).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = attrs.match(/\br="([A-Z]+)\d+"/i);
      const type = attrs.match(/\bt="([^"]+)"/);
      const index = ref ? columnIndex(ref[1]) : cells.length;

      let value = "";
      if (type && type[1] === "s") {
        const i = Number(textOf(`<t>${body.replace(/<\/?v>/g, "")}</t>`) || body.replace(/<[^>]+>/g, ""));
        value = strings[i] ?? "";
      } else if (type && (type[1] === "inlineStr" || type[1] === "str")) {
        value = textOf(body) || decodeXml(body.replace(/<[^>]+>/g, ""));
      } else {
        value = decodeXml(body.replace(/<[^>]+>/g, "")).trim();
      }

      while (cells.length < index) cells.push("");
      cells[index] = String(value).trim();
    }
    while (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
    rows.push(cells);
  }
  return rows;
}

/**
 * @param {Buffer|Uint8Array} buffer
 * @param {{sheet?: number}} options 1-based sheet number, in workbook order
 * @returns {Promise<string[][]>}
 */
export async function readXlsxRows(buffer, { sheet = 1 } = {}) {
  const zip = await JSZip.loadAsync(buffer);
  const sheetFile = zip.file(`xl/worksheets/sheet${sheet}.xml`);
  if (!sheetFile) throw new Error(`Sheet ${sheet} is not in this workbook`);
  const stringsFile = zip.file("xl/sharedStrings.xml");
  const strings = parseSharedStrings(stringsFile ? await stringsFile.async("string") : "");
  return parseSheet(await sheetFile.async("string"), strings);
}

/** How many worksheets the workbook holds. */
export async function countSheets(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  return Object.keys(zip.files).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).length;
}

/**
 * Rows as objects, keyed by the header row.
 * Header cells are lowercased and stripped to letters and digits, so
 * "Song Title" and "song title " both become `songtitle`.
 */
export function rowsToRecords(rows) {
  if (rows.length === 0) return [];
  const header = rows[0].map((cell) => String(cell).toLowerCase().replace(/[^a-z0-9]+/g, ""));
  return rows.slice(1).map((row) => {
    const record = {};
    header.forEach((name, i) => {
      if (name) record[name] = row[i] ?? "";
    });
    return record;
  });
}
