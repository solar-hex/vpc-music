import { describe, it, expect } from "vitest";
import { hasDirective, readDirective, writeDirective } from "@/lib/chart-directives";

const CHART = ["{title: Covered}", "{key: Eb}", "{x_album: Generations}", "", "{comment: Verse 1}", "[Eb]No more sacrificing lambs,"].join("\n");

describe("readDirective", () => {
  it("reads a property from the chart", () => {
    expect(readDirective(CHART, "x_album")).toBe("Generations");
    expect(readDirective(CHART, "KEY")).toBe("Eb");
  });

  it("gives an empty value for a property the chart does not have", () => {
    expect(readDirective(CHART, "time")).toBe("");
    expect(hasDirective(CHART, "time")).toBe(false);
  });

  it("takes the last one when a chart repeats a property, as the parser does", () => {
    expect(readDirective("{time: 4/4}\n{time: 6/8}", "time")).toBe("6/8");
  });

  it("keeps spaces inside and after the value, so a field being typed into keeps them", () => {
    expect(readDirective("{x_writers: Bob }", "x_writers")).toBe("Bob ");
  });

  it("does not read a property name that only starts the same way", () => {
    expect(readDirective("{timely: soon}", "time")).toBe("");
  });

  it("tells an empty property from a missing one", () => {
    expect(hasDirective("{x_aka:}", "x_aka")).toBe(true);
    expect(readDirective("{x_aka:}", "x_aka")).toBe("");
  });
});

describe("writeDirective", () => {
  it("changes a property where it already is", () => {
    const next = writeDirective(CHART, "x_album", "Covered (Single)");
    expect(next.split("\n")[2]).toBe("{x_album: Covered (Single)}");
    expect(next.split("\n")).toHaveLength(CHART.split("\n").length);
  });

  it("adds a new property at the end of the block at the top, not in the song", () => {
    const next = writeDirective(CHART, "time", "4/4").split("\n");
    expect(next.slice(0, 4)).toEqual(["{title: Covered}", "{key: Eb}", "{x_album: Generations}", "{time: 4/4}"]);
    expect(next.at(-1)).toBe("[Eb]No more sacrificing lambs,");
  });

  it("adds a property to a chart with no directives at the very top", () => {
    expect(writeDirective("[G]Amazing grace", "time", "3/4")).toBe("{time: 3/4}\n[G]Amazing grace");
  });

  it("removes a property when it is cleared", () => {
    const next = writeDirective(CHART, "x_album", "");
    expect(next).not.toContain("x_album");
    expect(next.split("\n")).toHaveLength(CHART.split("\n").length - 1);
    expect(writeDirective(CHART, "x_album", "   ")).not.toContain("x_album");
  });

  it("leaves one copy of a property a chart repeats", () => {
    const next = writeDirective("{time: 4/4}\n{key: G}\n{time: 6/8}\n[G]Hi", "time", "3/4");
    expect(next).toBe("{time: 3/4}\n{key: G}\n[G]Hi");
  });

  it("will not let a brace or a line break spill a value into the chart", () => {
    const next = writeDirective(CHART, "copyright", "© 2021 {Integrity}\nMusic");
    expect(next).toContain("{copyright: © 2021 IntegrityMusic}");
    expect(next.split("\n")).toHaveLength(CHART.split("\n").length + 1);
  });

  it("changes nothing when clearing a property the chart does not have", () => {
    expect(writeDirective(CHART, "ccli", "")).toBe(CHART);
  });
});
