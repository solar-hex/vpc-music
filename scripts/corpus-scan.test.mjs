import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, rm, writeFile, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MTIME_TOLERANCE_MS,
  classifyFile,
  classifyPdfPart,
  diffAgainstLedger,
  isNotationOnly,
  looksUnchanged,
  parseArgs,
  walkTree,
} from "./corpus-scan.mjs";
import { sha256 } from "../apps/api/src/corpus/identity.js";

describe("classifyFile", () => {
  it("routes song formats to converters and everything heavy to media", () => {
    expect(classifyFile("a/b.chrd")).toMatchObject({ type: "chrd", media: false });
    expect(classifyFile("a/b.docx")).toMatchObject({ type: "docx", media: false });
    expect(classifyFile("a/b.onsong")).toMatchObject({ type: "onsong", media: false });
    expect(classifyFile("a/b.txt")).toMatchObject({ type: "text", media: false });
    expect(classifyFile("a/b.pdf")).toMatchObject({ type: "pdf", media: false });
  });

  it("marks audio, video and archives as media so they are never opened", () => {
    for (const name of ["x.mp3", "x.m4a", "x.wav", "x.aif", "x.zip", "x.mp4", "x.png"]) {
      expect(classifyFile(name).media, name).toBe(true);
    }
  });
});

describe("classifyPdfPart", () => {
  it("reads the UPCI part type out of the filename", () => {
    expect(classifyPdfPart("Way Maker - Chord Chart.pdf")).toBe("chord-chart");
    expect(classifyPdfPart("Way-Maker-Number-Chart.pdf")).toBe("number-chart");
    expect(classifyPdfPart("Anthem-We-Raise-Numbers-Chart.pdf")).toBe("number-chart");
    expect(classifyPdfPart("Battle-Belongs-Rhythm-Chart.pdf")).toBe("rhythm-chart");
    expect(classifyPdfPart("For-My-Good-ERV.pdf")).toBe("erv");
    expect(classifyPdfPart("Thank-You-easy-read-vocals.pdf")).toBe("erv");
    expect(classifyPdfPart("How-I-Need-You-Vocals-with-Chords.pdf")).toBe("vocals-with-chords");
    expect(classifyPdfPart("Your-Amazing-Love-Vocals.pdf")).toBe("vocals");
    expect(classifyPdfPart("something-else.pdf")).toBe("other");
  });

  it("knows which part types are engraved notation with no text layer", () => {
    // Measured: rhythm charts and vocals embed Sibelius music fonts and carry
    // zero text-show operators. They cannot become songs.
    expect(isNotationOnly("rhythm-chart")).toBe(true);
    expect(isNotationOnly("vocals")).toBe(true);
    expect(isNotationOnly("vocals-with-chords")).toBe(true);
    expect(isNotationOnly("chord-chart")).toBe(false);
    expect(isNotationOnly("number-chart")).toBe(false);
  });
});

describe("looksUnchanged", () => {
  const prev = { size: 100, mtimeMs: 1_000_000 };

  it("requires an exact size match", () => {
    expect(looksUnchanged({ size: 101, mtimeMs: 1_000_000 }, prev)).toBe(false);
  });

  it("tolerates sync-client timestamp drift", () => {
    // Dropbox/OneDrive/FAT lose sub-second precision and drift up to 2s.
    expect(looksUnchanged({ size: 100, mtimeMs: 1_000_000 + MTIME_TOLERANCE_MS }, prev)).toBe(true);
    expect(looksUnchanged({ size: 100, mtimeMs: 1_000_000 - MTIME_TOLERANCE_MS }, prev)).toBe(true);
    expect(looksUnchanged({ size: 100, mtimeMs: 1_000_000 + MTIME_TOLERANCE_MS + 1 }, prev)).toBe(false);
  });

  it("is false with no previous record", () => {
    expect(looksUnchanged({ size: 100, mtimeMs: 1 }, undefined)).toBe(false);
  });
});

describe("parseArgs", () => {
  it("requires a tree", () => {
    expect(() => parseArgs([])).toThrow(/--tree/);
    expect(() => parseArgs(["--bogus"])).toThrow(/Unknown argument/);
  });

  it("parses gates and flags", () => {
    expect(parseArgs(["--tree", "t", "--rehash", "--fail-on", "new,changed", "--json"])).toEqual({
      tree: "t",
      ledger: null,
      rehash: true,
      failOn: ["new", "changed"],
      json: true,
    });
  });
});

