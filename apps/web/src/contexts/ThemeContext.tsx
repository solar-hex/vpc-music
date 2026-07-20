import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { contrastingTextColor } from "@/lib/color";

export type Theme = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";
export type ContrastMode = "normal" | "high";
export type EditorMode = "beginner" | "advanced";
export type ThemePreset = "custom" | "stage-dark" | "print-light" | "classic";
export type SongFontFamily = "mono";

interface AppearanceSettings {
  editorMode: EditorMode;
  themePreset: ThemePreset;
  chordColor: string;
  secondaryChordColor: string;
  pageBackground: string;
  songFontFamily: SongFontFamily;
}

interface ThemePresetDefinition {
  label: string;
  description: string;
  theme: Theme;
  contrastMode: ContrastMode;
  chordColor: string;
  secondaryChordColor: string;
  pageBackground: string;
  songFontFamily: SongFontFamily;
}

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  contrastMode: ContrastMode;
  editorMode: EditorMode;
  themePreset: ThemePreset;
  chordColor: string;
  secondaryChordColor: string;
  pageBackground: string;
  songFontFamily: SongFontFamily;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setContrastMode: (mode: ContrastMode) => void;
  toggleContrastMode: () => void;
  setEditorMode: (mode: EditorMode) => void;
  setThemePreset: (preset: ThemePreset) => void;
  setChordColor: (color: string) => void;
  setSecondaryChordColor: (color: string) => void;
  setPageBackground: (color: string) => void;
  setSongFontFamily: (fontFamily: SongFontFamily) => void;
}

const THEME_STORAGE_KEY = "vpc-theme";
const CONTRAST_STORAGE_KEY = "vpc-contrast";
export const APPEARANCE_STORAGE_KEY = "vpc-appearance";

const DEFAULT_APPEARANCE: AppearanceSettings = {
  editorMode: "advanced",
  themePreset: "custom",
  chordColor: "#ca9762",
  secondaryChordColor: "#8b5cf6",
  pageBackground: "#f8f9fa",
  songFontFamily: "mono",
};

const SONG_FONT_STACKS: Record<SongFontFamily, string> = {
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
};

export const THEME_PRESETS: Record<Exclude<ThemePreset, "custom">, ThemePresetDefinition> = {
  "stage-dark": {
    label: "Stage Dark",
    description: "Deep blue stage background with bright cool chord accents.",
    theme: "dark",
    contrastMode: "normal",
    chordColor: "#7dd3fc",
    secondaryChordColor: "#c084fc",
    pageBackground: "#000435",
    songFontFamily: "mono",
  },
  "print-light": {
    label: "Print Light",
    description: "Clean white paper look with darker chart colors for bright rooms.",
    theme: "light",
    contrastMode: "normal",
    chordColor: "#b91c1c",
    secondaryChordColor: "#7c3aed",
    pageBackground: "#ffffff",
    songFontFamily: "mono",
  },
  classic: {
    label: "Classic",
    description: "Warm gold chords with a soft paper background and familiar defaults.",
    theme: "light",
    contrastMode: "normal",
    chordColor: "#ca9762",
    secondaryChordColor: "#8b5cf6",
    pageBackground: "#f8f9fa",
    songFontFamily: "mono",
  },
};

export const SONG_FONT_OPTIONS: { value: SongFontFamily; label: string; description: string }[] = [
  { value: "mono", label: "Monospace", description: "Alignment-friendly for every rendered chart." },
];

export const EDITOR_MODE_OPTIONS: { value: EditorMode; label: string; description: string }[] = [
  { value: "beginner", label: "Beginner", description: "Examples and help stay visible while advanced tools stay out of the way." },
  { value: "advanced", label: "Advanced", description: "Full shortcut-driven toolbar with formatting and section power tools." },
];

export const THEME_PRESET_OPTIONS: { value: ThemePreset; label: string; description: string }[] = [
  { value: "custom", label: "Custom", description: "Use your own colors, background, and font choices." },
  ...Object.entries(THEME_PRESETS).map(([value, preset]) => ({
    value: value as Exclude<ThemePreset, "custom">,
    label: preset.label,
    description: preset.description,
  })),
];

