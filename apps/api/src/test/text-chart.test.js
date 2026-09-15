import { describe, expect, it } from "vitest";
import { transposeChordPro } from "@vpc-music/shared";
import { convertTextChartToChordPro, expandTabs, textLineElements } from "../corpus/textChart.js";

/** "Not The Same", as the publisher typed it: runs, counts, names with chords. */
const NOT_THE_SAME = [
  "Not The Same",
  "Jeff Walthall",
  "Key: C#",
  "",
  "Intro C#  C#/F   B   G#11(2x)",
  "       C# C#/F   B   G#11 (G#-F#-F) (G#-C#-F)  B",
  "",
  "Chorus",
  "             A#m7            AM7            (A -  B -  C# - F#) C#",
  "Since Jesus came I'm not the same no more  I'm not the same no more",
  "",
  "B11    E   A   F#  B            C#",
  "                          oh oh oh  oh oh",
  "",
  "Interlude  C# (B – A#)   (F# – E)  E   F   F#(3x)",
].join("\r\n");

describe("expandTabs", () => {
  it("moves each tab to the next eight-column stop", () => {
    expect(expandTabs("A\t\t\t A/C#")).toBe(`A${" ".repeat(23)} A/C#`);
    expect(expandTabs("Bm7\tA")).toBe("Bm7     A");
  });
});

describe("textLineElements", () => {
  it("puts every character at its column, skipping the spaces", () => {
    expect(textLineElements("  G  C").map((e) => [e.text, e.x])).toEqual([["G", 2], ["C", 5]]);
  });
});

describe("convertTextChartToChordPro", () => {
  const { chordProContent, metadata } = convertTextChartToChordPro("Not-The-Same.txt", NOT_THE_SAME);
  const lines = chordProContent.split("\n");

  it("reads the header into directives", () => {
    expect(metadata).toMatchObject({ title: "Not The Same", artist: "Jeff Walthall", key: "C#", isDraft: true });
  });

  it("splits a section name from the chords on its line, and lifts a count into a note", () => {
    expect(lines.slice(lines.indexOf("{comment: Intro}"), lines.indexOf("{comment: Intro}") + 3)).toEqual([
      "{comment: Intro}",
      "[C#] [C#/F] [B] [G#11]",
      "{ci: 2x}",
    ]);
    expect(lines).toContain("{comment: Interlude}");
    expect(lines).toContain("{ci: 3x}");
  });

  it("keeps passing-chord runs as chords, so they transpose with the rest", () => {
    expect(lines).toContain("[C#] [C#/F] [B] [G#11] [(G#-F#-F)] [(G#-C#-F)] [B]");
    const merged = lines.find((l) => l.startsWith("Since Jesus"));
    expect(merged).toContain("[(A-B-C#-F#)]");
    expect(transposeChordPro(merged, 1)).toContain("[(A#-C-D-G)]");
  });

  it("places a chord at the column it was typed at", () => {
    expect(lines.find((l) => l.startsWith("Since Jesus"))).toMatch(/^Since Jesus c\[A#m7\]ame I'm not the \[AM7\]same/);
  });

  it("keeps chords typed before the words start ahead of them", () => {
    expect(lines).toContain("[B11]    [E]   [A]   [F#]  [B]    oh oh [C#]oh  oh oh");
  });

  it("leaves no chord row as plain text", () => {
    for (const line of lines.filter((l) => l && !l.startsWith("{"))) {
      expect(line.replace(/\[[^\]]*\]/g, "").trim(), line).not.toMatch(/^(?:[A-G][#b]?\S*\s*)+$/);
    }
  });
});

describe("text chart keys", () => {
  const keyOf = (header) => convertTextChartToChordPro("x.txt", `${header}\n\nVerse\nG  C\nla la la\n`).metadata;

  it("reads a sharp key whole", () => {
    // Read as "C", every chord of "Not The Same" sat a semitone off its key.
    expect(keyOf("Not The Same\nJeff Walthall\nKey: C#").key).toBe("C#");
  });

  it("reads 'Key of E' and a key at the end of the artist's line", () => {
    expect(keyOf("Let's Dance\nKey of E ").key).toBe("E");
    expect(keyOf("Jesus\nPhase II                         Key: Cm")).toMatchObject({ key: "Cm", artist: "Phase II" });
  });

  it("does not take a key out of a name that only starts with one", () => {
    expect(keyOf("Key of David\nSomeone").key).toBeNull();
  });
});
