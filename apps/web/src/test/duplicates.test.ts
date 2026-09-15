import { describe, expect, it } from "vitest";
import { copyAcross, describeCopy, overlapLabel, sourceLabel } from "@/lib/duplicates";

const state = (value: string, start: number, end = start) => ({ value, selectionStart: start, selectionEnd: end });

describe("copyAcross", () => {
  it("puts a selection in where the other chart's cursor is", () => {
    const from = state("[G]Amazing grace\n[C]How sweet", 3, 10);
    const to = state("Amazing grace", 0);
    expect(copyAcross(from, to)).toEqual({ value: "AmazingAmazing grace", caret: 7, copied: "Amazing" });
  });

  it("replaces what is selected in the other chart", () => {
    const from = state("[D]Line", 0, 7);
    const to = state("one TWO three", 4, 7);
    expect(copyAcross(from, to).value).toBe("one [D]Line three");
  });

  it("copies the cursor's whole line, as a new line below the other chart's cursor line", () => {
    const from = state("{title: A}\n{artist: Sinach}\n\n[G]Way maker", 15);
    const to = state("{title: A}\n{key: E}\n\n[E]Way maker", 3);
    const result = copyAcross(from, to);
    expect(result.value).toBe("{title: A}\n{artist: Sinach}\n{key: E}\n\n[E]Way maker");
    expect(result.copied).toBe("{artist: Sinach}");
    expect(result.value.slice(0, result.caret)).toBe("{title: A}\n{artist: Sinach}");
  });

  it("copies the first line from the very start of a chart", () => {
    expect(copyAcross(state("{title: A}\nrest", 0), state("x", 1)).value).toBe("x\n{title: A}");
  });

  it("fills an empty chart with the line", () => {
    expect(copyAcross(state("only line", 4), state("", 0))).toEqual({ value: "only line", caret: 9, copied: "only line" });
  });

  it("copies nothing from a blank line", () => {
    expect(copyAcross(state("a\n\nb", 2), state("x", 0))).toEqual({ value: "x", caret: 0, copied: "" });
  });
});

describe("labels", () => {
  it("names where a chart came from in words", () => {
    expect(sourceLabel("chrd")).toBe("Church chart");
    expect(sourceLabel("docx")).toBe("Word lyric sheet");
    expect(sourceLabel("app")).toBe("Made in the app");
    expect(sourceLabel("mystery")).toBe("Imported");
  });

  it("says how alike two songs are, and what a copy moved", () => {
    expect(overlapLabel(0.924)).toBe("92% of the words match");
    expect(describeCopy("a\nb\nc")).toBe("3 lines");
    expect(describeCopy("  {key: E} ")).toBe('"{key: E}"');
  });
});
