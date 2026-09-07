import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";

function ThemeConsumer() {
  const {
    theme,
    resolvedTheme,
    chordColor,
    secondaryChordColor,
    keyNotation,
    toggleTheme,
    setTheme,
    setChordColor,
    setSecondaryChordColor,
    setKeyNotation,
    resetChordColors,
  } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <span data-testid="chord-color">{chordColor}</span>
      <span data-testid="secondary-chord-color">{secondaryChordColor}</span>
      <span data-testid="key-notation">{keyNotation}</span>
      <button data-testid="toggle" onClick={toggleTheme}>Toggle</button>
      <button data-testid="set-light" onClick={() => setTheme("light")}>Light</button>
      <button data-testid="set-system" onClick={() => setTheme("system")}>System</button>
      <button data-testid="set-chord" onClick={() => setChordColor("#123456")}>Chord colour</button>
      <button data-testid="set-short-chord" onClick={() => setChordColor("#abc")}>Short chord colour</button>
      <button data-testid="set-bad-chord" onClick={() => setChordColor("red")}>Bad chord colour</button>
      <button data-testid="set-secondary" onClick={() => setSecondaryChordColor("#654321")}>Secondary colour</button>
      <button data-testid="set-sharps" onClick={() => setKeyNotation("sharps")}>Sharps</button>
      <button data-testid="reset" onClick={resetChordColors}>Reset</button>
    </div>
  );
}

function renderTheme() {
  return render(
    <ThemeProvider>
      <ThemeConsumer />
    </ThemeProvider>,
  );
}

describe("ThemeContext", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "";
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("defaults to dark, flats and the stock chord colours", () => {
    renderTheme();
    expect(screen.getByTestId("theme").textContent).toBe("dark");
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
    expect(screen.getByTestId("key-notation").textContent).toBe("flats");
    expect(screen.getByTestId("chord-color").textContent).toBe("#ca9762");
    expect(screen.getByTestId("secondary-chord-color").textContent).toBe("#8b5cf6");
  });

  it("persists the theme and appearance to localStorage", () => {
    renderTheme();
    expect(localStorage.getItem("vpc-theme")).toBe("dark");
    expect(localStorage.getItem("vpc-appearance")).toContain('"keyNotation":"flats"');
  });

  it("reads the theme from localStorage", () => {
    localStorage.setItem("vpc-theme", "light");
    renderTheme();
    expect(screen.getByTestId("theme").textContent).toBe("light");
    expect(screen.getByTestId("resolved").textContent).toBe("light");
  });

  it("ignores a stale theme value in localStorage", () => {
    localStorage.setItem("vpc-theme", "sepia");
    renderTheme();
    expect(screen.getByTestId("theme").textContent).toBe("dark");
  });

  it("toggleTheme switches from dark to light", () => {
    renderTheme();
    act(() => {
      screen.getByTestId("toggle").click();
    });
    expect(screen.getByTestId("theme").textContent).toBe("light");
    expect(screen.getByTestId("resolved").textContent).toBe("light");
  });

  it("applies and removes the .dark class on <html>", () => {
    renderTheme();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    act(() => {
      screen.getByTestId("set-light").click();
    });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("follows the OS when set to system", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    renderTheme();
    act(() => {
      screen.getByTestId("set-system").click();
    });
    expect(screen.getByTestId("theme").textContent).toBe("system");
    expect(screen.getByTestId("resolved").textContent).toBe("light");
  });

  it("throws when useTheme is used outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ThemeConsumer />)).toThrow("useTheme must be used within ThemeProvider");
    spy.mockRestore();
  });

  it("reads the appearance from localStorage", () => {
    localStorage.setItem(
      "vpc-appearance",
      JSON.stringify({ chordColor: "#112233", secondaryChordColor: "#445566", keyNotation: "sharps" }),
    );
    renderTheme();
    expect(screen.getByTestId("chord-color").textContent).toBe("#112233");
    expect(screen.getByTestId("secondary-chord-color").textContent).toBe("#445566");
    expect(screen.getByTestId("key-notation").textContent).toBe("sharps");
  });

  it("falls back to defaults for a corrupt appearance entry", () => {
    localStorage.setItem("vpc-appearance", "{not json");
    renderTheme();
    expect(screen.getByTestId("chord-color").textContent).toBe("#ca9762");
    expect(screen.getByTestId("key-notation").textContent).toBe("flats");
  });

  it("applies the chord colours as CSS variables", () => {
    renderTheme();
    act(() => {
      screen.getByTestId("set-chord").click();
      screen.getByTestId("set-secondary").click();
    });
    expect(document.documentElement.style.getPropertyValue("--song-chord-color")).toBe("#123456");
    expect(document.documentElement.style.getPropertyValue("--song-secondary-chord-color")).toBe("#654321");
  });

  it("normalises short hex colours and rejects anything else", () => {
    renderTheme();
    act(() => {
      screen.getByTestId("set-short-chord").click();
    });
    expect(screen.getByTestId("chord-color").textContent).toBe("#aabbcc");
    act(() => {
      screen.getByTestId("set-bad-chord").click();
    });
    expect(screen.getByTestId("chord-color").textContent).toBe("#aabbcc");
  });

  it("switches the key spelling and resets the colours", () => {
    renderTheme();
    act(() => {
      screen.getByTestId("set-sharps").click();
      screen.getByTestId("set-chord").click();
    });
    expect(screen.getByTestId("key-notation").textContent).toBe("sharps");
    expect(localStorage.getItem("vpc-appearance")).toContain('"keyNotation":"sharps"');
    act(() => {
      screen.getByTestId("reset").click();
    });
    expect(screen.getByTestId("chord-color").textContent).toBe("#ca9762");
    expect(screen.getByTestId("secondary-chord-color").textContent).toBe("#8b5cf6");
    // resetting colours leaves the spelling alone
    expect(screen.getByTestId("key-notation").textContent).toBe("sharps");
  });
});
