import { describe, expect, it } from "vitest";
import { chordSequence, sequenceAgreement } from "./corpus-verify.mjs";
import { compareSequences, isNashvilleToken } from "../apps/api/src/corpus/nashvilleCheck.js";
import { loadVerified, verifiedNote } from "../apps/api/src/corpus/verified.js";

describe("the number-chart oracle", () => {
  it("reads the notation these charts actually use", () => {
    expect(isNashvilleToken("1")).toBe(true);
    expect(isNashvilleToken("6m")).toBe(true);
    expect(isNashvilleToken("b7")).toBe(true);
    expect(isNashvilleToken("5/7")).toBe(true);
    expect(isNashvilleToken("2m7")).toBe(true);
    expect(isNashvilleToken("G")).toBe(false);
    expect(isNashvilleToken("2026")).toBe(false);
  });

  it("reports BOTH counts, because a high score over a tiny sample is not agreement", () => {
    // The metric that hid a real bug: scoring against the SHORTER sequence
    // reported 100% for 4 chords read out of 145.
    const ours = ["1", "4", "5", "1"];
    const theirs = ["1", "4", "5", "1", "6m", "4", "5", "1", "2m", "5"];
    const r = compareSequences(ours, theirs);
    expect(r.score).toBe(1);      // all of OURS appears in theirs
    expect(r.coverage).toBe(0.4); // but we only found 40% of what they wrote
    expect(r.ours).toBe(4);
    expect(r.theirs).toBe(10);
  });

  it("scores nothing when either side is empty", () => {
    expect(compareSequences([], ["1", "4"]).coverage).toBe(0);
    expect(compareSequences(["1"], []).coverage).toBe(0);
  });
});

describe("chordSequence", () => {
  it("is layout-independent — only the chords, in order", () => {
    expect(chordSequence(["[G]la [C]la", "[D]la"].join("\n"))).toEqual(["G", "C", "D"]);
    expect(chordSequence("no chords here")).toEqual([]);
  });
});

describe("sequenceAgreement", () => {
  it("measures the longest run the two charts share", () => {
    const r = sequenceAgreement(["G", "C", "D"], ["G", "C", "D"]);
    expect(r.score).toBe(1);
    expect(r.common).toBe(3);
  });
});

describe("the verified ledger", () => {
  it("says how a chart earned its way out of draft", () => {
    expect(verifiedNote({ coverage: 0.92, theirs: 105 })).toBe("number chart, 92% of 105 chords");
    expect(verifiedNote(null)).toBeNull();
  });

  it("holds only charts an independent source agreed with", () => {
    // The committed ledger. Every entry is a PDF whose chords match the
    // publisher's own Nashville chart — which is the publisher checking us,
    // not us marking our own homework.
    const verified = loadVerified();
    expect(verified.size).toBeGreaterThan(150);
    for (const [, entry] of verified) {
      expect(entry.coverage).toBeGreaterThanOrEqual(0.8);
      expect(entry.theirs).toBeGreaterThan(0);
    }
  });
});
