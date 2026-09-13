import { describe, expect, it } from "vitest";
import {
  detectThemes,
  formatTagField,
  loadThemes,
  lyricsOf,
  mergeThemes,
  parseTagField,
  rejectTheme,
  resetThemes,
} from "../corpus/themes.js";

const BLOOD_SONG = [
  "{title: Are You Washed In The Blood}",
  "{key: G}",
  "",
  "{comment: Chorus}",
  "{ci: sing twice}",
  "Are you [G]washed in the [C]blood of the Lamb",
  "There is a [D]fountain filled with blood",
].join("\n");

describe("lyricsOf", () => {
  it("returns only lyrics — not the title, key, section names, notes or chords", () => {
    const text = lyricsOf(BLOOD_SONG);
    expect(text).toContain("washed in the blood");
    expect(text).not.toContain("chorus");
    expect(text).not.toContain("key");
    expect(text).not.toContain("sing twice");
    expect(text).not.toMatch(/\bg\b|\bc\b|\bd\b/); // chord tokens are gone
  });

  it("is safe on empty input", () => {
    expect(lyricsOf("")).toBe("");
    expect(lyricsOf(null)).toBe("");
  });
});

describe("detectThemes", () => {
  it("finds the theme a song is actually about", () => {
    const ids = detectThemes(BLOOD_SONG).map((t) => t.id);
    expect(ids).toContain("blood");
  });

  it("reports which words matched, so a human can check the call", () => {
    const blood = detectThemes(BLOOD_SONG).find((t) => t.id === "blood");
    expect(blood.hits).toContain("blood");
    expect(blood.strong).toBe(true);
  });

  it("matches plurals, so 'new mercies' meets 'mercy'", () => {
    const ids = detectThemes("{comment: V}\nMorning by morning new mercies I see").map((t) => t.id);
    expect(ids).toContain("grace-mercy");
  });

  it("requires whole words — 'bloodline' is not 'blood'", () => {
    const ids = detectThemes("{comment: V}\nMy bloodline runs deep in the bloodstream").map((t) => t.id);
    expect(ids).not.toContain("blood");
  });

  it("needs corroboration before asserting from weak terms alone", () => {
    // A single incidental weak word must not assert a theme.
    const ids = detectThemes("{comment: V}\nI carry a heavy burden today").map((t) => t.id);
    expect(ids).not.toContain("cross");
  });

  it("honours exclude phrases", () => {
    const ids = detectThemes("{comment: V}\nThe blood moon rises over the hill").map((t) => t.id);
    expect(ids).not.toContain("blood");
  });

  it("never matches on a chord token or a section name", () => {
    // "Am" is a chord, "Bridge" a section; neither may contribute.
    const ids = detectThemes("{comment: Bridge}\n[Am]la la la").map((t) => t.id);
    expect(ids).toEqual([]);
  });

  it("is deterministic and sorted", () => {
    const a = detectThemes(BLOOD_SONG);
    const b = detectThemes(BLOOD_SONG);
    expect(a).toEqual(b);
    expect(a.map((t) => t.id)).toEqual([...a].sort((x, y) => Number(y.strong) - Number(x.strong) || y.score - x.score || x.id.localeCompare(y.id)).map((t) => t.id));
  });

  it("ships a lexicon with unique, slug-shaped ids", () => {
    const lex = loadThemes();
    const ids = lex.themes.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
    // the labels Kevin named explicitly
    expect(ids).toEqual(expect.arrayContaining(["blood", "cross", "heaven", "jubilee"]));
  });
});

describe("tag field", () => {
  it("splits manual tags, themes and rejections", () => {
    expect(parseTagField("hymn, theme:blood, !theme:cross, choir")).toEqual({
      tags: ["hymn", "choir"],
      themes: ["blood"],
      negated: ["cross"],
      flags: [],
    });
  });

  it("round-trips", () => {
    const parsed = parseTagField("hymn, theme:blood, !theme:cross");
    expect(parseTagField(formatTagField(parsed))).toEqual(parsed);
  });

  it("keeps a flag out of the plain tags — unlisted is not a subject", () => {
    const parsed = parseTagField("hymn, flag:unlisted, flag:secular, theme:blood");
    expect(parsed.tags).toEqual(["hymn"]);
    expect(parsed.flags).toEqual(["unlisted", "secular"]);
    // And it survives a round trip, or the theme pass would drop it.
    expect(parseTagField(formatTagField(parsed)).flags).toEqual(["secular", "unlisted"]);
  });

  it("a theme pass preserves a flag it knows nothing about", () => {
    // mergeThemes reads and rewrites the whole field; a flag it dropped would
    // vanish the next time anyone re-ran the lexicon.
    const after = mergeThemes("flag:unlisted, theme:blood", ["cross"]);
    expect(parseTagField(after).flags).toEqual(["unlisted"]);
    expect(parseTagField(after).themes.sort()).toEqual(["blood", "cross"]);
  });

  it("is safe on empty input", () => {
    expect(parseTagField(null)).toEqual({ tags: [], themes: [], negated: [], flags: [] });
    expect(parseTagField("")).toEqual({ tags: [], themes: [], negated: [], flags: [] });
  });
});

describe("mergeThemes", () => {
  it("adds detected themes and keeps manual tags", () => {
    expect(mergeThemes("hymn", ["blood", "cross"])).toBe("hymn, theme:blood, theme:cross");
  });

  it("is idempotent — applying twice equals applying once", () => {
    const once = mergeThemes("hymn", ["blood"]);
    expect(mergeThemes(once, ["blood"])).toBe(once);
  });

  it("NEVER re-adds a theme a human rejected", () => {
    // The property the whole design exists for.
    const afterReject = rejectTheme("theme:blood, theme:cross", "blood");
    expect(parseTagField(afterReject).themes).toEqual(["cross"]);
    expect(parseTagField(afterReject).negated).toEqual(["blood"]);

    const afterRerun = mergeThemes(afterReject, ["blood", "cross", "heaven"]);
    expect(parseTagField(afterRerun).themes.sort()).toEqual(["cross", "heaven"]);
    expect(parseTagField(afterRerun).negated).toEqual(["blood"]);
  });

  it("never removes anything on its own", () => {
    const before = "hymn, theme:blood, theme:cross";
    const after = mergeThemes(before, []);
    expect(parseTagField(after).themes.sort()).toEqual(["blood", "cross"]);
    expect(parseTagField(after).tags).toEqual(["hymn"]);
  });

  it("survives a lexicon that grows later", () => {
    let tags = mergeThemes("", ["blood"]);
    tags = rejectTheme(tags, "blood");
    // a broader lexicon next month detects more — the rejection still holds
    tags = mergeThemes(tags, ["blood", "jubilee", "heaven"]);
    expect(parseTagField(tags).themes.sort()).toEqual(["heaven", "jubilee"]);
  });
});

describe("resetThemes", () => {
  it("clears assertions but preserves every human rejection", () => {
    const out = resetThemes("hymn, theme:blood, theme:cross, !theme:heaven");
    expect(parseTagField(out)).toEqual({ tags: ["hymn"], themes: [], negated: ["heaven"], flags: [] });
  });
});