function normalizeHexColor(value: string, fallback: string): string {
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
      editorMode: parsed.editorMode === "beginner" ? "beginner" : DEFAULT_APPEARANCE.editorMode,
      themePreset:
        parsed.themePreset === "stage-dark" ||
        parsed.themePreset === "print-light" ||
        parsed.themePreset === "classic" ||
        parsed.themePreset === "custom"
          ? parsed.themePreset
          : DEFAULT_APPEARANCE.themePreset,
      chordColor: normalizeHexColor(parsed.chordColor ?? DEFAULT_APPEARANCE.chordColor, DEFAULT_APPEARANCE.chordColor),
      secondaryChordColor: normalizeHexColor(parsed.secondaryChordColor ?? DEFAULT_APPEARANCE.secondaryChordColor, DEFAULT_APPEARANCE.secondaryChordColor),
      pageBackground: normalizeHexColor(parsed.pageBackground ?? DEFAULT_APPEARANCE.pageBackground, DEFAULT_APPEARANCE.pageBackground),
      songFontFamily: parsed.songFontFamily === "mono" ? parsed.songFontFamily : DEFAULT_APPEARANCE.songFontFamily,
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem(THEME_STORAGE_KEY) as Theme) || "dark";
    }
    return "dark";
  });

  const [contrastMode, setContrastModeState] = useState<ContrastMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem(CONTRAST_STORAGE_KEY) as ContrastMode) || "normal";
    }
    return "normal";
  });

  const [appearance, setAppearance] = useState<AppearanceSettings>(readStoredAppearance);

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolve(theme));

  // Apply dark class + color-scheme + persist
  useEffect(() => {
    const resolved = resolve(theme);
    setResolvedTheme(resolved);
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.classList.toggle("high-contrast", contrastMode === "high");
    document.documentElement.style.colorScheme = resolved;
    document.documentElement.style.setProperty("--song-chord-color", appearance.chordColor);
    document.documentElement.style.setProperty("--song-secondary-chord-color", appearance.secondaryChordColor);
    document.documentElement.style.setProperty("--page-background-color", appearance.pageBackground);
    // Paired text color for surfaces painted with the page background —
    // contrast follows the surface, not the app theme (TASK-034 ghost text).
    document.documentElement.style.setProperty("--page-foreground-color", contrastingTextColor(appearance.pageBackground));
    document.documentElement.style.setProperty("--song-display-font", SONG_FONT_STACKS[appearance.songFontFamily]);
    document.documentElement.dataset.editorMode = appearance.editorMode;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.setItem(CONTRAST_STORAGE_KEY, contrastMode);
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("vpc-appearance-change", { detail: appearance }));
    }
  }, [theme, contrastMode, appearance]);

  // Listen for system preference changes when set to "system"
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      document.documentElement.classList.toggle("dark", resolved === "dark");
      document.documentElement.classList.toggle("high-contrast", contrastMode === "high");
      document.documentElement.style.colorScheme = resolved;
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, contrastMode]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggleTheme = useCallback(
    () => setThemeState((t: Theme) => (resolve(t) === "dark" ? "light" : "dark")),
    [],
  );
  const setContrastMode = useCallback((mode: ContrastMode) => setContrastModeState(mode), []);
  const toggleContrastMode = useCallback(
    () => setContrastModeState((mode) => (mode === "high" ? "normal" : "high")),
    [],
  );
  const setEditorMode = useCallback((mode: EditorMode) => {
    setAppearance((current) => ({ ...current, editorMode: mode }));
  }, []);
  const setThemePreset = useCallback((preset: ThemePreset) => {
    if (preset === "custom") {
      setAppearance((current) => ({ ...current, themePreset: "custom" }));
      return;
    }
    const presetConfig = THEME_PRESETS[preset];
    setThemeState(presetConfig.theme);
    setContrastModeState(presetConfig.contrastMode);
    setAppearance((current) => ({
      ...current,
      themePreset: preset,
      chordColor: presetConfig.chordColor,
      secondaryChordColor: presetConfig.secondaryChordColor,
      pageBackground: presetConfig.pageBackground,
      songFontFamily: presetConfig.songFontFamily,
    }));
  }, []);
  const setChordColor = useCallback((color: string) => {
    setAppearance((current) => ({
      ...current,
      themePreset: "custom",
      chordColor: normalizeHexColor(color, current.chordColor),
    }));
  }, []);
  const setSecondaryChordColor = useCallback((color: string) => {
    setAppearance((current) => ({
      ...current,
      themePreset: "custom",
      secondaryChordColor: normalizeHexColor(color, current.secondaryChordColor),
    }));
  }, []);
  const setPageBackground = useCallback((color: string) => {
    setAppearance((current) => ({
      ...current,
      themePreset: "custom",
      pageBackground: normalizeHexColor(color, current.pageBackground),
    }));
  }, []);
  const setSongFontFamily = useCallback((fontFamily: SongFontFamily) => {
    setAppearance((current) => ({
      ...current,
      themePreset: "custom",
      songFontFamily: fontFamily,
    }));
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        contrastMode,
        editorMode: appearance.editorMode,
        themePreset: appearance.themePreset,
        chordColor: appearance.chordColor,
        secondaryChordColor: appearance.secondaryChordColor,
        pageBackground: appearance.pageBackground,
        songFontFamily: appearance.songFontFamily,
        setTheme,
        toggleTheme,
        setContrastMode,
        toggleContrastMode,
        setEditorMode,
        setThemePreset,
        setChordColor,
        setSecondaryChordColor,
        setPageBackground,
        setSongFontFamily,
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
