import { describe, expect, it } from "vitest";
import type { Song } from "@/lib/api-client";
import {
  decorate,
  filterSongs,
  isFiltered,
  libraryFacets,
  libraryStats,
  sortRows,
  toggleValue,
  EMPTY_FILTER,
  NO_VALUE,
} from "@/lib/library";
import { completenessBand, songCompleteness, tempoBand, tempoBandLabel, parseTagField } from "@vpc-music/shared";

const song = (over: Partial<Song>): Song => ({ id: over.title || "x", title: "Untitled", content: "", ...over });

const library: Song[] = [
  song({ id: "s1", title: "Amazing Grace", artist: "John Newton", key: "G", tempo: 68, tags: "theme:grace-mercy, hymn", year: "1779" }),
  song({ id: "s2", title: "Way Maker", artist: "Sinach", key: "E", tempo: 72, tags: "theme:faith-trust" }),
  song({ id: "s3", title: "Holy Ghost", key: "Bb", tempo: 150, tags: "theme:holy-spirit, theme:revival" }),
  song({ id: "s4", title: "Nothing But The Blood", tags: "theme:blood" }),
  song({ id: "s5", title: "Untitled Sketch", isDraft: true }),
];

const rows = decorate(library);

describe("decorate", () => {
  it("derives the same completeness the corpus build reports", () => {
    const grace = rows.find((r) => r.song.id === "s1")!;
    expect(grace.percent).toBe(songCompleteness(library[0]).percent);
    expect(grace.percent).toBe(100);
    expect(grace.missing).toEqual([]);
    expect(grace.band).toBe(completenessBand(100));
  });

  it("reads themes out of the tags column and leaves plain tags alone", () => {
    const grace = rows.find((r) => r.song.id === "s1")!;
    expect(grace.themes).toEqual(["grace-mercy"]);
    expect(grace.tags).toEqual(["hymn"]);
  });

  it("gives every song a tempo, key and artist bucket, including 'none'", () => {
    const blood = rows.find((r) => r.song.id === "s4")!;
    expect(blood.tempo).toBe(NO_VALUE);
    expect(blood.key).toBe(NO_VALUE);
    expect(blood.artist).toBe(NO_VALUE);
    expect(rows.find((r) => r.song.id === "s3")!.tempo).toBe(tempoBand(150));
  });
});

describe("a theme rejection is not a tag", () => {
  it("does not count `!theme:x` towards completeness", () => {
    // The tombstone is real data, but the song still has no tags.
    const rejected = decorate([song({ id: "r", title: "R", tags: "!theme:blood" })])[0];
    expect(parseTagField("!theme:blood").negated).toEqual(["blood"]);
    expect(rejected.themes).toEqual([]);
    expect(rejected.missing).toContain("tags");
  });
});

describe("filterSongs", () => {
  it("returns everything when nothing is selected", () => {
    expect(filterSongs(rows, EMPTY_FILTER)).toHaveLength(5);
    expect(isFiltered(EMPTY_FILTER)).toBe(false);
  });

  it("ORs within a facet", () => {
    const out = filterSongs(rows, { ...EMPTY_FILTER, keys: ["G", "E"] });
    expect(out.map((r) => r.song.id).sort()).toEqual(["s1", "s2"]);
  });

  it("ANDs across facets", () => {
    // Both are in a key we asked for; only one of them is also missing a year.
    const out = filterSongs(rows, { ...EMPTY_FILTER, keys: ["G", "E"], missing: ["year"] });
    expect(out.map((r) => r.song.id)).toEqual(["s2"]);
  });

  it("filters on what a song is MISSING — the reason the page exists", () => {
    const out = filterSongs(rows, { ...EMPTY_FILTER, missing: ["artist"] });
    expect(out.map((r) => r.song.id).sort()).toEqual(["s3", "s4", "s5"]);
  });

  it("searches title, artist and tags together", () => {
    expect(filterSongs(rows, { ...EMPTY_FILTER, query: "sinach" }).map((r) => r.song.id)).toEqual(["s2"]);
    expect(filterSongs(rows, { ...EMPTY_FILTER, query: "blood" }).map((r) => r.song.id)).toEqual(["s4"]);
  });

  it("treats drafts as a three-way choice", () => {
    expect(filterSongs(rows, { ...EMPTY_FILTER, drafts: "hide" })).toHaveLength(4);
    expect(filterSongs(rows, { ...EMPTY_FILTER, drafts: "only" }).map((r) => r.song.id)).toEqual(["s5"]);
    expect(isFiltered({ ...EMPTY_FILTER, drafts: "hide" })).toBe(true);
  });
});

