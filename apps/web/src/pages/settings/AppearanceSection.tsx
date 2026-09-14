import { Palette } from "lucide-react";
import { useTheme, type KeyNotation, type Theme } from "@/contexts/ThemeContext";
import { platformApi } from "@/lib/api-client";
import { PAGE_WIDTHS } from "@/lib/page-width";
import { SettingsSection } from "./SettingsSection";

const THEMES: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const NOTATIONS: { value: KeyNotation; label: string }[] = [
  { value: "flats", label: "Flats (Gb)" },
  { value: "sharps", label: "Sharps (F#)" },
];

function choiceClass(active: boolean) {
  return `rounded-md px-4 py-2 text-sm font-medium transition-colors ${
    active
      ? "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"
      : "border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
  }`;
}

/** Theme, key spelling, page width and the two chord colours, with a live preview. */
export function AppearanceSection() {
  const {
    theme,
    setTheme,
    keyNotation,
    setKeyNotation,
    chordColor,
    setChordColor,
    secondaryChordColor,
    setSecondaryChordColor,
    resetChordColors,
    pageWidth,
    setPageWidth,
  } = useTheme();

  // The device applies the change instantly; the account copy is best effort.
  const persist = (patch: Record<string, string>) => {
    platformApi.updateSettings(patch).catch(() => {});
  };

  return (
    <SettingsSection id="appearance" title="Appearance" icon={Palette}>
      <div className="space-y-2">
        <p className="text-sm font-medium text-[hsl(var(--foreground))]">Theme</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Theme">
          {THEMES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setTheme(option.value);
                persist({ theme: option.value });
              }}
              className={choiceClass(theme === option.value)}
              aria-pressed={theme === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-[hsl(var(--foreground))]">Key spelling</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Key spelling">
          {NOTATIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setKeyNotation(option.value);
                persist({ keyNotation: option.value });
              }}
              className={choiceClass(keyNotation === option.value)}
              aria-pressed={keyNotation === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">Used by the key picker and the editor's key list.</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-[hsl(var(--foreground))]">Page width</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Page width">
          {PAGE_WIDTHS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setPageWidth(option.value);
                persist({ pageWidth: option.value });
              }}
              className={choiceClass(pageWidth === option.value)}
              aria-pressed={pageWidth === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Centered keeps every page in one reading column. Full width uses the whole screen on a computer or tablet.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-[hsl(var(--foreground))]">Chord colours</p>
        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-1 text-sm">
            <span className="block text-[hsl(var(--muted-foreground))]">Chords</span>
            <span className="flex items-center gap-2">
              <input
                type="color"
                value={chordColor}
                onChange={(event) => {
                  setChordColor(event.target.value);
                  persist({ chordColor: event.target.value });
                }}
                className="h-11 w-16 rounded-md border border-[hsl(var(--border))] bg-transparent"
                aria-label="Chord colour"
              />
              <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{chordColor}</span>
            </span>
          </label>
          <label className="space-y-1 text-sm">
            <span className="block text-[hsl(var(--muted-foreground))]">Secondary chords</span>
            <span className="flex items-center gap-2">
              <input
                type="color"
                value={secondaryChordColor}
                onChange={(event) => {
                  setSecondaryChordColor(event.target.value);
                  persist({ secondaryChordColor: event.target.value });
                }}
                className="h-11 w-16 rounded-md border border-[hsl(var(--border))] bg-transparent"
                aria-label="Secondary chord colour"
              />
              <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{secondaryChordColor}</span>
            </span>
          </label>
          <button
            type="button"
            onClick={() => {
              resetChordColors();
              persist({ chordColor: "#ca9762", secondaryChordColor: "#8b5cf6" });
            }}
            className="btn-ghost btn-sm"
          >
            Reset colours
          </button>
        </div>
        <div
          className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 font-mono text-sm"
          data-testid="appearance-preview"
        >
          <div className="song-secondary-chord whitespace-pre text-xs">{"        c        f"}</div>
          <div className="song-primary-chord whitespace-pre font-bold">{"G        C        D"}</div>
          <div className="whitespace-pre">Amazing grace, how sweet the sound</div>
        </div>
      </div>
    </SettingsSection>
  );
}
