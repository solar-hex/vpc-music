import { describe, expect, it } from "vitest";
import { buildGapReport, formatGapReport, siteOf } from "./gap-report.mjs";

const have = [
  { id: "a", title: "Way Maker", aka: null, source: "chrd", artist: "Sinach" },
  { id: "b", title: "Nothing But The Blood", aka: null, source: "chrd", artist: null },
  { id: "c", title: "Nothing But the Blood", aka: null, source: "docx", artist: null },
  { id: "d", title: "A Mother Like You", aka: null, source: "chrd", artist: null },
];

const targeted = [
  { title: "Way Maker", status: "Done", batch: null, metadata: null, tags: null, url: null },
  { title: "Nothing But The Blood", status: "Test", batch: null, metadata: null, tags: null, url: null },
  { title: "Midnight Cry", status: null, batch: 14, metadata: null, tags: null, url: null },
  { title: "Through It All", status: "Later", batch: null, metadata: "Andraé Crouch", tags: null, url: null },
  { title: "Send It On Down", status: null, batch: null, metadata: null, tags: null, url: null },
];

const master = [
  { title: "Way Maker", source: "https://wordtoworship.com/songs", note: null },
  { title: "Midnight Cry", source: "http://www.traditionalmusic.co.uk/country-gospel-chords/", note: null },
  { title: "Through It All", source: "https://www.traditionalmusic.co.uk/x", note: null },
  { title: "Send It On Down", source: null, note: "lyrics" },
];

const report = buildGapReport({ have, targeted, master });

describe("siteOf", () => {
  it("reduces a URL to its site and strips www", () => {
    expect(siteOf("https://www.traditionalmusic.co.uk/country-gospel-chords/")).toBe("traditionalmusic.co.uk");
    expect(siteOf("http://wordtoworship.com/songs")).toBe("wordtoworship.com");
  });

  it("refuses to call a note a website", () => {
    // The index carries ~980 rows whose second column is a note, not a link.
    // Treating those as sites invented a source website called "lyrics".
    expect(siteOf("other locations")).toBeNull();
    expect(siteOf("")).toBeNull();
    expect(siteOf(null)).toBeNull();
  });
});

describe("buildGapReport", () => {
  it("counts what is asked for against what is here", () => {
    expect(report.totals.targeted).toBe(5);
    expect(report.totals.have).toBe(2);
    expect(report.totals.missing).toBe(3);
    expect(report.totals.library).toBe(4);
  });

  it("matches regardless of case, so one song is not counted as two", () => {
    expect(report.missing.map((r) => r.title)).not.toContain("Nothing But The Blood");
  });

  it("groups the missing by the site that can supply them", () => {
    expect(report.bySite["traditionalmusic.co.uk"]).toBe(2);
    expect(report.byIndexNote.lyrics).toBe(1);
    expect(report.totals.sourceable).toBe(2);
  });

  it("keeps a numeric work batch out of the status tally", () => {
    // 340 rows carry a batch number where a status would go; counting those as
    // statuses made the biggest category "status 48", which says nothing.
    // Midnight Cry (batch 14) and Send It On Down both have no word status.
    expect(report.byStatus["(no status)"]).toBe(2);
    expect(report.byStatus["14"]).toBeUndefined();
    expect(report.byBatch[14]).toBe(1);
  });

  it("carries the credit the spreadsheet already knows", () => {
    expect(report.missing.find((r) => r.title === "Through It All")?.credit).toBe("Andraé Crouch");
  });

  it("names the songs no external list knows about — nobody will fill in their artist", () => {
    expect(report.ours.map((r) => r.title)).toEqual(["A Mother Like You"]);
    expect(report.totals.ours).toBe(1);
  });

  it("reports duplicate titles inside the library, with the sources that carry them", () => {
    expect(report.duplicates).toHaveLength(1);
    expect(report.duplicates[0]).toMatchObject({ count: 2, sources: ["chrd", "docx"] });
  });

  it("never proposes writing anything — the report is the whole output", () => {
    expect(Object.keys(report).sort()).toEqual(
      ["byBatch", "byIndexNote", "bySite", "byStatus", "duplicates", "missing", "ours", "probable", "totals"],
    );
  });
});

describe("formatGapReport", () => {
  const text = formatGapReport(report, { limit: 5 });

  it("leads with the counts and then the worklist, grouped by site", () => {
    expect(text).toContain("MISSING 3");
    expect(text).toContain("traditionalmusic.co.uk");
    expect(text).toContain("Midnight Cry");
  });

  it("flags a song the church marked Done that is not here", () => {
    const done = buildGapReport({
      have: [],
      targeted: [{ title: "Way Maker", status: "Done", batch: null, metadata: null, tags: null, url: null }],
      master: [],
    });
    expect(formatGapReport(done)).toContain("marked done but not in the library");
  });
});
