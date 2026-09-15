/**
 * Whether two charts are the same song, by their words. One definition, read
 * by the corpus merge planner and the app's duplicate review alike.
 */
import { describe, expect, it } from "vitest";
import { distinctIds, findDuplicatePairs, lyricOverlap, lyricShingles, titleAgreement, titleWords } from "@vpc-music/shared";

const GRACE = [
  "Amazing grace how sweet the sound that saved a wretch like me",
  "I once was lost but now am found was blind but now I see",
  "Twas grace that taught my heart to fear and grace my fears relieved",
];
const chart = (title, lines, extra = "") => `{title: ${title}}\n${extra}\n${lines.map((l) => `[G]${l}`).join("\n")}\n`;
const pairOf = (songs) => findDuplicatePairs(songs).map((p) => [p.a, p.b].sort().join("+"));

describe("lyricOverlap", () => {
  it("ignores chords, so a lyric sheet matches the chart it came from", () => {
    const sheet = lyricShingles(GRACE.join("\n"));
    const withChords = lyricShingles(chart("Amazing Grace", GRACE));
    expect(lyricOverlap(sheet, withChords)).toBe(1);
  });
});

describe("titleWords / titleAgreement", () => {
  it("drops filler words and punctuation, keeping what tells songs apart", () => {
    expect(titleWords("Satan, Your Kingdom’s (Live) Coming Down")).toEqual(["satan", "kingdoms", "coming", "down"]);
  });

  it("scores a first-line title against the song's own name", () => {
    expect(titleAgreement("Breath On Me", "Breath on me")).toBe(1);
    expect(titleAgreement("Old Time Religion", "Give Me That Old Time Religion")).toBe(1);
    expect(titleAgreement("I Call You Faithful", "I call You holy")).toBe(0.5);
  });
});

describe("findDuplicatePairs", () => {
  it("pairs copies of one song whatever their titles", () => {
    const songs = [
      { id: "a", title: "Amazing Grace", content: chart("Amazing Grace", GRACE) },
      { id: "b", title: "How sweet the sound", content: GRACE.join("\n") },
    ];
    expect(findDuplicatePairs(songs)).toEqual([{ a: "a", b: "b", overlap: 1, shared: expect.any(Number), titlesAgree: false }]);
  });

  it("wants more than a couple of shared lines from a song with a different title", () => {
    // A short sheet whose few words all appear in a long song is not a copy of it.
    const songs = [
      { id: "long", title: "Amazing Grace", content: chart("Amazing Grace", GRACE) },
      { id: "short", title: "Sweet Sound", content: "how sweet the sound that saved" },
    ];
    expect(pairOf(songs)).toEqual([]);
  });

  it("looks at less overlap when the titles agree", () => {
    const partial = [GRACE[0], "When we have been there ten thousand years bright shining as the sun", "We have no less days to sing his praise than when we first begun", "Praise God praise God forever and ever amen"];
    const songs = [
      { id: "a", title: "Amazing Grace", content: chart("Amazing Grace", GRACE) },
      { id: "b", title: "Amazing grace (hymn)", content: partial.join("\n") },
      { id: "c", title: "Ten Thousand Years", content: partial.join("\n").replace("Amazing", "Glorious") },
    ];
    expect(pairOf(songs)).toContain("a+b");
    expect(pairOf(songs)).not.toContain("a+c");
  });

  it("leaves out a merged copy and a pair marked as different songs", () => {
    const songs = [
      { id: "a", title: "Amazing Grace", content: chart("Amazing Grace", GRACE, "{x_distinct: b}") },
      { id: "b", title: "Amazing Grace", content: chart("Amazing Grace", GRACE) },
      { id: "c", title: "Amazing Grace", content: chart("Amazing Grace", GRACE, "{x_merged_into: a}") },
    ];
    expect(pairOf(songs)).toEqual([]);
    expect(distinctIds("{x_distinct: b; d}")).toEqual(["b", "d"]);
  });

  it("lists the most alike first, in a stable order", () => {
    const half = [GRACE[0], GRACE[1], "Something else entirely that nobody sings on any sunday morning at all"];
    const songs = [
      { id: "z", title: "Grace", content: chart("Grace", half) },
      { id: "a", title: "Amazing Grace", content: chart("Amazing Grace", GRACE) },
      { id: "m", title: "Amazing Grace", content: chart("Amazing Grace", GRACE) },
    ];
    const pairs = findDuplicatePairs(songs);
    expect(pairs[0]).toMatchObject({ a: "a", b: "m", overlap: 1 });
    expect(findDuplicatePairs([...songs].reverse())).toEqual(pairs);
  });
});
