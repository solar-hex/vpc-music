import { describe, expect, it } from "vitest";
import {
  DIFFERENT_SONG_OVERLAP,
  SAME_SONG_OVERLAP,
  applyMerges,
  buildGroups,
  lyricOverlap,
  lyricShingles,
  lyricWords,
  mergeLedger,
  musicalHash,
  planMerges,
  rankForMerge,
} from "./corpus-dedupe.mjs";

const GRACE = [
  "Amazing grace how sweet the sound that saved a wretch like me",
  "I once was lost but now am found was blind but now I see",
  "Twas grace that taught my heart to fear and grace my fears relieved",
  "How precious did that grace appear the hour I first believed",
];
const GRACE_MORE = [
  "Through many dangers toils and snares I have already come",
  "Tis grace hath brought me safe thus far and grace will lead me home",
];

/** A chart: header lines, then lyric lines with a chord at the front of each. */
function chart(header, lines, chords = true) {
  const body = lines.map((line) => (chords ? `[G]${line.replace(" ", " [C]")}` : line)).join("\n");
  return `${header.join("\n")}\n\n{comment: Verse 1}\n${body}\n`;
}

/** A tiny corpus: manifests per source and the files they point at. */
function corpus(copies) {
  const files = new Map();
  const bySource = new Map();
  for (const c of copies) {
    const file = `songs/${c.source}/${c.id}.chopro`;
    files.set(file, c.content);
    if (!bySource.has(c.source)) bySource.set(c.source, []);
    bySource.get(c.source).push({
      songId: c.id,
      title: c.title ?? "Amazing Grace",
      file,
      metadata: { key: "G", isDraft: c.isDraft ?? false },
      decision: c.decision ?? "song",
      ...(c.supersededBy ? { supersededBy: c.supersededBy, supersedeReason: "identical copy" } : {}),
    });
  }
  const manifests = [...bySource].map(([sourceType, songs]) => ({ file: `${sourceType}.json`, data: { sourceType, songs } }));
  const { songs, groups } = buildGroups(manifests, (file) => files.get(file));
  return { manifests, songs, groups };
}

const churchChart = { id: "church", source: "chrd", content: chart(["{title: Amazing Grace}", "{key: G}"], GRACE) };
const publisherPdf = {
  id: "pdf",
  source: "pdf",
  content: chart(
    ["{title: Amazing Grace}", "{artist: Chris Tomlin}", "{key: Bb}", "{tempo: 72}", "{time: 3/4}", "{x_album: See the Morning}"],
    [...GRACE, ...GRACE_MORE],
  ),
};

describe("musicalHash", () => {
  it("ignores provenance, so the same chart from two paths matches", () => {
    const a = "{title: X}\n{key: G}\n{x_source: chrd:song.chrd}\n\n[G]la la";
    const b = "{title: X}\n{key: G}\n{x_source: chrd:~song.chrd}\n{x_dropbox: http://z}\n\n[G]la la";
    expect(musicalHash(a)).toBe(musicalHash(b));
  });

  it("still separates charts that differ musically", () => {
    expect(musicalHash("{key: G}\n[G]la")).not.toBe(musicalHash("{key: Ab}\n[Ab]la"));
  });
});

describe("lyric overlap", () => {
  it("reads only the sung words: no chords, directives or bar rows", () => {
    expect(lyricWords("{title: X}\n[G]Amazing [C]grace\n| G . . . |\n{ci: softly}")).toEqual(["amazing", "grace"]);
  });

  it("counts a lyrics sheet that prints less of the song as the same song", () => {
    const sheet = lyricShingles(chart([], GRACE, false));
    const full = lyricShingles(chart([], [...GRACE, ...GRACE_MORE, ...GRACE]));
    expect(lyricOverlap(sheet, full)).toBe(1);
  });

  it("tells two songs that share a title apart", () => {
    const cross = lyricShingles(chart([], ["Thank you for the cross you carried up the hill for me", "Thank you for the blood that washed me clean and set me free"]));
    const mercy = lyricShingles(chart([], ["Every morning new mercies I see rising with the sun", "I will give you praise forever more for all that you have done"]));
    expect(lyricOverlap(cross, mercy)).toBeLessThan(DIFFERENT_SONG_OVERLAP);
  });
});

