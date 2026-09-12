import { describe, expect, it } from "vitest";
import { locateFile, parseArgs, planFile, resolveKeyCollisions, summarise } from "./corpus-media.mjs";

const songsByTitle = new Map([
  ["holy ghost", { songId: "f162ec06-1111-5000-8000-000000000000", title: "Holy Ghost" }],
]);
const plan = (path, size = 100) =>
  planFile({ relativePath: path, size, rootPath: "v1/prd", songsByTitle });

describe("locateFile", () => {
  it("finds the song folder through year and container directories", () => {
    expect(locateFile("UPCI Song Parts TG/UPCI Music/2022/Holy Ghost/Holy-Ghost-ERV.pdf")).toEqual({
      scope: "song",
      songName: "Holy Ghost",
    });
    expect(locateFile("UPCI Song Parts TG/UPCI Music/Way Maker/Way Maker - Chord Chart.pdf")).toEqual({
      scope: "song",
      songName: "Way Maker",
    });
  });

  it("looks through vocal-part and stems subfolders to the real song", () => {
    expect(
      locateFile("UPCI Music/2022/Holy Ghost/Holy-Ghost-Vocal-Part-MP3s/Holy Ghost - Alto.mp3").songName,
    ).toBe("Holy Ghost");
    expect(
      locateFile("UPCI Music/Nothing But The Blood Medley/nothing_but_the_blood_stems/Guitars.wav").songName,
    ).toBe("Nothing But The Blood Medley");
  });

  it("routes non-song material to the library", () => {
    expect(locateFile("Song Lists/0-Complete-Chorusbook.pdf").scope).toBe("library");
    expect(locateFile("Lessons/0-eBook-AP-601-SHOUT.pdf").scope).toBe("library");
    expect(locateFile("Landmark-Platform-Dress-Code-2024.pdf").scope).toBe("library");
  });

  it("treats VPC Praise song folders as songs", () => {
    expect(locateFile("VPC Praise/I Came To Magnify/I Came To Magnify- Alto.m4a")).toEqual({
      scope: "song",
      songName: "I Came To Magnify",
    });
  });
});

describe("planFile", () => {
  it("attaches to an existing chart when the title matches", () => {
    const e = plan("UPCI Music/2022/Holy Ghost/Holy-Ghost-150BPM-Drum-Loop.mp3");
    expect(e.songId).toBe("f162ec06-1111-5000-8000-000000000000");
    expect(e.bpm).toBe(150);
    expect(e.key).toBe("v1/prd/media/songs/holy-ghost--f162ec06/audio/drum-loop-150bpm.mp3");
  });

  it("still groups by song when no chart exists yet — no id in the key", () => {
    const e = plan("UPCI Music/2021/Way Maker/Way Maker - Chord Chart.pdf");
    expect(e.songId).toBeNull();
    expect(e.key).toBe("v1/prd/media/songs/way-maker/charts/chord-chart.pdf");
  });

  it("keeps library material under its original path", () => {
    const e = plan("Song Lists/0-Complete-Chorusbook.pdf");
    expect(e.scope).toBe("library");
    expect(e.key).toBe("v1/prd/media/library/Song Lists/0-Complete-Chorusbook.pdf");
  });

  it("files unclassifiable extensions under source/", () => {
    const e = plan("VPC Praise/I Came To Magnify/notes.mid");
    expect(e.key).toBe("v1/prd/media/songs/i-came-to-magnify/source/notes.mid");
  });
});

describe("resolveKeyCollisions", () => {
  it("breaks a collision using the source filename rather than overwriting", () => {
    const entries = [
      plan("UPCI Music/All of Me/All-Of-Me-chord-chart.pdf"),
      plan("UPCI Music/All of Me/All-Of-Me-Something-Else.pdf"),
    ];
    // both classify as a chart part that collapses to the same leaf
    entries[0].key = "v1/prd/media/songs/all-of-me/charts/other.pdf";
    entries[1].key = "v1/prd/media/songs/all-of-me/charts/other.pdf";

    const { resolved } = resolveKeyCollisions(entries);
    expect(resolved).toHaveLength(1);
    expect(entries[0].key).not.toBe(entries[1].key);
    expect(entries[0].key).toContain("all-of-me-chord-chart.pdf");
    expect(entries[1].key).toContain("all-of-me-something-else.pdf");
  });

  it("guarantees every key is unique, even if source names also collide", () => {
    const entries = [
      { path: "a/x.pdf", key: "k/charts/other.pdf", size: 1 },
      { path: "b/x.pdf", key: "k/charts/other.pdf", size: 1 },
      { path: "c/x.pdf", key: "k/charts/other.pdf", size: 1 },
    ];
    resolveKeyCollisions(entries);
    expect(new Set(entries.map((e) => e.key)).size).toBe(3);
  });

  it("leaves non-colliding keys untouched", () => {
    const entries = [
      { path: "a/alto.mp3", key: "k/audio/alto.mp3", size: 1 },
      { path: "a/tenor.mp3", key: "k/audio/tenor.mp3", size: 1 },
    ];
    const { resolved } = resolveKeyCollisions(entries);
    expect(resolved).toEqual([]);
    expect(entries[0].key).toBe("k/audio/alto.mp3");
    expect(entries[1].key).toBe("k/audio/tenor.mp3");
  });
});

describe("summarise", () => {
  it("counts songs, matches, library files and tempos", () => {
    const entries = [
      plan("UPCI Music/2022/Holy Ghost/Holy-Ghost-150BPM-Drum-Loop.mp3", 10),
      plan("UPCI Music/2022/Holy Ghost/Holy-Ghost-ERV.pdf", 20),
      plan("UPCI Music/Way Maker/Way Maker - Chord Chart.pdf", 30),
      plan("Song Lists/book.pdf", 40),
    ];
    const s = summarise(entries);
    expect(s.files).toBe(4);
    expect(s.bytes).toBe(100);
    expect(s.songs).toBe(2);
    expect(s.matched).toBe(2);
    expect(s.library).toBe(1);
    expect(s.withBpm).toBe(1);
  });
});

describe("parseArgs", () => {
  it("defaults to a dry run", () => {
    expect(parseArgs(["--tree", "t"]).apply).toBe(false);
    expect(parseArgs(["--tree", "t", "--apply"]).apply).toBe(true);
  });

  it("validates arguments", () => {
    expect(() => parseArgs([])).toThrow(/--tree/);
    expect(() => parseArgs(["--nope"])).toThrow(/Unknown argument/);
    expect(() => parseArgs(["--tree"])).toThrow(/Missing value/);
  });
});
