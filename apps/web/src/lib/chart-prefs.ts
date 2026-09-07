import { useCallback, useState } from "react";

/**
 * Device-level chart view preferences, persisted in localStorage exactly the
 * way the old Lead Sheets site did it: they must apply instantly and work
 * offline, and they belong to the device on the music stand, not the account.
 */
export const CHART_PREFS_KEY = "vpc-chart-prefs";
export const FONT_SIZES: readonly number[] = [14, 16, 18, 20, 24];

export interface ChartPrefs {
  fontSize: number;
  showComments: boolean;
  nashville: boolean;
  keepAwake: boolean;
}

export const DEFAULT_CHART_PREFS: ChartPrefs = {
  fontSize: 16,
  showComments: true,
  nashville: false,
  keepAwake: false,
};

export function readChartPrefs(): ChartPrefs {
  try {
    const raw = localStorage.getItem(CHART_PREFS_KEY);
    if (!raw) return { ...DEFAULT_CHART_PREFS };
    const parsed = JSON.parse(raw) as Partial<ChartPrefs>;
    return {
      fontSize: typeof parsed.fontSize === "number" && FONT_SIZES.includes(parsed.fontSize) ? parsed.fontSize : DEFAULT_CHART_PREFS.fontSize,
      showComments: typeof parsed.showComments === "boolean" ? parsed.showComments : DEFAULT_CHART_PREFS.showComments,
      nashville: typeof parsed.nashville === "boolean" ? parsed.nashville : DEFAULT_CHART_PREFS.nashville,
      keepAwake: typeof parsed.keepAwake === "boolean" ? parsed.keepAwake : DEFAULT_CHART_PREFS.keepAwake,
    };
  } catch {
    return { ...DEFAULT_CHART_PREFS };
  }
}

export function writeChartPrefs(prefs: ChartPrefs) {
  try {
    localStorage.setItem(CHART_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable (private mode, quota): the session still works.
  }
}

/** The next size in the cycle 14 -> 16 -> 18 -> 20 -> 24 -> 14. */
export function nextFontSize(current: number): number {
  const index = FONT_SIZES.indexOf(current);
  return FONT_SIZES[(index + 1) % FONT_SIZES.length];
}

export function useChartPrefs() {
  const [prefs, setPrefs] = useState<ChartPrefs>(readChartPrefs);
  const update = useCallback((patch: Partial<ChartPrefs>) => {
    setPrefs((previous) => {
      const next = { ...previous, ...patch };
      writeChartPrefs(next);
      return next;
    });
  }, []);
  return [prefs, update] as const;
}
