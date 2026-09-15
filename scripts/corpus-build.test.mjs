import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildChrdCorpus,
  collectDuplicateFiles,
  parseArgs,
  scoreChrdConversion,
} from "./corpus-build.mjs";
import {
  corpusFileName,
  deterministicSongId,
  slugifyTitle,
} from "../apps/api/src/corpus/identity.js";
import { enrichChordPro } from "../apps/api/src/corpus/enrich.js";

const GOD_IS_GREAT = [
  "God is Great",
  "F",
  "",
  "Chorus",
  "#[F]    [Bb]      [F]           [Bb]",
  "@ God is great and greatly to be praised",
  "#[F]    [C]         [F]",
  "@ God is great in my soul",
  "",
].join("\r\n");

const DRAFT_SONG = [
  "Jesus Is",
  "E",
  "",
  "Chorus",
  "^[ab]      [gb]",
  "#[E]       [B]",
  "@ He is the Truth",
  "* (repeat)",
  "",
].join("\r\n");

let tree;
let corpusDir;

beforeEach(async () => {
  const root = await mkdtemp(join(tmpdir(), "vpc-corpus-"));
  tree = join(root, "songList");
  corpusDir = join(root, "corpus");
  await mkdir(tree, { recursive: true });
  await writeFile(join(tree, "god_is_great.chrd"), GOD_IS_GREAT, "utf8");
  await writeFile(join(tree, "~jesus_is.chrd"), DRAFT_SONG, "utf8");
});

afterEach(async () => {
  if (tree) await rm(join(tree, ".."), { recursive: true, force: true });
});

