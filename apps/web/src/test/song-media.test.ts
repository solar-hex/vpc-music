import { describe, it, expect } from "vitest";
import { audioPartOf, bpmFromKey, chartPartOf, songMedia } from "@/lib/song-media";

const URL = "https://s3.us-central-1.wasabisys.com/proj-vpcmusic/v1/prd/media/songs/x/audio/a.mp3";
const labels = (directives: Record<string, string>) => songMedia(directives).audio.map((t) => t.label);

describe("audioPartOf", () => {
  it("reads the plain voice keys", () => {
    expect(audioPartOf("x_audio_soprano")).toBe("soprano");
    expect(audioPartOf("x_audio_alto")).toBe("alto");
    expect(audioPartOf("x_audio_tenor")).toBe("tenor");
    expect(audioPartOf("x_audio_full_mix")).toBe("full-mix");
  });

  it("reads a voice at the end of a song-name-prefixed key", () => {
    expect(audioPartOf("x_audio_jesus_soprano")).toBe("soprano");
    expect(audioPartOf("x_audio_jesus_geoffery_golden_alto")).toBe("alto");
    expect(audioPartOf("x_audio_speak_your_name_soprano")).toBe("soprano");
  });

  it("strips trailing dedupe counters", () => {
    expect(audioPartOf("x_audio_speak_the_name_tenor_2")).toBe("tenor");
    expect(audioPartOf("x_audio_speak_the_name_soprano_100")).toBe("soprano");
  });

  it("recovers a voice followed by a key name", () => {
    expect(audioPartOf("x_audio_we_want_you_alto_eb")).toBe("alto");
  });

  it("does not mistake a word containing a voice for that voice", () => {
    // Underscore-bounded and at the end: `altogether` is not an alto.
    expect(audioPartOf("x_audio_altogether")).toBe("other");
    expect(audioPartOf("x_audio_tenorious_mix")).toBe("other");
  });

  it("tells loops from drum loops", () => {
    expect(audioPartOf("x_audio_loop")).toBe("loop");
    expect(audioPartOf("x_audio_loop_144_5bpm")).toBe("loop");
    expect(audioPartOf("x_audio_thank_you_the_cross_loop_48_bpm")).toBe("loop");
    expect(audioPartOf("x_audio_drum_loop_150bpm")).toBe("drum-loop");
  });

  it("keeps an unrecognised track rather than dropping real audio", () => {
    expect(audioPartOf("x_audio_my_help")).toBe("other");
  });

  it("reads instrument stems, and does not mistake a bass stem for a bass singer", () => {
    expect(audioPartOf("x_audio_stem_drums")).toBe("stem");
    expect(audioPartOf("x_audio_stem_lead_vocal")).toBe("stem");
    expect(audioPartOf("x_audio_stem_bass")).toBe("stem");
  });
});

describe("bpmFromKey", () => {
  it.each([
    ["x_audio_loop_144_5bpm", 144.5],
    ["x_audio_loop_48bpm", 48],
    ["x_audio_thank_you_the_cross_loop_48_bpm", 48],
    ["x_audio_my_help_loop_bpm77", 77],
    ["x_audio_come_like_the_dawn_loop76bpm", 76],
    ["x_audio_drum_loop_150bpm", 150],
  ])("reads %s as %s", (key, bpm) => {
    expect(bpmFromKey(key)).toBe(bpm);
  });

  it("returns null when there is no tempo", () => {
    expect(bpmFromKey("x_audio_loop")).toBeNull();
    expect(bpmFromKey("x_audio_soprano")).toBeNull();
  });

  it("rejects numbers outside a real tempo range", () => {
    expect(bpmFromKey("x_audio_loop_5bpm")).toBeNull();
    expect(bpmFromKey("x_audio_loop_999bpm")).toBeNull();
  });
});

