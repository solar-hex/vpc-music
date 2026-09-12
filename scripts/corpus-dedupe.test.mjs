import { describe, expect, it } from "vitest";
import { SOURCE_RANK, decideGroup, musicalHash, rankCopies } from "./corpus-dedupe.mjs";

const song = (over = {}) => ({
  songId: "id-" + (over.songId ?? Math.random().toString(36).slice(2)),
  title: "Song",
  source: "chrd",
  chords: 20,
  lines: 10,
  cues: 0,
  key: "G",
  musicalSha256: "hash-" + (over.musicalSha256 ?? "a"),
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
