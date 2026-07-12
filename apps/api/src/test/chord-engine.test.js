import { describe, it, expect } from "vitest";
import {
  transposeChord,
  transposeChordPro,
  isChordToken,
  isSectionToken,
  interval,
  keyPrefersFlats,
  transposeKeyName,
  parseChordPro,
} from "@vpc-music/shared";

describe("chord engine — section tokens are never chords", () => {
  it("recognizes the section vocabulary", () => {
    for (const token of ["Chorus", "Verse 1", "Bridge", "Ending", "Intro", "Outro", "Tag", "Pre-Chorus", "Instrumental", "verse 2b"]) {
      expect(isSectionToken(token), token).toBe(true);
      expect(isChordToken(token), token).toBe(false);
    }
  });

  it("does not turn [Chorus] into [Eb]horus on +3", () => {
    expect(transposeChordPro("[Chorus]\n[C]Sing", 3, true)).toBe("[Chorus]\n[Eb]Sing");
  });

  it("leaves [Bridge] and [Ending] untouched", () => {
    const input = "[Bridge]\n[Am]Low\n[Ending]\n[G]Done";
    const moved = transposeChordPro(input, 2);
    expect(moved).toContain("[Bridge]");
    expect(moved).toContain("[Ending]");
    expect(moved).toContain("[Bm]");
    expect(moved).toContain("[A]");
  });

  it("rejects arbitrary words as chords but accepts real ones", () => {
    expect(isChordToken("horus")).toBe(false);
    expect(isChordToken("ridge")).toBe(false);
    expect(isChordToken("nding")).toBe(false);
    for (const chord of ["G", "Bm", "F#m7", "C/E", "C#m7b5", "A7(#9)", "Fsus4", "Gadd9", "Dmaj7", "Bb", "E7#9", "C6/9"]) {
      expect(isChordToken(chord), chord).toBe(true);
    }
  });
});

describe("chord engine — enharmonic spelling follows the target key", () => {
  it("G +3 into Bb gives Bb (not A#) and Eb (not D#)", () => {
    expect(transposeChord("G", 3, true)).toBe("Bb");
    expect(transposeChord("C", 3, true)).toBe("Eb");
    expect(transposeChord("D", 3, true)).toBe("F");
  });

  it("spells with sharps when the target key is a sharp key", () => {
    expect(transposeChord("G", 2, false)).toBe("A");
    expect(transposeChord("C", 2, false)).toBe("D");
    expect(transposeChord("F", 2, false)).toBe("G");
    expect(transposeChord("Bb", 2, false)).toBe("C");
    expect(transposeChord("A", 1, false)).toBe("A#");
  });

  it("keyPrefersFlats knows the flat-key set including relative minors", () => {
    for (const key of ["F", "Bb", "Eb", "Ab", "Db", "Gb", "Dm", "Gm", "Cm", "Bbm"]) {
      expect(keyPrefersFlats(key), key).toBe(true);
    }
    for (const key of ["C", "G", "D", "A", "E", "B", "F#", "Em", "Am", "Bm"]) {
      expect(keyPrefersFlats(key), key).toBe(false);
    }
  });

  it("interval computes semitone distance between keys", () => {
    expect(interval("G", "Bb")).toBe(3);
    expect(interval("C", "C")).toBe(0);
    expect(interval("A", "G")).toBe(10);
    expect(interval("Bb", "B")).toBe(1);
  });

  it("transposes key names with target spelling", () => {
    expect(transposeKeyName("G", 3, true)).toBe("Bb");
    expect(transposeKeyName("Em", 3, true)).toBe("Gm");
  });
});

describe("chord engine — slash chords and extensions", () => {
  it("transposes both halves of a slash chord", () => {
    expect(transposeChord("G/B", 2, false)).toBe("A/C#");
    expect(transposeChord("C/E", 3, true)).toBe("Eb/G");
  });

  it("preserves extensions untouched", () => {
    expect(transposeChord("C#m7b5", 1, false)).toBe("Dm7b5");
    expect(transposeChord("A7(#9)", 3, true)).toBe("C7(#9)");
    expect(transposeChord("Fsus4", 2, false)).toBe("Gsus4");
  });
});

describe("chord engine — bar lines and round-trips", () => {
  it("transposes bar lines cell by cell", () => {
    expect(transposeChordPro("| G | C/E | D | G |", 3, true)).toBe("| Bb | Eb/G | F | Bb |");
  });

  it("leaves non-chord bar cells alone", () => {
    expect(transposeChordPro("| G | x2 | D |", 2, false)).toBe("| A | x2 | E |");
  });

  it("net-zero transposition returns the source byte-for-byte", () => {
    const source = "{title: Amazing Grace}\n{key: G}\n\n[Verse 1]\nA[G]mazing [C]grace\n| G | C/E | D |\n# a comment";
    expect(transposeChordPro(source, 0, true)).toBe(source);
    expect(transposeChordPro(source, 12, false)).toBe(source);
  });

  it("round-trips G → Bb → G through the source (view-concern model)", () => {
    const source = "[G]Amazing [C]grace [D7]how [G/B]sweet";
    const up = transposeChordPro(source, interval("G", "Bb"), keyPrefersFlats("Bb"));
    expect(up).toBe("[Bb]Amazing [Eb]grace [F7]how [Bb/D]sweet");
    // The app always re-renders from the stored source, so returning to G
    // is a zero-step render of the original — identical by construction.
    expect(transposeChordPro(source, interval("G", "G"), keyPrefersFlats("G"))).toBe(source);
  });
});

describe("chord engine — parser handles the spec format", () => {
  it("treats standalone [Verse 1] lines as section headers", () => {
    const doc = parseChordPro("[Verse 1]\nA[G]mazing grace\n\n[Chorus]\n[C]How sweet");
    expect(doc.sections.map((section) => section.name)).toEqual(["Verse 1", "Chorus"]);
    expect(doc.sections[0].lines[0].chords[0].chord).toBe("G");
  });

  it("strips # comment lines", () => {
    const doc = parseChordPro("# private note\n[G]Line one");
    expect(doc.sections[0].lines).toHaveLength(1);
    expect(doc.sections[0].lines[0].lyrics).toBe("Line one");
  });

  it("keeps {comment:} sections working alongside bracket headers", () => {
    const doc = parseChordPro("{comment: Verse 1}\n[G]First\n\n[Bridge]\n[Am]Second");
    expect(doc.sections.map((section) => section.name)).toEqual(["Verse 1", "Bridge"]);
  });
});