describe("libraryFacets", () => {
  it("counts each value", () => {
    const facets = libraryFacets(rows, EMPTY_FILTER);
    expect(facets.keys.find((o) => o.value === "G")?.count).toBe(1);
    expect(facets.keys.find((o) => o.value === NO_VALUE)?.count).toBe(2);
    expect(facets.missing.find((o) => o.value === "artist")?.count).toBe(3);
    expect(facets.themes.find((o) => o.value === "holy-spirit")?.label).toBe("Holy Spirit");
  });

  it("counts a facet with its OWN selection lifted, so you can still widen it", () => {
    // Having picked G, the other keys must not all read zero — otherwise the
    // only move left is to clear the filter.
    const facets = libraryFacets(rows, { ...EMPTY_FILTER, keys: ["G"] });
    expect(facets.keys.find((o) => o.value === "E")?.count).toBe(1);
    expect(facets.keys.find((o) => o.value === "G")?.selected).toBe(true);
    // Other facets DO narrow to the current selection.
    expect(facets.tempos.find((o) => o.value === "slow")?.count).toBe(1);
    expect(facets.tempos.find((o) => o.value === "shout")?.count ?? 0).toBe(0);
  });

  it("keeps a selected value visible even when nothing matches it any more", () => {
    const facets = libraryFacets(rows, { ...EMPTY_FILTER, keys: ["G"], tempos: ["shout"] });
    const g = facets.keys.find((o) => o.value === "G");
    expect(g?.selected).toBe(true);
    expect(g?.count).toBe(0);
  });

  it("keeps the tempo scale in tempo order, not in count order", () => {
    // slow(2) then shout(1) then none(2): a chip list that reshuffled by count
    // would put "no tempo" in the middle of the scale.
    const facets = libraryFacets(rows, EMPTY_FILTER);
    expect(facets.tempos.map((o) => o.value)).toEqual(["slow", "shout", NO_VALUE]);
  });

  it("offers only bands that actually have songs — a zero chip is a dead control", () => {
    const facets = libraryFacets(rows, EMPTY_FILTER);
    expect(facets.tempos.map((o) => o.value)).not.toContain("medium");
  });
});

describe("libraryStats", () => {
  it("rolls up the library the way the corpus report does", () => {
    const stats = libraryStats(rows);
    expect(stats.songs).toBe(5);
    expect(stats.drafts).toBe(1);
    expect(stats.themed).toBe(4);
    expect(stats.labels).toBe(5); // s3 carries two
    expect(stats.ready).toBe(2); // title AND artist
    expect(stats.coverage.find((c) => c.id === "artist")).toMatchObject({ have: 2, missing: 3 });
    expect(stats.coverage.find((c) => c.id === "year")).toMatchObject({ have: 1, missing: 4 });
  });

  it("reports a median, not a mean — one perfect song must not flatter the rest", () => {
    const percents = rows.map((r) => r.percent).sort((a, b) => a - b);
    expect(libraryStats(rows).medianPercent).toBe(percents[2]);
  });
});

describe("sortRows", () => {
  it("puts the least complete first by default", () => {
    const sorted = sortRows(rows, "needsWork");
    expect(sorted[0].percent).toBeLessThanOrEqual(sorted[sorted.length - 1].percent);
    expect(sorted[0].song.id).toBe("s5");
  });

  it("sorts A to Z ignoring case and accents", () => {
    expect(sortRows(rows, "title").map((r) => r.song.title)[0]).toBe("Amazing Grace");
  });
});

describe("toggleValue", () => {
  it("adds then removes", () => {
    expect(toggleValue([], "a")).toEqual(["a"]);
    expect(toggleValue(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("tempoBandLabel", () => {
  it("always shows the number beside the band, because BPM is ambiguous by a factor of two", () => {
    expect(tempoBandLabel(150)).toBe("Shout · 150 BPM");
    expect(tempoBandLabel(null)).toBeNull();
  });
});