describe("rankForMerge", () => {
  const { songs } = corpus([
    churchChart,
    publisherPdf,
    { id: "tilde", source: "chrd", content: chart(["{title: Amazing Grace}", "{x_flag: unlisted}"], [...GRACE, ...GRACE_MORE]) },
    { id: "sheet", source: "chrd", content: chart(["{title: Amazing Grace}"], GRACE, false) },
    { id: "draft", source: "chrd", isDraft: true, content: chart(["{title: Amazing Grace}"], [...GRACE, ...GRACE_MORE]) },
  ]);
  const ranked = rankForMerge(songs).map((s) => s.songId);

  it("puts the church's listed chart first, ahead of a fuller publisher chart", () => {
    expect(ranked[0]).toBe("church");
    expect(ranked.indexOf("church")).toBeLessThan(ranked.indexOf("pdf"));
  });

  it("puts the old site's final chart ahead of its ~ copy and a draft", () => {
    expect(ranked.indexOf("church")).toBeLessThan(ranked.indexOf("draft"));
    expect(ranked.indexOf("draft")).toBeLessThan(ranked.indexOf("tilde"));
  });

  it("puts a lyrics sheet last", () => {
    expect(ranked.at(-1)).toBe("sheet");
  });

  it("does not depend on the order it was given", () => {
    expect(rankForMerge([...songs].reverse()).map((s) => s.songId)).toEqual(ranked);
  });
});

describe("planMerges", () => {
  it("keeps the church's chart and takes the artist, tempo, time and album from the PDF, never the key", () => {
    const { songs, groups } = corpus([churchChart, publisherPdf]);
    const { merges, review } = planMerges(songs, groups);
    expect(review).toEqual([]);
    expect(merges).toHaveLength(1);
    expect(merges[0].winner.songId).toBe("church");
    expect(merges[0].losers.map((s) => s.songId)).toEqual(["pdf"]);
    expect(merges[0].overlaps[0]).toBeGreaterThanOrEqual(SAME_SONG_OVERLAP);
    expect(merges[0].carry).toEqual({ artist: "Chris Tomlin", tempo: "72", time: "3/4", x_album: "See the Morning" });
  });

  it("takes nothing the winner already has", () => {
    const own = { ...churchChart, content: churchChart.content.replace("{key: G}", "{key: G}\n{artist: John Newton}\n{time: 4/4}") };
    const { songs, groups } = corpus([own, publisherPdf]);
    expect(planMerges(songs, groups).merges[0].carry).toEqual({ tempo: "72", x_album: "See the Morning" });
  });

  it("asks a person when a copy only reaches the best one through a third", () => {
    // The bridge shares most of its words with both; the other two share less.
    const other = ["Praise God from whom all blessings flow praise him all creatures here below", "Praise him above ye heavenly host praise Father Son and Holy Ghost", "When we have been there ten thousand years bright shining as the sun", "We have no less days to sing his praise than when we first begun"];
    const bridge = { id: "bridge", source: "docx", content: chart(["{title: Amazing Grace}"], [GRACE[2], GRACE[3], other[0]]) };
    const far = { id: "far", source: "pdf", content: chart(["{title: Amazing Grace}"], [GRACE[2], GRACE[3], ...other]) };
    const { songs, groups } = corpus([churchChart, bridge, far]);
    const { merges, review } = planMerges(songs, groups);
    expect(merges).toEqual([]);
    expect(review.map((r) => r.why)).toEqual(["copies that only partly match the best one"]);
  });

  it("leaves a tempo worked out from a media filename behind", () => {
    const derived = { ...publisherPdf, content: publisherPdf.content.replace("{time: 3/4}", "{x_tempo_source: derived from media filename}") };
    const { songs, groups } = corpus([churchChart, derived]);
    expect(planMerges(songs, groups).merges[0].carry.tempo).toBeUndefined();
  });

  it("carries alternate titles the winner does not already answer to", () => {
    const pdf = { ...publisherPdf, content: publisherPdf.content.replace("{key: Bb}", "{key: Bb}\n{x_aka: My Chains Are Gone; amazing grace}") };
    const { songs, groups } = corpus([churchChart, pdf]);
    expect(planMerges(songs, groups).merges[0].carry.aka).toEqual(["My Chains Are Gone"]);
  });

  it("leaves two publisher charts by different artists for a person", () => {
    const other = { ...publisherPdf, id: "pdf2", content: publisherPdf.content.replace("Chris Tomlin", "Mark Yandris") };
    const { songs, groups } = corpus([publisherPdf, other]);
    const { merges, review } = planMerges(songs, groups);
    expect(merges).toEqual([]);
    expect(review).toHaveLength(1);
    expect(review[0].why).toMatch(/different artists/);
  });

  it("never merges two different songs that share a title", () => {
    const { songs, groups } = corpus([
      { id: "a", source: "pdf", title: "Thank You", content: chart(["{title: Thank You}"], ["Thank you for the cross you carried up the hill for me", "Thank you for the blood that washed me clean and set me free"]) },
      { id: "b", source: "pdf", title: "Thank You", content: chart(["{title: Thank You}"], ["Every morning new mercies I see rising with the sun", "I will give you praise forever more for all that you have done"]) },
    ]);
    expect(planMerges(songs, groups)).toEqual({ merges: [], review: [] });
  });

  it("asks a person about copies that share only some of their words", () => {
    const partial = { id: "docx", source: "docx", content: chart(["{title: Amazing Grace}"], [GRACE[0], GRACE[1], "When we have been there ten thousand years bright shining as the sun", "We have no less days to sing God's praise than when we first begun", "Praise God praise God praise God forever and ever amen"]) };
    const { songs, groups } = corpus([churchChart, partial]);
    const { merges, review } = planMerges(songs, groups);
    expect(merges).toEqual([]);
    expect(review).toHaveLength(1);
    expect(review[0].overlap).toBeGreaterThanOrEqual(DIFFERENT_SONG_OVERLAP);
    expect(review[0].overlap).toBeLessThan(SAME_SONG_OVERLAP);
  });

  it("never reopens a copy already superseded, but lets it give what it has", () => {
    const earlier = { ...publisherPdf, id: "old", source: "text", decision: "supersede", supersededBy: "pdf" };
    const pdf = { ...publisherPdf, content: publisherPdf.content.replace("{x_album: See the Morning}\n", "") };
    const { songs, groups } = corpus([churchChart, pdf, earlier]);
    const { merges } = planMerges(songs, groups);
    expect(merges).toHaveLength(1);
    expect(merges[0].losers.map((s) => s.songId)).toEqual(["pdf"]);
    expect(merges[0].earlier.map((s) => s.songId)).toEqual(["old"]);
    expect(merges[0].carry.x_album).toBe("See the Morning");
  });
});

