import { useState, useEffect } from "react";
import {
  useTheme,
  EDITOR_MODE_OPTIONS,
  SONG_FONT_OPTIONS,
  THEME_PRESETS,
  THEME_PRESET_OPTIONS,
  type EditorMode,
  type SongFontFamily,
  type ThemePreset,
} from "@/contexts/ThemeContext";
import { platformApi } from "@/lib/api-client";
import { Palette, Music2, Clock3 } from "lucide-react";

type ThemeSetting = "dark" | "light" | "system";
type ContrastSetting = "normal" | "high";
type KeyNotation = "sharps" | "flats";
type DurationDisplay = "minutes" | "clock";

function getPreviewTextColor(background: string) {
  const hex = background.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#0f172a";
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.6 ? "#0f172a" : "#ffffff";
}

/** Settings → Preferences: notation, duration display, time zone, theme. */
export function SettingsPreferencesTab() {
  const {
    theme,
    setTheme,
    contrastMode,
    setContrastMode,
    editorMode,
    setEditorMode,
    themePreset,
    setThemePreset,
    chordColor,
    setChordColor,
    secondaryChordColor,
    setSecondaryChordColor,
    pageBackground,
    setPageBackground,
    songFontFamily,
    setSongFontFamily,
  } = useTheme();

  const [prefs, setPrefs] = useState<Record<string, any>>({});
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [keyNotation, setKeyNotation] = useState<KeyNotation>("sharps");
  const [durationDisplay, setDurationDisplay] = useState<DurationDisplay>("clock");
  const [timeZone, setTimeZone] = useState("");

  useEffect(() => {
    platformApi
      .getSettings()
      .then((res) => {
        const settings = res.settings ?? {};
        setPrefs(settings);

        if (settings.theme === "light" || settings.theme === "dark" || settings.theme === "system") {
          setTheme(settings.theme);
        }
        if (settings.contrastMode === "normal" || settings.contrastMode === "high") {
          setContrastMode(settings.contrastMode);
        }
        if (settings.editorMode === "beginner" || settings.editorMode === "advanced") {
          setEditorMode(settings.editorMode);
        }
        if (
          settings.themePreset === "custom" ||
          settings.themePreset === "stage-dark" ||
          settings.themePreset === "print-light" ||
          settings.themePreset === "classic"
        ) {
          setThemePreset(settings.themePreset);
        }
        if (typeof settings.chordColor === "string") setChordColor(settings.chordColor);
        if (typeof settings.secondaryChordColor === "string") setSecondaryChordColor(settings.secondaryChordColor);
        if (typeof settings.pageBackground === "string") setPageBackground(settings.pageBackground);
        if (settings.songFontFamily === "mono") setSongFontFamily(settings.songFontFamily);
        if (settings.keyNotation === "sharps" || settings.keyNotation === "flats") setKeyNotation(settings.keyNotation);
        if (settings.durationDisplay === "minutes" || settings.durationDisplay === "clock") {
          setDurationDisplay(settings.durationDisplay);
        }
        if (typeof settings.timeZone === "string") setTimeZone(settings.timeZone);
      })
      .catch(() => {})
      .finally(() => setLoadingPrefs(false));
  }, [setChordColor, setContrastMode, setEditorMode, setPageBackground, setSecondaryChordColor, setSongFontFamily, setTheme, setThemePreset]);

  const persistPreferencePatch = (patch: Record<string, any>) => {
    const nextPrefs = { ...prefs, ...patch };
    setPrefs(nextPrefs);
    platformApi.updateSettings(nextPrefs).catch(() => {});
  };

  const handleThemeChange = (t: ThemeSetting) => {
    setTheme(t);
    persistPreferencePatch({ theme: t });
  };

  const handleContrastChange = (mode: ContrastSetting) => {
    setContrastMode(mode);
    persistPreferencePatch({ contrastMode: mode });
  };

  const handleEditorModeChange = (mode: EditorMode) => {
    setEditorMode(mode);
    persistPreferencePatch({ editorMode: mode });
  };

  const handleThemePresetChange = (preset: ThemePreset) => {
    setThemePreset(preset);
    if (preset === "custom") {
      persistPreferencePatch({ themePreset: preset, chordColor, secondaryChordColor, pageBackground, songFontFamily });
      return;
    }
    const presetConfig = THEME_PRESETS[preset];
    persistPreferencePatch({
      themePreset: preset,
      theme: presetConfig.theme,
      contrastMode: presetConfig.contrastMode,
      chordColor: presetConfig.chordColor,
      secondaryChordColor: presetConfig.secondaryChordColor,
      pageBackground: presetConfig.pageBackground,
      songFontFamily: presetConfig.songFontFamily,
    });
  };

  const appearanceButtonClass = (active: boolean) =>
    `rounded-md px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"
        : "border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
    }`;
  const previewTextColor = getPreviewTextColor(pageBackground);
  const timeZones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Music display */}
      <section className="space-y-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <h3 className="flex items-center gap-2 text-lg font-brand text-[hsl(var(--foreground))]">
          <Music2 className="h-5 w-5 text-[hsl(var(--secondary))]" />
          Music Display
        </h3>
        <div className="space-y-2">
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">Default key notation</p>
          <div className="flex gap-3">
            {(["sharps", "flats"] as const).map((notation) => (
              <button
                key={notation}
                type="button"
                onClick={() => {
                  setKeyNotation(notation);
                  persistPreferencePatch({ keyNotation: notation });
                }}
                className={appearanceButtonClass(keyNotation === notation)}
                aria-pressed={keyNotation === notation}
              >
                {notation === "sharps" ? "Sharps (F#)" : "Flats (Gb)"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">Duration display</p>
          <div className="flex gap-3">
            {(["clock", "minutes"] as const).map((display) => (
              <button
                key={display}
                type="button"
                onClick={() => {
                  setDurationDisplay(display);
                  persistPreferencePatch({ durationDisplay: display });
                }}
                className={appearanceButtonClass(durationDisplay === display)}
                aria-pressed={durationDisplay === display}
              >
                {display === "clock" ? "3:45" : "3.75 min"}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Time zone */}
      <section className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <h3 className="flex items-center gap-2 text-lg font-brand text-[hsl(var(--foreground))]">
          <Clock3 className="h-5 w-5 text-[hsl(var(--secondary))]" />
          Time Zone
        </h3>
        <select
          value={timeZone}
          onChange={(e) => {
            setTimeZone(e.target.value);
            persistPreferencePatch({ timeZone: e.target.value });
          }}
          className="input w-full"
          aria-label="Time zone"
        >
          <option value="">Browser default ({Intl.DateTimeFormat().resolvedOptions().timeZone})</option>
          {timeZones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </section>

      {/* Theme */}
      <section className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <h3 className="flex items-center gap-2 text-lg font-brand text-[hsl(var(--foreground))]">
          <Palette className="h-5 w-5 text-[hsl(var(--secondary))]" />
          Appearance
        </h3>
        <div className="flex gap-3">
          {(["light", "dark", "system"] as const).map((t) => (
            <button key={t} type="button" onClick={() => handleThemeChange(t)} className={appearanceButtonClass(theme === t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">Contrast</p>
          <div className="flex gap-3">
            {(["normal", "high"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleContrastChange(mode)}
                className={appearanceButtonClass(contrastMode === mode)}
                aria-pressed={contrastMode === mode}
                aria-label={`${mode === "high" ? "High" : "Normal"} contrast mode`}
              >
                {mode === "high" ? "High Contrast" : "Normal Contrast"}
              </button>
            ))}
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            High contrast increases color separation, border strength, and focus visibility for low-vision use.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">Editor mode</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {EDITOR_MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleEditorModeChange(option.value)}
                className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                  editorMode === option.value
                    ? "border-[hsl(var(--secondary))] bg-[hsl(var(--secondary))]/10 text-[hsl(var(--foreground))]"
                    : "border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                }`}
                aria-pressed={editorMode === option.value}
                aria-label={`${option.label} editor mode`}
              >
                <div className="text-sm font-semibold">{option.label}</div>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{option.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">Theme preset</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {THEME_PRESET_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleThemePresetChange(option.value)}
                className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                  themePreset === option.value
                    ? "border-[hsl(var(--secondary))] bg-[hsl(var(--secondary))]/10 text-[hsl(var(--foreground))]"
                    : "border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                }`}
                aria-pressed={themePreset === option.value}
                aria-label={`${option.label} theme preset`}
              >
                <div className="text-sm font-semibold">{option.label}</div>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{option.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">Song color customization</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-2 text-sm font-medium text-[hsl(var(--foreground))]">
              <span>Primary chord color</span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={chordColor}
                  onChange={(e) => {
                    setChordColor(e.target.value);
                    persistPreferencePatch({ themePreset: "custom", chordColor: e.target.value });
                  }}
                  className="h-11 w-16 rounded-md border border-[hsl(var(--border))] bg-transparent"
                  aria-label="Primary chord color"
                />
                <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{chordColor}</span>
              </div>
            </label>
            <label className="space-y-2 text-sm font-medium text-[hsl(var(--foreground))]">
              <span>Secondary chord color</span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={secondaryChordColor}
                  onChange={(e) => {
                    setSecondaryChordColor(e.target.value);
                    persistPreferencePatch({ themePreset: "custom", secondaryChordColor: e.target.value });
                  }}
                  className="h-11 w-16 rounded-md border border-[hsl(var(--border))] bg-transparent"
                  aria-label="Secondary chord color"
                />
                <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{secondaryChordColor}</span>
              </div>
            </label>
            <label className="space-y-2 text-sm font-medium text-[hsl(var(--foreground))]">
              <span>Page background</span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={pageBackground}
                  onChange={(e) => {
                    setPageBackground(e.target.value);
                    persistPreferencePatch({ themePreset: "custom", pageBackground: e.target.value });
                  }}
                  className="h-11 w-16 rounded-md border border-[hsl(var(--border))] bg-transparent"
                  aria-label="Page background color"
                />
                <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{pageBackground}</span>
              </div>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">Rendered song font</p>
          <div className="flex flex-wrap gap-3">
            {SONG_FONT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setSongFontFamily(option.value);
                  persistPreferencePatch({ themePreset: "custom", songFontFamily: option.value });
                }}
                className={appearanceButtonClass(songFontFamily === option.value)}
                aria-pressed={songFontFamily === option.value}
                aria-label={`${option.label} display font`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{SONG_FONT_OPTIONS[0]?.description}</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">Live song preview</p>
          <div
            className="song-display-font rounded-xl border border-[hsl(var(--border))] p-4 shadow-sm"
            style={{ backgroundColor: pageBackground, color: previewTextColor }}
            data-testid="theme-preview-card"
          >
            <div className="song-secondary-chord text-xs font-semibold uppercase tracking-[0.2em]">Verse 1</div>
            <div className="song-primary-chord mt-3 whitespace-pre font-mono text-sm font-bold">G        C        D</div>
            <div className="mt-1 whitespace-pre-wrap text-sm">Amazing grace, how sweet the sound</div>
          </div>
        </div>

        {loadingPrefs && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Loading saved appearance preferences…</p>
        )}
      </section>
    </div>
  );
}
