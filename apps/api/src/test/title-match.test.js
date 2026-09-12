import { describe, expect, it } from "vitest";
import {
  matchTitles,
  normalizeTitle,
  titleKey,
  titleSimilarity,
  titleVariants,
} from "../corpus/titleMatch.js";

describe("normalizeTitle", () => {
  it("folds punctuation, case, accents and ampersands", () => {
    expect(normalizeTitle("God's Not Dead")).toBe("gods not dead");
    expect(normalizeTitle("Blessing & Honor")).toBe("blessing and honor");
    expect(normalizeTitle("Café Señor")).toBe("cafe senor");
    expect(normalizeTitle("It’s All In Him")).toBe("its all in him");
  });

  it("spells out numbers so digit and word forms meet", () => {
    expect(normalizeTitle("10,000 Reasons")).toBe(normalizeTitle("Ten Thousand Reasons"));
    expect(normalizeTitle("Psalm 100")).toBe("psalm hundred");
  });
});

describe("titleKey", () => {
  it("drops a leading article, parentheticals and filename noise", () => {
    expect(titleKey("The Blood Will Never Lose Its Power")).toBe(
      titleKey("Blood Will Never Lose Its Power"),
    );
    expect(titleKey("I'll Fly Away (Hank Williams CRD)")).toBe(titleKey("Ill Fly Away"));
    expect(titleKey("Shout To The Lord - chords")).toBe(titleKey("Shout to the Lord"));
    expect(titleKey("Way Maker chart")).toBe("way maker");
  });

  it("drops a trailing hymnal number", () => {
    expect(titleKey("Just a little talk with Jesus 174")).toBe("just a little talk with jesus");
  });
});

describe("titleVariants", () => {
  it("splits medleys so either half can match", () => {
    const v = titleVariants("Victory Chant / He Is Exalted");
    expect(v).toContain(titleKey("He Is Exalted"));
    expect(v).toContain(titleKey("Victory Chant"));
  });

  it("returns just the whole key for an ordinary title", () => {
    expect(titleVariants("Amazing Grace")).toEqual(["amazing grace"]);
  });
});

describe("titleSimilarity", () => {
  it("scores an exact key match as 1", () => {
    expect(titleSimilarity("Amazing Grace", "amazing  grace!")).toBe(1);
  });

  it("scores real-world near-misses high", () => {
    expect(titleSimilarity("Every Praise", "Every Praise Is To Our God")).toBeGreaterThan(0.72);
    expect(titleSimilarity("All in Him", "Its All In Him")).toBeGreaterThan(0.72);
    expect(titleSimilarity("Glorious Day", "Glorious Day - Living He Loved Me")).toBeGreaterThan(0.72);
  });

  it("refuses to let a short title swallow a longer one", () => {
    // The failure mode of naive substring matching.
    expect(titleSimilarity("Holy", "I Want to Be Holy")).toBe(0);
    expect(titleSimilarity("Holy", "Bless His Holy Name")).toBe(0);
    expect(titleSimilarity("Praise", "Praise Him In The Morning")).toBe(0);
  });

  it("scores unrelated titles low", () => {
    expect(titleSimilarity("Amazing Grace", "Way Maker")).toBeLessThan(0.3);
  });

  it("is symmetric and safe on empty input", () => {
    expect(titleSimilarity("A B C D", "A B C")).toBe(titleSimilarity("A B C", "A B C D"));
    expect(titleSimilarity("", "Amazing Grace")).toBe(0);
    expect(titleSimilarity(null, undefined)).toBe(0);
  });
});

describe("matchTitles", () => {
  const have = [
    { id: "1", title: "Its All In Him" },
    { id: "2", title: "Every Praise Is To Our God" },
    { id: "3", title: "Amazing Grace", aka: "Amazing Grace (My Chains Are Gone)" },
    { id: "4", title: "He Is Exalted" },
    { id: "5", title: "Holy" },
  ];

  it("finds exact matches through normalisation", () => {
    const r = matchTitles(["amazing grace"], have);
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0].song.id).toBe("3");
    expect(r.matched[0].score).toBe(1);
  });

  it("puts near-misses in `probable` for a human to confirm", () => {
    const r = matchTitles(["All in Him", "Every Praise"], have);
    const ids = [...r.matched, ...r.probable].map((m) => m.song.id).sort();
    expect(ids).toEqual(["1", "2"]);
    expect(r.missing).toHaveLength(0);
  });

  it("matches through `aka`, which is how a human fixes a miss permanently", () => {
    const r = matchTitles(["My Chains Are Gone"], have);
    expect([...r.matched, ...r.probable].map((m) => m.song.id)).toContain("3");
  });

  it("matches either half of a medley", () => {
    const r = matchTitles(["Victory Chant / He Is Exalted"], have);
    expect(r.matched[0].song.id).toBe("4");
  });

  it("reports a genuinely absent song as missing", () => {
    const r = matchTitles(["Lion of Judah"], have);
    expect(r.missing).toHaveLength(1);
    expect(r.matched).toHaveLength(0);
    expect(r.probable).toHaveLength(0);
  });

  it("does not match a long title to the one-word song 'Holy'", () => {
    const r = matchTitles(["I Want to Be Holy"], have);
    expect(r.matched).toHaveLength(0);
    expect(r.probable).toHaveLength(0);
  });

  it("is deterministic", () => {
    const a = matchTitles(["All in Him", "Lion of Judah"], have);
    const b = matchTitles(["All in Him", "Lion of Judah"], have);
    expect(a.matched.map((m) => m.song.id)).toEqual(b.matched.map((m) => m.song.id));
    expect(a.missing.map((m) => m.title)).toEqual(b.missing.map((m) => m.title));
  });
});
