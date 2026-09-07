import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type Theme = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";
export type KeyNotation = "sharps" | "flats";

interface AppearanceSettings {
  chordColor: string;
  secondaryChordColor: string;
  keyNotation: KeyNotation;
}

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  chordColor: string;
  secondaryChordColor: string;
  /** How the 12 keys are spelled in pickers and selects (F# vs Gb). */
  keyNotation: KeyNotation;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setChordColor: (color: string) => void;
  setSecondaryChordColor: (color: string) => void;
  setKeyNotation: (notation: KeyNotation) => void;
  /** Back to the stock chord colours. */
  resetChordColors: () => void;
}

const THEME_STORAGE_KEY = "vpc-theme";
export const APPEARANCE_STORAGE_KEY = "vpc-appearance";

export const DEFAULT_CHORD_COLOR = "#ca9762";
export const DEFAULT_SECONDARY_CHORD_COLOR = "#8b5cf6";

const DEFAULT_APPEARANCE: AppearanceSettings = {
  chordColor: DEFAULT_CHORD_COLOR,
  secondaryChordColor: DEFAULT_SECONDARY_CHORD_COLOR,
  keyNotation: "flats",
};

export function normalizeHexColor(value: string, fallback: string): string {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    const [, r, g, b] = value;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}

function readStoredAppearance(): AppearanceSettings {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = JSON.parse(raw) as Partial<AppearanceSettings>;
    return {
      chordColor: normalizeHexColor(parsed.chordColor ?? DEFAULT_APPEARANCE.chordColor, DEFAULT_APPEARANCE.chordColor),
      secondaryChordColor: normalizeHexColor(
        parsed.secondaryChordColor ?? DEFAULT_APPEARANCE.secondaryChordColor,
        DEFAULT_APPEARANCE.secondaryChordColor,
      ),
      keyNotation: parsed.keyNotation === "sharps" ? "sharps" : "flats",
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolve(theme: Theme): ResolvedTheme {
  return theme === "system" ? getSystemTheme() : theme;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Theme (light / dark / system), the two chord colours and the key spelling.
 * Everything is kept on the device so it applies before sign-in; the same
 * values live in the account preferences so they follow the person to the
 * next device (see PreferencesSync).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") return stored;
    }
    return "dark";
  });

  const [appearance, setAppearance] = useState<AppearanceSettings>(readStoredAppearance);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolve(theme));

  useEffect(() => {
    const resolved = resolve(theme);
    setResolvedTheme(resolved);
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.style.colorScheme = resolved;
    document.documentElement.style.setProperty("--song-chord-color", appearance.chordColor);
    document.documentElement.style.setProperty("--song-secondary-chord-color", appearance.secondaryChordColor);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
  }, [theme, appearance]);

  // Follow the OS while set to "system".
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      document.documentElement.classList.toggle("dark", resolved === "dark");
      document.documentElement.style.colorScheme = resolved;
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggleTheme = useCallback(() => setThemeState((t: Theme) => (resolve(t) === "dark" ? "light" : "dark")), []);
  const setChordColor = useCallback((color: string) => {
    setAppearance((current) => ({ ...current, chordColor: normalizeHexColor(color, current.chordColor) }));
  }, []);
  const setSecondaryChordColor = useCallback((color: string) => {
    setAppearance((current) => ({
      ...current,
      secondaryChordColor: normalizeHexColor(color, current.secondaryChordColor),
    }));
  }, []);
  const setKeyNotation = useCallback((notation: KeyNotation) => {
    setAppearance((current) => ({ ...current, keyNotation: notation }));
  }, []);
  const resetChordColors = useCallback(() => {
    setAppearance((current) => ({
      ...current,
      chordColor: DEFAULT_CHORD_COLOR,
      secondaryChordColor: DEFAULT_SECONDARY_CHORD_COLOR,
    }));
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        chordColor: appearance.chordColor,
        secondaryChordColor: appearance.secondaryChordColor,
        keyNotation: appearance.keyNotation,
        setTheme,
        toggleTheme,
        setChordColor,
        setSecondaryChordColor,
        setKeyNotation,
        resetChordColors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
