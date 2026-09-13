import { describe, expect, it } from "vitest";
import { classifyPairing, containmentCount, formatLedger, isContainment, proposeAliases } from "./gap-resolve.mjs";

const library = [
  "I See A Crimson Stream",
  "Bless the Lord",
  "Bless The Lord Oh My Soul",
  "Hes Got The Whole World In His Hands",
  "Glory",
];

describe("isContainment", () => {
  it("sees a shorter title inside a longer one", () => {
    expect(isContainment("I See A Crimson Stream Of Blood", "I See A Crimson Stream")).toBe(true);
    expect(isContainment("Dont Do It Without Me", "If Theres Revival, Dont Do It Without Me")).toBe(true);
  });

  it("matches whole words, not fragments", () => {
    expect(isContainment("Holy Ghost Power Now", "Holy Ghost Powerful")).toBe(false);
  });

  it("refuses a title too short to be distinctive", () => {
    // "Glory" sits inside a hundred titles; two words prove nothing.
    expect(isContainment("Glory", "Glory To The Lamb Of God")).toBe(false);
  });
});

describe("containmentCount", () => {
  it("counts the different songs a short title could mean", () => {
    expect(containmentCount("I See A Crimson Stream", library)).toBe(1);
    // "Bless the Lord" is also inside "Bless The Lord Oh My Soul".
    expect(containmentCount("Bless the Lord", library)).toBe(2);
  });

  it("counts distinct titles, not rows — three copies of a song are one answer", () => {
    const dupes = ["Way Maker", "Way Maker", "Way Maker"];
    expect(containmentCount("Way Maker", dupes)).toBe(1);
  });
});

describe("classifyPairing", () => {
  it("approves containment when only one song answers to the shorter name", () => {
    expect(classifyPairing({ alias: "I See A Crimson Stream Of Blood", title: "I See A Crimson Stream", libraryTitles: library }))
      .toBe("approved");
  });

  it("refuses to decide when the shorter name fits more than one song", () => {
    // THE case this rule exists for. "I Will Bless The Lord" and "Bless the
    // Lord" score 88% and contain one another, but "Bless The Lord Oh My Soul"
    // is also in the library — so pairing them is a guess. A wrong alias hides
    // the real song AND stops the gap report asking for it.
    expect(classifyPairing({ alias: "I Will Bless The Lord", title: "Bless the Lord", libraryTitles: library }))
      .toBe("proposed");
  });

  it("leaves a merely-similar title for a human", () => {
    expect(classifyPairing({ alias: "This Is Amazing Grace", title: "Amazing Grace", libraryTitles: library }))
      .toBe("proposed");
  });
});

describe("proposeAliases", () => {
  const report = {
    probable: [
      { title: "I See A Crimson Stream Of Blood", candidate: "I See A Crimson Stream", candidateId: "s1", score: 0.91 },
      { title: "I Will Bless The Lord", candidate: "Bless the Lord", candidateId: "s2", score: 0.88 },
    ],
  };

  it("writes a decision for each probable match", () => {
    const { ledger, added } = proposeAliases({ report, existing: { version: 1, aliases: [] }, libraryTitles: library });
    expect(added).toHaveLength(2);
    expect(ledger.aliases.find((a) => a.songId === "s1").state).toBe("approved");
    expect(ledger.aliases.find((a) => a.songId === "s2").state).toBe("proposed");
  });

  it("never re-asks a question already answered", () => {
    // A human's "no" has to survive the next run, the same way a rejected
    // theme does, or the pass would quietly propose it again forever.
    const existing = {
      version: 1,
      aliases: [{ songId: "s2", title: "Bless the Lord", alias: "I Will Bless The Lord", state: "rejected" }],
    };
    const { ledger, added } = proposeAliases({ report, existing, libraryTitles: library });
    expect(added).toHaveLength(1);
    expect(ledger.aliases.filter((a) => a.songId === "s2")).toHaveLength(1);
    expect(ledger.aliases.find((a) => a.songId === "s2").state).toBe("rejected");
  });

  it("orders the ledger by title so a diff stays readable", () => {
    const { ledger } = proposeAliases({ report, existing: { version: 1, aliases: [] }, libraryTitles: library });
    expect(ledger.aliases.map((a) => a.title)).toEqual(["Bless the Lord", "I See A Crimson Stream"]);
  });
});

describe("formatLedger", () => {
  it("numbers the proposals so they can be approved by number", () => {
    const ledger = {
      aliases: [
        { songId: "s1", title: "A", alias: "AA", state: "approved", score: 1 },
        { songId: "s2", title: "B", alias: "BB", state: "proposed", score: 0.8 },
      ],
    };
    const text = formatLedger(ledger);
    expect(text).toContain("1 approved");
    expect(text).toContain("1 proposed");
    expect(text).toMatch(/1\. B/);
    expect(text).not.toMatch(/\d+\. A\b/);
  });
});
