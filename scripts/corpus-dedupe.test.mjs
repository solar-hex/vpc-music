import { describe, expect, it } from "vitest";
import { SOURCE_RANK, chordSequence, decideGroup, isSameArrangement, musicalHash, rankCopies } from "./corpus-dedupe.mjs";

const song = (over = {}) => ({
  songId: "id-" + (over.songId ?? Math.random().toString(36).slice(2)),
  title: "Song",
  source: "chrd",
  chords: 20,
  lines: 10,
  cues: 0,
  key: "G",
  musicalSha256: "hash-" + (over.musicalSha256 ?? "a"),
  chordSeq: [],
  nashville: null,
  ...over,
  songId: over.songId ?? "id-a",
});

describe("musicalHash", () => {
  it("ignores provenance, so the same chart from two paths matches", () => {
    // This is what `contentSha256` cannot do: the enriched file carries its
    // own source path and media links, which differ between copies.
    const a = "{title: X}\n{key: G}\n{x_source: chrd:song.chrd}\n\n[G]la la";
    const b = "{title: X}\n{key: G}\n{x_source: chrd:~song.chrd}\n{x_dropbox: http://z}\n\n[G]la la";
    expect(musicalHash(a)).toBe(musicalHash(b));
  });

  it("still separates charts that differ musically", () => {
    expect(musicalHash("{key: G}\n[G]la")).not.toBe(musicalHash("{key: Ab}\n[Ab]la"));
  });
});

describe("rankCopies", () => {
  it("puts the chart with more chords first", () => {
    const out = rankCopies([song({ songId: "a", chords: 5 }), song({ songId: "b", chords: 40 })]);
    expect(out[0].songId).toBe("b");
  });

  it("prefers a human-typed source when chords are equal", () => {
    // Columns typed by a person beat columns inferred from PDF geometry.
    expect(SOURCE_RANK.text).toBeGreaterThan(SOURCE_RANK.pdf);
    expect(SOURCE_RANK.chrd).toBeGreaterThan(SOURCE_RANK.docx);
    const out = rankCopies([song({ songId: "a", source: "pdf" }), song({ songId: "b", source: "chrd" })]);
    expect(out[0].source).toBe("chrd");
  });

  it("is deterministic when everything else ties", () => {
    const a = [song({ songId: "b" }), song({ songId: "a" })];
    expect(rankCopies(a)[0].songId).toBe(rankCopies([...a].reverse())[0].songId);
  });
});

describe("decideGroup", () => {
  it("decides identical copies on its own", () => {
    const r = decideGroup([
      song({ songId: "a", musicalSha256: "same" }),
      song({ songId: "b", musicalSha256: "same" }),
    ]);
    expect(r.auto).toBe(true);
    expect(r.losers).toHaveLength(1);
    expect(r.losers[0].reason).toBe("identical copy");
  });

  it("lets a chart with chords supersede the same song with none", () => {
    const r = decideGroup([
      song({ songId: "a", source: "chrd", chords: 30, musicalSha256: "x" }),
      song({ songId: "b", source: "docx", chords: 0, musicalSha256: "y" }),
    ]);
    expect(r.auto).toBe(true);
    expect(r.winner.songId).toBe("a");
    expect(r.losers[0].song.songId).toBe("b");
    expect(r.losers[0].reason).toMatch(/lyrics only/);
  });

  it("refuses to choose between two real charts", () => {
    // Different keys, both with chords — a musician's call, not a script's.
    const r = decideGroup([
      song({ songId: "a", chords: 40, key: "Gb", musicalSha256: "x" }),
      song({ songId: "b", chords: 40, key: "Ab", musicalSha256: "y" }),
    ]);
    expect(r.auto).toBe(false);
    expect(r.losers).toEqual([]);
    expect(r.why).toMatch(/two or more charts/);
  });

  it("never proposes deleting anything — only superseding", () => {
    const r = decideGroup([
      song({ songId: "a", chords: 30, musicalSha256: "x" }),
      song({ songId: "b", chords: 0, musicalSha256: "y" }),
    ]);
    // Every loser keeps its identity and points at the winner.
    for (const l of r.losers) {
      expect(l.song.songId).toBeTruthy();
      expect(r.winner.songId).not.toBe(l.song.songId);
    }
  });

  it("handles a group of one without deciding anything", () => {
    const r = decideGroup([song({ songId: "a" })]);
    expect(r.losers).toEqual([]);
    expect(r.winner.songId).toBe("a");
  });
});