describe("songMedia", () => {
  it("orders parts the way a choir reads them, not alphabetically", () => {
    // Alphabetical would give alto, full mix, loop, soprano, tenor.
    expect(
      labels({
        x_audio_tenor: URL,
        x_audio_loop_144_5bpm: URL,
        x_audio_alto: URL,
        x_audio_full_mix: URL,
        x_audio_soprano: URL,
      }),
    ).toEqual(["Soprano", "Alto", "Tenor", "Full mix", "Loop 144.5"]);
  });

  it("drops empty and non-URL values", () => {
    const media = songMedia({ x_audio_soprano: URL, x_audio_alto: "", x_audio_tenor: "not a url", x_chart_rhythm_chart: "" });
    expect(media.audio.map((t) => t.directive)).toEqual(["x_audio_soprano"]);
    expect(media.charts).toEqual([]);
  });

  it("ignores directives that are not media", () => {
    expect(songMedia({ title: "Hi", x_theme: "praise", x_album: "Album", x_audio_soprano: URL }).audio).toHaveLength(1);
  });

  it("numbers extra copies of a voice, and keeps the clean key as the first", () => {
    const media = songMedia({
      x_audio_speak_the_name_tenor: URL,
      x_audio_tenor: URL,
      x_audio_speak_the_name_tenor_2: URL,
    });
    expect(media.audio.map((t) => [t.directive, t.label, t.alternate])).toEqual([
      ["x_audio_tenor", "Tenor", false],
      ["x_audio_speak_the_name_tenor", "Tenor 2", true],
      ["x_audio_speak_the_name_tenor_2", "Tenor 3", true],
    ]);
  });

  it("tells loops apart by tempo, slowest first, rather than by a number", () => {
    const media = songMedia({ x_audio_loop_130bpm: URL, x_audio_loop_70bpm: URL, x_audio_loop: URL });
    expect(media.audio.map((t) => t.label)).toEqual(["Loop 70", "Loop 130", "Loop"]);
    expect(media.audio.every((t) => !t.alternate)).toBe(true);
  });

  it("keeps an unrecognised track under a plain label", () => {
    expect(labels({ x_audio_my_help: URL, x_audio_my_help_2: URL })).toEqual(["Recording", "Recording 2"]);
  });

  it("names each stem by its instrument, so five stems are not five identical buttons", () => {
    // Nothing But The Blood carries these five, and they used to read Extra 1-5.
    expect(
      labels({
        x_audio_full_mix: URL,
        x_audio_stem_drums: URL,
        x_audio_stem_guitars: URL,
        x_audio_stem_lead_vocal: URL,
      }),
    ).toEqual(["Full mix", "Drums", "Guitars", "Lead vocal"]);
  });

  it("returns nothing for a song with no media", () => {
    expect(songMedia({ title: "Plain" })).toEqual({ audio: [], charts: [], files: [], dropboxUrl: null });
    expect(songMedia(undefined)).toEqual({ audio: [], charts: [], files: [], dropboxUrl: null });
  });

  it("lists one chart per kind, chords first", () => {
    const media = songMedia({
      x_chart_vocals: URL,
      x_chart_number_chart: URL,
      x_chart_chord_chart: URL,
      x_chart_jesus_chord_chart_2: URL,
      x_chart_erv: URL,
    });
    expect(media.charts.map((c) => [c.label, c.directive])).toEqual([
      ["Chord chart", "x_chart_chord_chart"],
      ["Number chart", "x_chart_number_chart"],
      ["Vocals", "x_chart_vocals"],
      ["Easy-read vocals", "x_chart_erv"],
    ]);
  });

  it("lists every other file on its own, by name", () => {
    const media = songMedia({ x_file_rehearsal_video: URL, x_file_arrangement_notes: URL, x_file_arrangement_notes_2: URL, x_file_empty: "" });
    expect(media.files).toEqual([
      { directive: "x_file_arrangement_notes", label: "Arrangement notes" },
      { directive: "x_file_arrangement_notes_2", label: "Arrangement notes 2" },
      { directive: "x_file_rehearsal_video", label: "Rehearsal video" },
    ]);
  });

  it("surfaces the Dropbox folder when there is one", () => {
    expect(songMedia({ x_dropbox: "https://www.dropbox.com/scl/fo/abc" }).dropboxUrl).toBe("https://www.dropbox.com/scl/fo/abc");
  });
});

describe("chartPartOf", () => {
  it("classifies every chart kind the corpus holds", () => {
    expect(chartPartOf("x_chart_chord_chart")).toBe("chord-chart");
    expect(chartPartOf("x_chart_jesus_numbers_chart")).toBe("number-chart");
    expect(chartPartOf("x_chart_rhythm_chart")).toBe("rhythm-chart");
    expect(chartPartOf("x_chart_vocals_with_chords")).toBe("vocals-with-chords");
    expect(chartPartOf("x_chart_vocals")).toBe("vocals");
    expect(chartPartOf("x_chart_erv")).toBe("erv");
    expect(chartPartOf("x_chart_other")).toBe("other");
  });
});
