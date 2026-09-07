import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { CHART_PREFS_KEY, DEFAULT_CHART_PREFS, nextFontSize, readChartPrefs, useChartPrefs, writeChartPrefs } from "@/lib/chart-prefs";

describe("chart-prefs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns defaults when nothing is stored or the value is corrupt", () => {
    expect(readChartPrefs()).toEqual(DEFAULT_CHART_PREFS);
    localStorage.setItem(CHART_PREFS_KEY, "not json");
    expect(readChartPrefs()).toEqual(DEFAULT_CHART_PREFS);
  });

  it("ignores unknown font sizes and non-boolean flags", () => {
    localStorage.setItem(CHART_PREFS_KEY, JSON.stringify({ fontSize: 99, nashville: "yes", showComments: false }));
    expect(readChartPrefs()).toEqual({ ...DEFAULT_CHART_PREFS, showComments: false });
  });

  it("round-trips through localStorage", () => {
    writeChartPrefs({ fontSize: 20, showComments: false, nashville: true, keepAwake: true });
    expect(readChartPrefs()).toEqual({ fontSize: 20, showComments: false, nashville: true, keepAwake: true });
  });

  it("cycles font sizes and wraps around", () => {
    expect(nextFontSize(16)).toBe(18);
    expect(nextFontSize(24)).toBe(14);
  });

  it("useChartPrefs persists every update", () => {
    const { result } = renderHook(() => useChartPrefs());
    expect(result.current[0]).toEqual(DEFAULT_CHART_PREFS);
    act(() => result.current[1]({ nashville: true, fontSize: 18 }));
    expect(result.current[0]).toMatchObject({ nashville: true, fontSize: 18 });
    expect(JSON.parse(localStorage.getItem(CHART_PREFS_KEY)!)).toMatchObject({ nashville: true, fontSize: 18 });
  });
});
