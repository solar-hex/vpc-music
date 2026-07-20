import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { contrastingTextColor } from "@/lib/color";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ChordProRenderer } from "@/components/songs/ChordProRenderer";

// TASK-034 regression: the editor preview paints the user-chosen page
// background (light gray by default, even in dark mode). Text on that
// surface must contrast the SURFACE, not the app theme — otherwise dark
// mode renders near-white "ghost text" on the light preview.

vi.mock("@vpc-music/shared", () => ({
  transposeKeyName: (key: string) => key,
  keyPrefersFlats: () => false,
  spellForTarget: (chord: string) => chord,
  parseBarLine: (line: string) =>
    line.trim().startsWith("|")
      ? {
          measures: line
            .trim()
            .split("|")
            .slice(1, -1)
            .map((cell: string) =>
              cell
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .map((value: string) => ({ type: /^[A-G]/.test(value) ? "chord" : "text", value })),
            ),
        }
      : null,
  parseChordPro: () => ({
    directives: { title: "Amazing Grace", artist: "John Newton" },
    sections: [
      {
        name: "Verse 1",
        lines: [
          { chords: [{ chord: "G", position: 0 }], lyrics: "Amazing grace how sweet" },
          { chords: [], lyrics: "| G x2 | C |" },
        ],
      },
    ],
  }),
  transposeChordPro: (content: string) => content,
  chordToNashville: (chord: string) => chord,
}));

describe("contrastingTextColor", () => {
  it("returns the dark brand foreground for light surfaces", () => {
    expect(contrastingTextColor("#f8f9fa")).toBe("#000435");
    expect(contrastingTextColor("#ffffff")).toBe("#000435");
  });

  it("returns the light foreground for dark surfaces", () => {
    expect(contrastingTextColor("#000435")).toBe("#f8f9fa");
    expect(contrastingTextColor("#122b44")).toBe("#f8f9fa");
  });

  it("falls back to dark text for invalid input", () => {
    expect(contrastingTextColor("not-a-color")).toBe("#000435");
  });
});

describe("ThemeProvider page-surface tokens", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("pairs --page-foreground-color with the page background", () => {
    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>,
    );
    const root = document.documentElement;
    // Default page background is light gray → paired text must be dark
    expect(root.style.getPropertyValue("--page-background-color")).toBe("#f8f9fa");
    expect(root.style.getPropertyValue("--page-foreground-color")).toBe("#000435");
  });
});

describe("ChordProRenderer inherits the surface color", () => {
  it("never hardcodes the app foreground on lyrics, title, or bar annotations", () => {
    const { container } = render(<ChordProRenderer content="test" songKey="G" />);

    // Lyrics + title render, and no element inside pins text to the theme
    // foreground — color comes from the host surface (.song-surface sets
    // the paired --page-foreground-color).
    expect(screen.getByText("Amazing grace how sweet")).toBeInTheDocument();
    expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
    const pinned = container.querySelectorAll('[class*="text-[hsl(var(--foreground))]"]');
    expect(pinned.length).toBe(0);

    // Bar-line annotations dim via opacity on the inherited color, not a
    // theme-muted color that can ghost on a light surface in dark mode.
    const annotation = screen.getByText("x2");
    expect(annotation.className).toContain("text-current");
    expect(annotation.className).toContain("opacity-70");
  });
});