describe("chordSequence", () => {
  it("reads the primary chords in order and ignores the secondary cues", () => {
    expect(chordSequence("[*Am][G]la [D/F#]la [*Bm]")).toEqual(["G", "D/F#"]);
  });
});

describe("isSameArrangement", () => {
  const seq = ["G", "C", "D", "Em", "G", "C", "D", "G", "Am"];
  const copy = (over) => song({ chordSeq: seq, ...over });

  it("sees through chord placement — the reason these were not caught as identical", () => {
    // "The[Ab] everlasting" against "The [Ab]everlasting": same chords, same
    // order, one character apart, so two rows survived as separate songs.
    expect(isSameArrangement(copy({ songId: "a" }), copy({ songId: "b" }))).toMatch(/same order/);
  });

  it("refuses a sequence too short to prove anything", () => {
    // Two different songs can share a title and a four-chord loop.
    const short = ["G", "C", "D", "G"];
    expect(isSameArrangement(song({ chordSeq: short }), song({ chordSeq: short }))).toBeNull();
  });

  it("says no when the chords actually differ", () => {
    expect(isSameArrangement(copy({}), song({ chordSeq: [...seq.slice(0, 8), "F"] }))).toBeNull();
  });

  it("recognises the same arrangement written in another key", () => {
    // Transposition is a URL parameter here, so a second row that is only a
    // transposition is redundant — but only once the numbers prove it.
    const numbers = ["1", "4", "5", "6m", "1", "4", "5", "1", "2m"];
    const a = song({ songId: "a", key: "G", chordSeq: seq, nashville: numbers });
    const b = song({ songId: "b", key: "Ab", chordSeq: ["Ab", "Db", "Eb", "Fm", "Ab", "Db", "Eb", "Ab", "Bbm"], nashville: numbers });
    expect(isSameArrangement(a, b)).toMatch(/same arrangement in Ab/);
  });

  it("does not merge two different arrangements that happen to be transposed apart", () => {
    // Same song, two keys, but the last chord genuinely differs — so the
    // numbers disagree and it stays a person's decision.
    const a = song({ key: "G", chordSeq: seq, nashville: ["1", "4", "5", "6m", "1", "4", "5", "1", "2m"] });
    const b = song({
      key: "Ab",
      chordSeq: ["Ab", "Db", "Eb", "Fm", "Ab", "Db", "Eb", "Ab", "Db"],
      nashville: ["1", "4", "5", "6m", "1", "4", "5", "1", "4"],
    });
    expect(isSameArrangement(a, b)).toBeNull();
  });
});

describe("partial decisions", () => {
  const seq = ["G", "C", "D", "Em", "G", "C", "D", "G", "Am"];

  it("supersedes a redundant copy even while the group still needs a person", () => {
    // "Glory, Honor, Power" carries two identical .chrd arrangements and a PDF
    // that read only 7 chords. The PDF is the question; the second .chrd is
    // not, and should not wait on an unrelated decision.
    const r = decideGroup([
      song({ songId: "a", chords: 38, cues: 53, chordSeq: seq, musicalSha256: "x" }),
      song({ songId: "b", chords: 38, cues: 0, chordSeq: seq, musicalSha256: "y" }),
      song({ songId: "c", source: "pdf", chords: 7, chordSeq: ["G", "C"], musicalSha256: "z" }),
    ]);
    expect(r.auto).toBe(false);
    expect(r.losers.map((l) => l.song.songId)).toEqual(["b"]);
    expect(r.open.map((c) => c.songId)).toEqual(["a", "c"]);
  });

  it("never lets a lyrics sheet wait on an unrelated question", () => {
    const r = decideGroup([
      song({ songId: "a", chords: 46, chordSeq: seq, musicalSha256: "x" }),
      song({ songId: "b", source: "pdf", chords: 26, chordSeq: ["G", "C"], musicalSha256: "y" }),
      song({ songId: "c", source: "docx", chords: 0, chordSeq: [], musicalSha256: "z" }),
    ]);
    expect(r.losers.map((l) => l.song.songId)).toEqual(["c"]);
    expect(r.losers[0].reason).toMatch(/lyrics only/);
    expect(r.open.map((c) => c.songId)).toEqual(["a", "b"]);
  });

  it("prefers the chart carrying secondary cues when the chords tie", () => {
    const out = rankCopies([song({ songId: "a", cues: 0 }), song({ songId: "b", cues: 90 })]);
    expect(out[0].songId).toBe("b");
  });
});
