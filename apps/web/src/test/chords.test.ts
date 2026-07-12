import { describe, it, expect } from "vitest";
import { chords } from "@vpc-music/shared";

const { parseChart, transposeChart, interval, preferFlats, toText, parseChord, transposeChord } = chords;

// Transpose a chord token through parseChord → transposeChord.
const t = (tok: string, semis: number, flats: boolean) =>
  transposeChord(parseChord(tok)!, semis, flats);

describe("chords — chord level", () => {
  it("G up 2 → A", () => expect(t("G", 2, false)).toBe("A"));
  it("B up 1 → C (wrap)", () => expect(t("B", 1, false)).toBe("C"));
  it("C down 1 → B (wrap)", () => expect(t("C", 11, false)).toBe("B"));
  it("Am7 up 3 → Cm7", () => expect(t("Am7", 3, false)).toBe("Cm7"));
  it("C#m7b5 up 1 → Dm7b5", () => expect(t("C#m7b5", 1, false)).toBe("Dm7b5"));
  it("slash: G/B up 2 → A/C#", () => expect(t("G/B", 2, false)).toBe("A/C#"));
  it("flat spelling: G up 3 → Bb", () => expect(t("G", 3, true)).toBe("Bb"));
  it("sharp spelling: G up 3 → A#", () => expect(t("G", 3, false)).toBe("A#"));
  it("Fsus4 up 5 → Bbsus4 (flats)", () => expect(t("Fsus4", 5, true)).toBe("Bbsus4"));
  it("Bb/D down 2 → Ab/C", () => expect(t("Bb/D", 10, true)).toBe("Ab/C"));
  it("A7(#9) up 2 → B7(#9)", () => expect(t("A7(#9)", 2, false)).toBe("B7(#9)"));
  it("Cmaj7 up 7 → Gmaj7", () => expect(t("Cmaj7", 7, false)).toBe("Gmaj7"));

  it("parseChord returns null for a section label", () => {
    expect(parseChord("Chorus")).toBeNull();
  });
});

describe("chords — key math", () => {
  it("interval G→A", () => expect(interval("G", "A")).toBe(2));
  it("interval A→G (wraps up)", () => expect(interval("A", "G")).toBe(10));
  it("interval Em→Gm (minor keys)", () => expect(interval("Em", "Gm")).toBe(3));
  it("preferFlats(Bb)", () => expect(preferFlats("Bb")).toBe(true));
  it("preferFlats(D)", () => expect(preferFlats("D")).toBe(false));
});

describe("chords — chart level", () => {
  const chart = `{title: Amazing Grace}
{key: G}

[Verse 1]
A[G]mazing grace, how [C]sweet the [G]sound
That [G]saved a wretch like [D]me

[Chorus]
| G | C/E | D | G |

# a comment that should vanish
[Bridge]
[Am7]I once was [D7]lost but [G]now am found`;

  it("parses directives", () => {
    const parsed = parseChart(chart);
    expect(parsed.directives.title).toBe("Amazing Grace");
    expect(parsed.directives.key).toBe("G");
  });

  it("G→Bb is 3 semitones and Bb prefers flats", () => {
    expect(interval("G", "Bb")).toBe(3);
    expect(preferFlats("Bb")).toBe(true);
  });

  it("transposes chords, bars, and the key directive; strips comments", () => {
    const semis = interval("G", "Bb");
    const flats = preferFlats("Bb");
    const out = toText(transposeChart(parseChart(chart), semis, flats));

    expect(out).toContain("A[Bb]mazing grace, how [Eb]sweet the [Bb]sound");
    expect(out).toContain("| Bb | Eb/G | F | Bb |");
    expect(out).toContain("[Cm7]I once was [F7]lost but [Bb]now am found");
    expect(out).toContain("[Chorus]"); // section header preserved
    expect(out).toContain("{key: Bb}"); // key directive tracks the chords
    expect(out).not.toContain("#"); // comment stripped
  });

  it("round-trips G→Bb→G losslessly", () => {
    const out = toText(transposeChart(parseChart(chart), interval("G", "Bb"), preferFlats("Bb")));
    const back = toText(transposeChart(parseChart(out), interval("Bb", "G"), preferFlats("G")));
    expect(back).toContain("A[G]mazing grace, how [C]sweet the [G]sound");
    expect(back).toContain("{key: G}");
  });
});