describe("applyMerges", () => {
  it("marks each loser with the winner and the reason, and points earlier copies at the new winner", () => {
    const earlier = { ...publisherPdf, id: "old", source: "text", decision: "supersede", supersededBy: "pdf" };
    const bystander = { id: "gone", source: "docx", title: "Other Song", decision: "supersede", supersededBy: "elsewhere", content: chart(["{title: Other Song}"], GRACE_MORE) };
    const { manifests, songs, groups } = corpus([churchChart, publisherPdf, earlier, bystander]);
    const changed = applyMerges(manifests, planMerges(songs, groups).merges);

    const all = manifests.flatMap((m) => m.data.songs);
    const byId = new Map(all.map((s) => [s.songId, s]));
    expect(byId.get("pdf")).toMatchObject({ decision: "supersede", supersededBy: "church" });
    expect(byId.get("pdf").supersedeReason).toMatch(/same song as the chrd chart \(\d+% of the lyrics\)/);
    expect(byId.get("old")).toMatchObject({ decision: "supersede", supersededBy: "church", supersedeReason: "identical copy" });
    expect(byId.get("church").decision).toBe("song");
    // a decision nobody planned is never undone
    expect(byId.get("gone")).toMatchObject({ decision: "supersede", supersededBy: "elsewhere" });
    expect(changed.map((m) => m.data.sourceType).sort()).toEqual(["pdf", "text"]);
  });
});

describe("mergeLedger", () => {
  it("keeps earlier merges and folds a re-run into them, in a stable order", () => {
    const { songs, groups } = corpus([churchChart, publisherPdf]);
    const { merges } = planMerges(songs, groups);
    const previous = { songs: { zzz: { title: "Later", from: ["y"], carry: {} }, church: { title: "Amazing Grace", from: ["docx"], carry: { year: "1779" } } } };
    const ledger = mergeLedger(previous, merges);
    expect(Object.keys(ledger.songs)).toEqual(["church", "zzz"]);
    expect(ledger.songs.church.from).toEqual(["docx", "pdf"]);
    expect(ledger.songs.church.carry).toMatchObject({ year: "1779", artist: "Chris Tomlin" });
    expect(mergeLedger(ledger, merges)).toEqual(ledger);
  });
});
