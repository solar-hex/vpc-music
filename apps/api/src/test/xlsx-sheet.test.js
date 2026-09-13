import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { columnIndex, countSheets, parseSharedStrings, parseSheet, readXlsxRows, rowsToRecords } from "../corpus/xlsxSheet.js";

describe("columnIndex", () => {
  it("reads spreadsheet column letters as positions", () => {
    expect(columnIndex("A1")).toBe(0);
    expect(columnIndex("B7")).toBe(1);
    expect(columnIndex("Z1")).toBe(25);
    expect(columnIndex("AA1")).toBe(26);
    expect(columnIndex("BC12")).toBe(54);
  });
});

describe("parseSharedStrings", () => {
  it("reads the string table, entities and all", () => {
    const xml = `<sst><si><t>Way Maker</t></si><si><t>Rock &amp; Roll</t></si><si><t>He&#39;s Alive</t></si></sst>`;
    expect(parseSharedStrings(xml)).toEqual(["Way Maker", "Rock & Roll", "He's Alive"]);
  });

  it("joins the runs a formatted cell is split into", () => {
    // Excel splits a cell across <r> runs the moment one word is bold.
    const xml = `<sst><si><r><t>Nothing But </t></r><r><t>The Blood</t></r></si></sst>`;
    expect(parseSharedStrings(xml)).toEqual(["Nothing But The Blood"]);
  });

  it("survives a workbook with no string table", () => {
    expect(parseSharedStrings("")).toEqual([]);
  });
});

describe("parseSheet", () => {
  const strings = ["Song", "Status", "Way Maker", "Done"];

  it("resolves shared-string cells", () => {
    const xml = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
      <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row>
    </sheetData></worksheet>`;
    expect(parseSheet(xml, strings)).toEqual([["Song", "Status"], ["Way Maker", "Done"]]);
  });

  it("keeps a gap in the middle of a row so columns still line up", () => {
    // THE reason cell refs are read rather than counted: Excel omits empty
    // cells entirely, so a counted row would shift every later column left.
    const xml = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>
    </sheetData></worksheet>`;
    expect(parseSheet(xml, strings)).toEqual([["Way Maker", "", "", "Done"]]);
  });

  it("reads numbers and inline strings", () => {
    const xml = `<worksheet><sheetData>
      <row r="1"><c r="A1"><v>48</v></c><c r="B1" t="inlineStr"><is><t>Later</t></is></c></row>
    </sheetData></worksheet>`;
    expect(parseSheet(xml, [])).toEqual([["48", "Later"]]);
  });

  it("drops trailing empties but keeps a fully empty row", () => {
    const xml = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>2</v></c><c r="B1"><v></v></c></row>
      <row r="2"></row>
    </sheetData></worksheet>`;
    expect(parseSheet(xml, strings)).toEqual([["Way Maker"], []]);
  });
});

describe("rowsToRecords", () => {
  it("keys rows by a normalised header", () => {
    const rows = [["Song Title", "Status ", "Meta Data"], ["Way Maker", "Done", "Sinach"]];
    expect(rowsToRecords(rows)).toEqual([{ songtitle: "Way Maker", status: "Done", metadata: "Sinach" }]);
  });

  it("returns nothing for an empty sheet", () => {
    expect(rowsToRecords([])).toEqual([]);
  });
});

describe("readXlsxRows", () => {
  /** A real .xlsx is a zip of these three files — no binary fixture needed. */
  async function workbook() {
    const zip = new JSZip();
    zip.file(
      "xl/sharedStrings.xml",
      `<sst><si><t>Song</t></si><si><t>Status</t></si><si><t>Holy Forever</t></si><si><t>Test</t></si></sst>`,
    );
    zip.file("xl/worksheets/sheet1.xml", `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>`);
    zip.file(
      "xl/worksheets/sheet2.xml",
      `<worksheet><sheetData>
        <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
        <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row>
      </sheetData></worksheet>`,
    );
    return zip.generateAsync({ type: "nodebuffer" });
  }

  it("reads the sheet asked for, not just the first", async () => {
    const buffer = await workbook();
    expect(await countSheets(buffer)).toBe(2);
    expect(await readXlsxRows(buffer, { sheet: 2 })).toEqual([["Song", "Status"], ["Holy Forever", "Test"]]);
    expect(await readXlsxRows(buffer)).toEqual([["Song"]]);
  });

  it("says which sheet is missing rather than returning nothing", async () => {
    await expect(readXlsxRows(await workbook(), { sheet: 9 })).rejects.toThrow(/Sheet 9/);
  });
});
