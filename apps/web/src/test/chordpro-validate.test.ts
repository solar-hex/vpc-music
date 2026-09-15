import { describe, it, expect } from "vitest";
import { validateChordPro } from "@/utils/chordpro-validate";

describe("chordpro-validate", () => {
  it("returns no issues for valid content", () => {
    const source = `{title: Amazing Grace}
{key: G}

{comment: Verse 1}
[G]Amazing [C]grace`;
    expect(validateChordPro(source)).toEqual([]);
  });

  it("returns no issues for empty content", () => {
    expect(validateChordPro("")).toEqual([]);
  });

  // ── Missing closing bracket ──

  it("detects missing closing bracket", () => {
    const issues = validateChordPro("[G Amazing grace");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].line).toBe(1);
    expect(issues[0].message).toMatch(/Missing closing `\]`/);
  });

  it("detects multiple unclosed brackets", () => {
    const issues = validateChordPro("[G word [C other");
    expect(issues.some((i) => i.severity === "error")).toBe(true);
  });

  // ── Unbalanced braces ──

  it("detects unclosed brace on directive line", () => {
    const issues = validateChordPro("{title: No close");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].message).toMatch(/missing `}`/i);
  });

  it("detects unexpected closing bracket", () => {
    const issues = validateChordPro("text ] more");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].message).toMatch(/Unexpected `\]`/);
  });

  it("detects unexpected closing brace in lyrics", () => {
    const issues = validateChordPro("text } more");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].message).toMatch(/Unexpected `}`/);
  });

  // ── Unknown directive ──

  it("warns on unknown directive", () => {
    const issues = validateChordPro("{foobar: test}");
    expect(issues.some((issue) => issue.message.match(/Unknown directive/))).toBe(true);
  });

  it("never warns on custom x_ directives or the song properties the editor writes", () => {
    // Every library chart carries x_ directives; warning on them buried real problems.
    const lines = [
      "{x_album: Generations}",
      "{x_writers: Mark Yandris}",
      "{x_audio_soprano: https://example.com/soprano.mp3}",
      "{copyright: © 2021 Integrity Music}",
      "{ccli: 7117726}",
      "{duration: 4:05}",
    ];
    expect(validateChordPro(lines.join("\n")).filter((issue) => issue.code === "unknown-directive")).toEqual([]);
  });

  it("does not warn on known directives", () => {
    const knownLines = [
      "{title: Test}",
      "{key: G}",
      "{tempo: 120}",
      "{comment: Verse}",
      "{artist: Someone}",
      "{capo: 2}",
    ];
    for (const line of knownLines) {
      const issues = validateChordPro(line);
      const warnings = issues.filter((i) => i.severity === "warning");
      expect(warnings).toHaveLength(0);
    }
  });

  // ── Duplicate top directives ──

  it("warns on duplicate {title}", () => {
    const issues = validateChordPro("{title: One}\n{title: Two}");
    const warnings = issues.filter((i) => i.severity === "warning");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toMatch(/Duplicate.*title/i);
    expect(warnings[0].line).toBe(2);
  });

  it("warns on duplicate {key}", () => {
    const issues = validateChordPro("{key: G}\n{key: C}");
    const warnings = issues.filter((i) => i.severity === "warning");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toMatch(/Duplicate.*key/i);
  });

  it("allows multiple {comment} directives", () => {
    const issues = validateChordPro("{comment: Verse 1}\n{comment: Chorus}");
    expect(issues).toHaveLength(0);
  });

  // ── Correct line numbers ──

  it("reports correct line numbers", () => {
    const source = "line1\nline2\n[G open";
    const issues = validateChordPro(source);
    expect(issues[0].line).toBe(3);
  });

  // ── Mixed content ──

  it("finds multiple issues in complex content", () => {
    const source = `{title: Test}
{title: Duplicate}
{unknown_thing: value}
[G Good line
Normal lyrics`;
    const issues = validateChordPro(source);
    // At least: duplicate title warning, unknown directive warning, unclosed bracket
    expect(issues.length).toBeGreaterThanOrEqual(3);
  });

  // ── Valid complex content ──

  it("passes valid complex ChordPro", () => {
    const source = `{title: Amazing Grace}
{artist: John Newton}
{key: G}
{tempo: 72}

{comment: Verse 1}
[G]Amazing [G/B]grace, how [C]sweet the [G]sound
That [G]saved a [Em]wretch like [D]me

{comment: Chorus}
[G]I once was [C]lost, but [G]now am [D]found
Was [G]blind, but [C]now I [G]see`;
    expect(validateChordPro(source)).toEqual([]);
  });

  it("suggests corrected chord spellings for malformed chord tokens", () => {
    const issues = validateChordPro("[g / b]Amazing grace");
    const chordWarning = issues.find((issue) => issue.code === "malformed-chord");
    expect(chordWarning).toBeTruthy();
    expect(chordWarning?.suggestedValue).toBe("G/B");
    expect(chordWarning?.suggestedFixLabel).toBe("Use [G/B]");
  });
});

describe("correctChordSpelling", () => {
  it("suggests conventional spellings for sloppy chords", async () => {
    const { correctChordSpelling } = await import("@/utils/chordpro-validate");
    expect(correctChordSpelling(" g / b ")).toBe("G/B");
    expect(correctChordSpelling("amin")).toBe("Am");
    expect(correctChordSpelling("G")).toBeNull();
    expect(correctChordSpelling("???")).toBeNull();
  });
});
