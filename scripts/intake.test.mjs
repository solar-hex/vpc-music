import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUCKETS, classify, formatSummary, moveFile, uniquePath } from "./intake.mjs";

const LIBRARY = [
  { id: "1", title: "God is Great", aka: null },
  { id: "2", title: "Amazing Grace", aka: null },
];

const CHRD_NEW = ["A Brand New Chorus", "G", "", "Chorus", "#[G]  [C]", "@ Sing a new song"].join("\n");
const CHRD_DUPE = ["God is Great", "F", "", "Chorus", "#[F]  [Bb]", "@ God is great"].join("\n");

const buf = (s) => Buffer.from(s, "utf8");

describe("classify", () => {
  it("files a new song for processing", async () => {
    const d = await classify("brand_new.chrd", buf(CHRD_NEW), { existingTitles: LIBRARY });
    expect(d.bucket).toBe("processed");
    expect(d.title).toBe("A Brand New Chorus");
    expect(d.conversion.chordProContent).toContain("{title: A Brand New Chorus}");
  });

  it("recognises a song the library already has", async () => {
    const d = await classify("god_is_great.chrd", buf(CHRD_DUPE), { existingTitles: LIBRARY });
    expect(d.bucket).toBe("duplicate");
    expect(d.match).toBe("God is Great");
    expect(d.confidence).toBe("exact");
  });

  it("flags a near-duplicate as probable rather than deciding for you", async () => {
    const near = ["Amazing Grace My Chains Are Gone", "G", "", "Chorus", "@ la"].join("\n");
    const d = await classify("x.chrd", buf(near), { existingTitles: LIBRARY });
    expect(d.bucket).toBe("duplicate");
    expect(d.confidence).toBe("probable");
    expect(d.note).toMatch(/check before discarding/i);
  });

  it("routes audio to media and reads its part", async () => {
    const d = await classify("Amen - Alto.m4a", buf("x"), { existingTitles: LIBRARY });
    expect(d.bucket).toBe("media");
    expect(d.detail).toContain("alto");
  });

  it("reads a tempo out of an audio filename", async () => {
    const d = await classify("My-Help-loop-bpm77.mp3", buf("x"), { existingTitles: LIBRARY });
    expect(d.detail).toContain("77 BPM");
  });

  it("routes an engraved-notation PDF to media and says why", async () => {
    const d = await classify("Holy-Ghost-Rhythm-Chart.pdf", buf("%PDF"), { existingTitles: LIBRARY });
    expect(d.bucket).toBe("media");
    expect(d.detail).toMatch(/no text to extract/);
  });

  it("routes a chord-chart PDF to media, noting the extractor is not built", async () => {
    const d = await classify("Way Maker - Chord Chart.pdf", buf("%PDF"), { existingTitles: LIBRARY });
    expect(d.bucket).toBe("media");
    expect(d.detail).toBe("chord-chart");
    expect(d.note).toMatch(/not built yet/);
  });

  it("rejects a format nothing reads, with a reason a person can act on", async () => {
    const d = await classify("notes.rtf", buf("x"), { existingTitles: LIBRARY });
    expect(d.bucket).toBe("rejected");
    expect(d.reason).toMatch(/\.rtf/);
  });

  it("rejects an archive rather than unpacking it silently", async () => {
    const d = await classify("songs.zip", buf("PK"), { existingTitles: LIBRARY });
    expect(d.bucket).toBe("rejected");
    expect(d.reason).toMatch(/extract it/i);
  });

  it("rejects a file it cannot read instead of throwing", async () => {
    const d = await classify("broken.docx", buf("not a zip"), { existingTitles: LIBRARY });
    expect(d.bucket).toBe("rejected");
    expect(d.reason).toMatch(/could not read it/i);
  });

  it("treats an empty library as everything being new", async () => {
    const d = await classify("god_is_great.chrd", buf(CHRD_DUPE), { existingTitles: [] });
    expect(d.bucket).toBe("processed");
  });
});

describe("filing", () => {
  let root;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "vpc-intake-"));
    for (const b of BUCKETS) await mkdir(join(root, b), { recursive: true });
  });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it("never overwrites something already filed", async () => {
    await writeFile(join(root, "processed", "a.chrd"), "first", "utf8");
    const next = await uniquePath(join(root, "processed"), "a.chrd");
    expect(next.endsWith("a (2).chrd")).toBe(true);
  });

  it("moves a file out of the inbox", async () => {
    const from = join(root, "src.chrd");
    await writeFile(from, "x", "utf8");
    const to = join(root, "processed", "src.chrd");
    await moveFile(from, to);
    expect(existsSync(from)).toBe(false);
    expect(await readFile(to, "utf8")).toBe("x");
  });
});

describe("formatSummary", () => {
  it("counts every bucket, including the empty ones", () => {
    const out = formatSummary([
      { decision: { bucket: "processed" } },
      { decision: { bucket: "duplicate" } },
      { decision: { bucket: "duplicate" } },
    ]);
    expect(out).toMatch(/processed\s+1/);
    expect(out).toMatch(/duplicate\s+2/);
    expect(out).toMatch(/media\s+0/);
    expect(out).toMatch(/rejected\s+0/);
  });
});
