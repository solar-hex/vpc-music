import { describe, expect, it } from "vitest";
import {
  VOCAL_PARTS,
  classifyAudioPart,
  classifyPdfPart,
  extractBpm,
  isNotationOnly,
  mediaKey,
} from "../corpus/mediaParts.js";

describe("extractBpm", () => {
  it("reads every BPM spelling seen in the library", () => {
    // All of these are real filenames from the UPCI tree.
    expect(extractBpm("Worthy-80BPM-Drum-Loop.mp3")).toBe(80);
    expect(extractBpm("My-Help-loop-bpm77.mp3")).toBe(77);
    expect(extractBpm("Ancient-of-Days-83bpm.m4a")).toBe(83);
    expect(extractBpm("Hallowed Be Your Name (Loop) 67.5 BPM.wav")).toBe(67.5);
    expect(extractBpm("Ain't No Grace - Loop - 76 BPM .wav")).toBe(76);
    expect(extractBpm("Jesus -Loop (165 BPM) 6_8.wav")).toBe(165);
    expect(extractBpm("After This Loop(141.5bpm).mp3")).toBe(141.5);
    expect(extractBpm("Even-Now-LONG_LOOP-80bpm.m4a")).toBe(80);
  });

  it("does not mistake track numbers or time signatures for a tempo", () => {
    expect(extractBpm("01-Glory.mp3")).toBeNull();
    expect(extractBpm("He's Worthy (Loop) 6_8.wav")).toBeNull();
    expect(extractBpm("Power In The Name - Alto.m4a")).toBeNull();
    expect(extractBpm("Song 2024.mp3")).toBeNull();
  });

  it("rejects values outside a plausible tempo range", () => {
    expect(extractBpm("weird-5bpm.mp3")).toBeNull();
    expect(extractBpm("weird-999bpm.mp3")).toBeNull();
  });
});

describe("classifyAudioPart", () => {
  it("normalises the three vocal parts across naming conventions", () => {
    expect(classifyAudioPart("Power In The Name - Alto.m4a").part).toBe("alto");
    expect(classifyAudioPart("Hes-In-The-Room/He's In The Room - Alto.mp3").part).toBe("alto");
    expect(classifyAudioPart("Our God Reigns - Tenor.mp3").part).toBe("tenor");
    expect(classifyAudioPart("We Bless The Name - Soprano.m4a").part).toBe("soprano");
    expect(classifyAudioPart("I Came To Magnify- Alto.m4a").part).toBe("alto");
    expect(classifyAudioPart("Bridges + Speak the Name - Alto.m4a").part).toBe("alto");
  });

  it("classifies loops and keeps their tempo", () => {
    expect(classifyAudioPart("My-Help-loop-bpm77.mp3")).toMatchObject({ part: "loop", bpm: 77 });
    expect(classifyAudioPart("Worthy-80BPM-Drum-Loop.mp3")).toMatchObject({ part: "drum-loop", bpm: 80 });
    expect(classifyAudioPart("Promised One - Loop (82bpm).wav")).toMatchObject({ part: "loop", bpm: 82 });
  });

  it("recognises stems by their folder", () => {
    const r = classifyAudioPart("nothing_but_the_blood_stems/Guitars.wav");
    expect(r.part).toBe("stem");
    expect(r.instrument).toBe("guitars");
  });

  it("falls back to full-mix rather than guessing", () => {
    expect(classifyAudioPart("01-Glory.mp3").part).toBe("full-mix");
    expect(classifyAudioPart("War - VPC CHOIR.m4a").part).toBe("full-mix");
  });

  it("does not match a part name inside a longer word", () => {
    expect(classifyAudioPart("Altogether Lovely.mp3").part).toBe("full-mix");
    expect(classifyAudioPart("Bassoon Feature.mp3").part).toBe("full-mix");
  });

  it("lists vocal parts in musical order", () => {
    expect(VOCAL_PARTS).toEqual(["soprano", "alto", "tenor", "baritone", "bass"]);
  });
});

describe("classifyPdfPart / isNotationOnly", () => {
  it("reads the UPCI part type from the filename", () => {
    expect(classifyPdfPart("Way Maker - Chord Chart.pdf")).toBe("chord-chart");
    expect(classifyPdfPart("Anthem-We-Raise-Numbers-Chart.pdf")).toBe("number-chart");
    expect(classifyPdfPart("Battle-Belongs-Rhythm-Chart.pdf")).toBe("rhythm-chart");
    expect(classifyPdfPart("For-My-Good-ERV.pdf")).toBe("erv");
    expect(classifyPdfPart("How-I-Need-You-Vocals-with-Chords.pdf")).toBe("vocals-with-chords");
  });

  it("knows which parts have no text layer and can never become songs", () => {
    expect(isNotationOnly("rhythm-chart")).toBe(true);
    expect(isNotationOnly("vocals")).toBe(true);
    expect(isNotationOnly("vocals-with-chords")).toBe(true);
    expect(isNotationOnly("chord-chart")).toBe(false);
    expect(isNotationOnly("number-chart")).toBe(false);
    expect(isNotationOnly("erv")).toBe(false);
  });
});

describe("mediaKey", () => {
  const song = { rootPath: "v1/prd", songSlug: "way-maker", songId: "7b3c1f2a-0000-5000-8000-000000000000" };

  it("mirrors the corpus naming so one identity threads everything", () => {
    expect(mediaKey({ ...song, kind: "audio", part: "alto", ext: ".m4a" })).toBe(
      "v1/prd/media/songs/way-maker--7b3c1f2a/audio/alto.m4a",
    );
    expect(mediaKey({ ...song, kind: "charts", part: "chord-chart", ext: "pdf" })).toBe(
      "v1/prd/media/songs/way-maker--7b3c1f2a/charts/chord-chart.pdf",
    );
  });

  it("keeps several loops distinct by tempo", () => {
    expect(mediaKey({ ...song, kind: "audio", part: "loop", bpm: 77, ext: ".mp3" })).toBe(
      "v1/prd/media/songs/way-maker--7b3c1f2a/audio/loop-77bpm.mp3",
    );
    expect(mediaKey({ ...song, kind: "audio", part: "drum-loop", bpm: 80, ext: ".mp3" })).toBe(
      "v1/prd/media/songs/way-maker--7b3c1f2a/audio/drum-loop-80bpm.mp3",
    );
  });

  it("names stems by instrument", () => {
    expect(mediaKey({ ...song, kind: "audio", part: "stem", instrument: "guitars", ext: ".wav" })).toBe(
      "v1/prd/media/songs/way-maker--7b3c1f2a/audio/stem-guitars.wav",
    );
  });

  it("keeps unclassified originals under source/", () => {
    expect(mediaKey({ ...song, kind: "source", ext: ".mid", originalPath: "VPC Praise/Preaching Chord Tutorial.mid" })).toBe(
      "v1/prd/media/songs/way-maker--7b3c1f2a/source/Preaching Chord Tutorial.mid",
    );
  });

  it("parks files with no known song under unmatched/ rather than dropping them", () => {
    expect(mediaKey({ rootPath: "v1/prd", kind: "audio", part: "alto", ext: ".m4a", originalPath: "Song Lists/mystery.m4a" })).toBe(
      "v1/prd/media/unmatched/Song Lists/mystery.m4a",
    );
  });

  it("works with no root path configured", () => {
    expect(mediaKey({ songSlug: "a", songId: "1234abcd-...", kind: "audio", part: "alto", ext: ".m4a" })).toBe(
      "media/songs/a--1234abcd/audio/alto.m4a",
    );
  });
});