describe("walkTree", () => {
  let root;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "vpc-scan-"));
    await mkdir(join(root, "songs"), { recursive: true });
    await mkdir(join(root, ".vs"), { recursive: true });
    await writeFile(join(root, "songs", "a.chrd"), "A\nG\n", "utf8");
    await writeFile(join(root, "songs", "b.mp3"), "not really audio", "utf8");
    await writeFile(join(root, ".vs", "state.json"), "{}", "utf8");
    await writeFile(join(root, "Thumbs.db"), "x", "utf8");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("collects stats only and skips tool directories and junk files", async () => {
    const files = await walkTree(root);
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(["songs/a.chrd", "songs/b.mp3"]);
    expect(files[0]).toHaveProperty("size");
    expect(files[0]).toHaveProperty("mtimeMs");
  });
});

describe("diffAgainstLedger", () => {
  const file = (path, size, mtimeMs = 1_000_000) => ({ path, fullPath: `/abs/${path}`, size, mtimeMs });

  /** Counting hash so we can assert exactly which files were opened. */
  function countingHash(contents = {}) {
    const opened = [];
    const fn = async (fullPath) => {
      opened.push(fullPath);
      return sha256(contents[fullPath] ?? fullPath);
    };
    fn.opened = opened;
    return fn;
  }

  it("reports everything as new against an empty ledger", async () => {
    const hash = countingHash();
    const result = await diffAgainstLedger({ files: [file("a.chrd", 10)], previous: [], hash });
    expect(result.new).toHaveLength(1);
    expect(result.covered).toHaveLength(0);
    expect(result.hashed).toBe(1);
  });

  it("NEVER hashes media, even when it is new", async () => {
    const hash = countingHash();
    const files = [file("song.mp3", 5_000_000_000), file("stems.zip", 900_000_000), file("a.chrd", 10)];
    const result = await diffAgainstLedger({ files, previous: [], hash });

    // Opening a cloud placeholder would hydrate gigabytes.
    expect(hash.opened).toEqual(["/abs/a.chrd"]);
    expect(result.hashed).toBe(1);
    expect(result.new).toHaveLength(3);
    expect(result.byType.media.total).toBe(2);
  });

  it("uses size+mtime to avoid hashing unchanged files", async () => {
    const hash = countingHash();
    const previous = [{ path: "a.chrd", size: 10, mtimeMs: 1_000_000, sha256: "whatever", songId: "id-1" }];
    const result = await diffAgainstLedger({ files: [file("a.chrd", 10)], previous, hash });

    expect(hash.opened).toEqual([]);
    expect(result.hashed).toBe(0);
    expect(result.covered).toHaveLength(1);
    expect(result.covered[0].songId).toBe("id-1");
  });

  it("re-hashes on demand", async () => {
    const hash = countingHash();
    const previous = [{ path: "a.chrd", size: 10, mtimeMs: 1_000_000, sha256: sha256("/abs/a.chrd"), songId: "id-1" }];
    const result = await diffAgainstLedger({ files: [file("a.chrd", 10)], previous, rehash: true, hash });
    expect(result.hashed).toBe(1);
    expect(result.covered).toHaveLength(1);
  });

  it("detects a changed file when size differs", async () => {
    const hash = countingHash();
    const previous = [{ path: "a.chrd", size: 10, mtimeMs: 1_000_000, sha256: "old", songId: "id-1" }];
    const result = await diffAgainstLedger({ files: [file("a.chrd", 99)], previous, hash });
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].songId).toBe("id-1");
    expect(result.covered).toHaveLength(0);
  });

  it("recognises a rename as moved and keeps the song id", async () => {
    const hash = countingHash();
    const digest = sha256("/abs/renamed.chrd");
    const previous = [{ path: "original.chrd", size: 10, mtimeMs: 1_000_000, sha256: digest, songId: "id-1" }];
    const result = await diffAgainstLedger({ files: [file("renamed.chrd", 10)], previous, hash });

    expect(result.moved).toHaveLength(1);
    expect(result.moved[0]).toMatchObject({ from: "original.chrd", path: "renamed.chrd", songId: "id-1" });
    expect(result.new).toHaveLength(0);
    // a move must not also be reported as gone
    expect(result.gone).toHaveLength(0);
  });

  it("reports a vanished file as gone without deleting its record", async () => {
    const hash = countingHash();
    const previous = [{ path: "a.chrd", size: 10, mtimeMs: 1_000_000, sha256: "x", songId: "id-1" }];
    const result = await diffAgainstLedger({ files: [], previous, hash });
    expect(result.gone).toHaveLength(1);
    expect(result.gone[0].songId).toBe("id-1");
  });

  it("survives an unreadable directory instead of aborting the scan", async () => {
    const hash = countingHash();
    const files = [{ path: "locked", error: "EPERM" }, file("a.chrd", 10)];
    const result = await diffAgainstLedger({ files, previous: [], hash });
    expect(result.errors).toHaveLength(1);
    expect(result.new).toHaveLength(1);
  });
});