describe("deterministicSongId", () => {
  it("still produces the exact ids that are in the production database", () => {
    /*
     * THE guard on the frozen namespace, and it has to be literal values.
     * Comparing the function against itself proves it is a function, not that
     * it is the RIGHT one: change the 16-byte namespace constant and every
     * self-consistency check still passes while all 909 production rows
     * orphan. These two ids are rows in prd-vpc-music today.
     */
    expect(deterministicSongId("amazing_grace.chrd")).toBe("35515dad-726f-5526-8f2b-3b3ec364f63a");
    expect(deterministicSongId("above_all.chrd")).toBe("a5da52f6-ef38-5d16-ba6b-c4f5c65e07ea");
  });

  it("is stable and normalises the path the same way every time", () => {
    expect(deterministicSongId("amazing_grace.chrd")).toBe(
      deterministicSongId("amazing_grace.chrd"),
    );
    expect(deterministicSongId("Amazing_Grace.CHRD")).toBe(
      deterministicSongId("amazing_grace.chrd"),
    );
    expect(deterministicSongId("a\\b.chrd")).toBe(deterministicSongId("a/b.chrd"));
    expect(deterministicSongId("amazing_grace.chrd")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe("slugifyTitle / corpusFileName", () => {
  it("produces ascii, lowercase, collision-resistant names", () => {
    expect(slugifyTitle("God is Great!")).toBe("god-is-great");
    expect(slugifyTitle("  It's All In Him  ")).toBe("it-s-all-in-him");
    expect(slugifyTitle("")).toBe("untitled");
    expect(slugifyTitle("!!!")).toBe("untitled");
    expect(slugifyTitle("x".repeat(90)).length).toBeLessThanOrEqual(60);
    expect(corpusFileName("God is Great", "7b3c1f2a-0000-5000-8000-000000000000")).toBe(
      "god-is-great--7b3c1f2a.chopro",
    );
  });
});

describe("scoreChrdConversion", () => {
  const base = { warnings: [], metadata: { key: "G" }, chordProContent: "{comment: Verse 1}\n[G]la" };

  it("scores a clean conversion 1.0 / high", () => {
    const result = scoreChrdConversion(base);
    expect(result.score).toBe(1);
    expect(result.band).toBe("high");
    expect(result.reasons).toEqual([]);
  });

  it("drops the band for blocks kept as plain text", () => {
    const result = scoreChrdConversion({ ...base, warnings: ["Block without line prefixes kept as plain text: \"Raise Key\""] });
    expect(result.score).toBeLessThan(1);
    expect(result.band).toBe("medium");
    expect(result.reasons.join(" ")).toMatch(/plain text/);
  });

  it("penalises a missing key and missing sections", () => {
    const result = scoreChrdConversion({ warnings: [], metadata: { key: null }, chordProContent: "[G]la" });
    expect(result.reasons).toContain("no key");
    expect(result.reasons).toContain("no sections detected");
  });

  it("is deterministic", () => {
    expect(scoreChrdConversion(base)).toEqual(scoreChrdConversion(base));
  });
});

describe("parseArgs", () => {
  it("requires a tree and a known source", () => {
    expect(() => parseArgs([])).toThrow(/--tree/);
    expect(() => parseArgs(["--tree", "x", "--source", "midi"])).toThrow(/--source must be one of/);
    expect(() => parseArgs(["--tree"])).toThrow(/Missing value/);
    expect(() => parseArgs(["--nope"])).toThrow(/Unknown argument/);
  });

  it("parses the supported flags", () => {
    expect(parseArgs(["--tree", "t", "--corpus", "c", "--dry-run", "--exclude", "~z_*"])).toEqual({
      source: "chrd",
      tree: "t",
      corpus: "c",
      dryRun: true,
      exclude: ["~z_*"],
      report: null,
    });
  });
});

describe("buildChrdCorpus", () => {
  it("converts a tree into songs, a manifest and a ledger", async () => {
    const summary = await buildChrdCorpus({ tree, corpusDir });

    expect(summary.counts.converted).toBe(2);
    expect(summary.counts.failed).toBe(0);
    expect(summary.counts.drafts).toBe(1);
    expect(summary.manifest.songs).toHaveLength(2);
    expect(summary.ledger.files).toHaveLength(2);

    const song = summary.manifest.songs.find((s) => s.title === "God is Great");
    expect(song.metadata.key).toBe("F");
    expect(song.metadata.isDraft).toBe(false);
    expect(song.sources[0]).toMatchObject({ role: "primary", path: "god_is_great.chrd" });
    expect(existsSync(join(corpusDir, song.file))).toBe(true);

    const content = await readFile(join(corpusDir, song.file), "utf8");
    expect(content).toContain("{title: God is Great}");
    expect(content).toContain("{key: F}");
    expect(content).not.toContain("[["); // the old double-bracket bug
    expect(content.endsWith("\n")).toBe(true);

    // the `~` filename is what marks a draft, not the title
    const draft = summary.manifest.songs.find((s) => s.title === "Jesus Is");
    expect(draft.metadata.isDraft).toBe(true);
    const draftContent = await readFile(join(corpusDir, draft.file), "utf8");
    expect(draftContent).toContain("[*ab]"); // secondary chord from the ^ line
    expect(draftContent).toContain("{ci:"); // the * line became an italic note
  });

  it("writes nothing when dryRun is set", async () => {
    const summary = await buildChrdCorpus({ tree, corpusDir, dryRun: true });
    expect(summary.counts.converted).toBe(2);
    expect(existsSync(corpusDir)).toBe(false);
  });

  it("is deterministic across rebuilds", async () => {
    await buildChrdCorpus({ tree, corpusDir });
    const first = await readFile(join(corpusDir, "manifest", "chrd.json"), "utf8");
    const firstLedger = await readFile(join(corpusDir, "sources", "chrd.json"), "utf8");

    await buildChrdCorpus({ tree, corpusDir, now: new Date("2099-01-01") });
    expect(await readFile(join(corpusDir, "manifest", "chrd.json"), "utf8")).toBe(first);
    // firstSeen must not be rewritten by a later run
    expect(await readFile(join(corpusDir, "sources", "chrd.json"), "utf8")).toBe(firstLedger);
  });

  it("keeps the song id when a source file is renamed", async () => {
    const before = await buildChrdCorpus({ tree, corpusDir });
    const original = before.manifest.songs.find((s) => s.title === "God is Great");

    await rename(join(tree, "god_is_great.chrd"), join(tree, "god_is_so_great.chrd"));
    const after = await buildChrdCorpus({ tree, corpusDir });
    const moved = after.manifest.songs.find((s) => s.title === "God is Great");

    expect(after.counts.moved).toBe(1);
    expect(after.moved[0]).toEqual({ from: "god_is_great.chrd", to: "god_is_so_great.chrd" });
    expect(moved.songId).toBe(original.songId);
    expect(moved.sources[0].path).toBe("god_is_so_great.chrd");
    // and it is NOT also reported as gone
    expect(after.counts.gone).toBe(0);
  });

  it("retains a record when a source disappears, and never deletes it", async () => {
    await buildChrdCorpus({ tree, corpusDir });
    await rm(join(tree, "~jesus_is.chrd"));

    const after = await buildChrdCorpus({ tree, corpusDir, now: new Date("2026-09-11") });
    expect(after.counts.gone).toBe(1);
    const record = after.ledger.files.find((f) => f.path === "~jesus_is.chrd");
    expect(record).toBeTruthy();
    expect(record.missingSince).toBe("2026-09-11");
    expect(record.songId).toBeTruthy();
  });

  it("detects changed content and refreshes the hash", async () => {
    const before = await buildChrdCorpus({ tree, corpusDir });
    const originalHash = before.manifest.songs.find((s) => s.title === "God is Great").contentSha256;

    await writeFile(join(tree, "god_is_great.chrd"), GOD_IS_GREAT.replace("my soul", "my heart"), "utf8");
    const after = await buildChrdCorpus({ tree, corpusDir });
    const updated = after.manifest.songs.find((s) => s.title === "God is Great");

    expect(updated.contentSha256).not.toBe(originalHash);
    // a chord token sits between "my" and the last word, so match the word alone
    expect(await readFile(join(corpusDir, updated.file), "utf8")).toContain("heart");
  });

  it("honours --exclude globs", async () => {
    const summary = await buildChrdCorpus({ tree, corpusDir, exclude: ["~*"] });
    expect(summary.counts.converted).toBe(1);
    expect(summary.skipped).toEqual(["~jesus_is.chrd"]);
  });

  it("reports duplicate titles without merging them", async () => {
    await writeFile(join(tree, "~god_is_great.chrd"), GOD_IS_GREAT, "utf8");
    const summary = await buildChrdCorpus({ tree, corpusDir });
    expect(summary.duplicateTitles).toEqual([
      { title: "god is great", files: ["god_is_great.chrd", "~god_is_great.chrd"] },
    ]);
    // both survive as separate songs — the converter proposes, it never merges
    expect(summary.manifest.songs.filter((s) => s.title === "God is Great")).toHaveLength(2);
    expect(summary.duplicateFiles).toEqual([]);
  });

  it("leaves a chart edited in the app alone, even when its source changes", async () => {
    const first = await buildChrdCorpus({ tree, corpusDir });
    const song = first.manifest.songs.find((s) => s.title === "God is Great");
    // what corpus:export does with an edit made in the app
    const edited = "{title: God is Great}\n{key: F}\n\n{comment: Chorus}\n[F]Edited in the app\n";
    await writeFile(join(corpusDir, song.file), edited, "utf8");
    const manifestPath = join(corpusDir, "manifest", "chrd.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const entry = manifest.songs.find((s) => s.songId === song.songId);
    Object.assign(entry, { appEdited: true, contentSha256: "hash-of-the-edit" });
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    await writeFile(join(tree, "god_is_great.chrd"), GOD_IS_GREAT.replace("my soul", "my heart"), "utf8");
    const second = await buildChrdCorpus({ tree, corpusDir });

    expect(await readFile(join(corpusDir, song.file), "utf8")).toBe(edited);
    expect(second.manifest.songs.find((s) => s.songId === song.songId)).toMatchObject({ appEdited: true, contentSha256: "hash-of-the-edit" });
    // the other song still rebuilds from its source
    const other = second.manifest.songs.find((s) => s.songId !== song.songId);
    expect(await readFile(join(corpusDir, other.file), "utf8")).toContain("{title: Jesus Is}");
  });

  it("writes what a merged song took from the copies it replaced into its chart", async () => {
    const id = deterministicSongId("god_is_great.chrd");
    await mkdir(corpusDir, { recursive: true });
    await writeFile(
      join(corpusDir, "merges.json"),
      JSON.stringify({ version: 1, songs: { [id]: { title: "God is Great", from: ["x"], carry: { artist: "Todd Dulaney", tempo: "82", time: "6/8", x_album: "Your Great Name" } } } }),
      "utf8",
    );
    const summary = await buildChrdCorpus({ tree, corpusDir });
    const song = summary.manifest.songs.find((s) => s.songId === id);
    const content = await readFile(join(corpusDir, song.file), "utf8");
    expect(content).toContain("{artist: Todd Dulaney}");
    expect(content).toContain("{tempo: 82}");
    expect(content).toContain("{time: 6/8}");
    expect(content).toContain("{x_album: Your Great Name}");
    // the chart keeps its own key
    expect(content).toContain("{key: F}");

    const other = summary.manifest.songs.find((s) => s.songId !== id);
    expect(await readFile(join(corpusDir, other.file), "utf8")).not.toContain("Todd Dulaney");
  });

  it("throws when the source tree is missing", async () => {
    await expect(buildChrdCorpus({ tree: join(tree, "nope"), corpusDir })).rejects.toThrow(
      /does not exist/,
    );
  });
});

describe("collectDuplicateFiles", () => {
  it("catches two songs resolving to the same corpus filename", () => {
    const entries = [
      { file: "songs/chrd/a--1111.chopro", songId: "1111" },
      { file: "songs/chrd/a--1111.chopro", songId: "2222" },
      { file: "songs/chrd/b--3333.chopro", songId: "3333" },
    ];
    expect(collectDuplicateFiles(entries)).toEqual([
      { file: "songs/chrd/a--1111.chopro", songIds: ["1111", "2222"] },
    ]);
  });
});

describe("enrichChordPro carry", () => {
  const base = {
    content: "{title: King of Glory}\n{key: G}\n\n[G]Lift up your heads\n",
    metadata: { title: "King of Glory", key: "G" },
  };

  it("fills only what the chart lacks, and never the key", () => {
    const out = enrichChordPro({
      ...base,
      metadata: { ...base.metadata, artist: "VPC" },
      carry: { artist: "Todd Dulaney", tempo: "82", key: "Bb", x_writers: "Todd Dulaney" },
    });
    expect(out).toContain("{artist: VPC}");
    expect(out).not.toContain("{artist: Todd Dulaney}");
    expect(out).toContain("{tempo: 82}");
    expect(out).toContain("{key: G}");
    expect(out).not.toContain("Bb");
    expect(out).toContain("{x_writers: Todd Dulaney}");
  });

  it("prefers a carried tempo to one guessed from a media filename", () => {
    const out = enrichChordPro({ ...base, derivedTempo: 90, carry: { tempo: "82" } });
    expect(out).toContain("{tempo: 82}");
    expect(out).not.toContain("x_tempo_source");
  });

  it("adds carried alternate titles to the reviewed ones, once each", () => {
    const out = enrichChordPro({
      ...base,
      aka: ["Lift Up Your Heads"],
      carry: { aka: ["lift up your heads", "Who Is This King"] },
    });
    expect(out).toContain("{x_aka: Lift Up Your Heads; Who Is This King}");
  });

  it("never overrides an album the chart already carries", () => {
    const out = enrichChordPro({
      ...base,
      content: "{title: King of Glory}\n{x_album: Live}\n\n[G]Lift\n",
      carry: { x_album: "Studio" },
    });
    expect(out).toContain("{x_album: Live}");
    expect(out).not.toContain("Studio");
  });

  it("changes nothing without a carry", () => {
    expect(enrichChordPro({ ...base, carry: {} })).toBe(enrichChordPro(base));
  });
});

