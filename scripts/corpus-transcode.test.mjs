import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mp3KeyFor, planTranscodes, readMediaRecords, withTranscode } from "./corpus-transcode.mjs";
import { loadMediaIndex } from "../apps/api/src/corpus/mediaIndex.js";
import { mediaDirectiveKey } from "../apps/api/src/corpus/enrich.js";

const record = (key, over = {}) => ({ path: `UPCI/${key}`, size: 1000, scope: "song", songName: "A Better Word", part: "tenor", bpm: null, key, ...over });

describe("planTranscodes", () => {
  it("picks WAV and AIFF parts, and nothing that already plays", () => {
    const records = [
      record("v1/prd/media/songs/a/audio/tenor.wav"),
      record("v1/prd/media/songs/a/audio/loop.aif"),
      record("v1/prd/media/songs/a/audio/alto.mp3"),
      record("v1/prd/media/songs/a/charts/chord-chart.pdf"),
    ];
    expect(planTranscodes(records).todo.map((r) => r.key)).toEqual([
      "v1/prd/media/songs/a/audio/loop.aif",
      "v1/prd/media/songs/a/audio/tenor.wav",
    ]);
  });

  it("leaves a part that already has an MP3 of the same name, and one done before", () => {
    const records = [
      record("v1/prd/media/songs/a/audio/soprano.wav"),
      record("v1/prd/media/songs/a/audio/soprano.mp3"),
      record("v1/prd/media/songs/a/audio/full-mix.wav"),
    ];
    const plan = planTranscodes(records, { "v1/prd/media/songs/a/audio/full-mix.wav": { key: "x.mp3" } });
    expect(plan.todo).toEqual([]);
    expect(plan.alreadyMp3.map((r) => r.key)).toEqual(["v1/prd/media/songs/a/audio/soprano.wav"]);
  });

  it("names the copy after the original, keeping its part name", () => {
    expect(mp3KeyFor("v1/prd/media/songs/a/audio/loop-76bpm.WAV")).toBe("v1/prd/media/songs/a/audio/loop-76bpm.mp3");
    expect(mp3KeyFor("v1/prd/media/songs/a/audio/loop.aiff")).toBe("v1/prd/media/songs/a/audio/loop.mp3");
    // same directive, so the chart's button does not change
    expect(mediaDirectiveKey(mp3KeyFor("audio/loop-76bpm.wav"))).toBe(mediaDirectiveKey("audio/loop-76bpm.wav"));
  });
});

describe("withTranscode", () => {
  it("adds an entry and keeps the file in a stable order", () => {
    const first = withTranscode(null, "b.wav", { key: "b.mp3", size: 10, seconds: 3 });
    const both = withTranscode(first, "a.wav", { key: "a.mp3", size: 20, seconds: 4 });
    expect(Object.keys(both.files)).toEqual(["a.wav", "b.wav"]);
    expect(both.files["b.wav"]).toEqual({ key: "b.mp3", size: 10, seconds: 3 });
  });
});

describe("the build links the copy", () => {
  it("points a part at its MP3 under the original's name, and leaves the rest alone", async () => {
    const root = await mkdtemp(join(tmpdir(), "vpc-transcode-"));
    try {
      await mkdir(join(root, "media"));
      const ledger = [
        record("v1/prd/media/songs/a-better-word/audio/tenor.wav"),
        record("v1/prd/media/songs/a-better-word/audio/alto.mp3", { part: "alto" }),
      ];
      await writeFile(join(root, "media", "tree.ndjson"), ledger.map((r) => JSON.stringify(r)).join("\n"), "utf8");
      await writeFile(
        join(root, "media", "transcoded.json"),
        JSON.stringify(withTranscode(null, "v1/prd/media/songs/a-better-word/audio/tenor.wav", { key: "v1/prd/media/songs/a-better-word/audio/tenor.mp3", size: 1, seconds: 1 })),
        "utf8",
      );

      // the transcode ledger is not read as a media ledger
      expect((await readMediaRecords(root)).map((r) => r.key)).toHaveLength(2);

      const index = await loadMediaIndex(root, { endpoint: "https://store.example", bucket: "b" });
      const media = index.forTitle("A Better Word").media;
      const tenor = media.find((m) => m.key.endsWith("tenor.wav"));
      expect(tenor.url).toBe("https://store.example/b/v1/prd/media/songs/a-better-word/audio/tenor.mp3");
      expect(mediaDirectiveKey(tenor.key)).toBe("x_audio_tenor");
      expect(media.find((m) => m.key.endsWith("alto.mp3")).url).toBe("https://store.example/b/v1/prd/media/songs/a-better-word/audio/alto.mp3");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
