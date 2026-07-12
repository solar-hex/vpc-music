import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PerformanceMode } from "@/components/setlists/PerformanceMode";
import type { PerformanceModeProps } from "@/components/setlists/PerformanceMode";
import type { SetlistSongItem } from "@/lib/api-client";

// ---------- Mocks ----------
vi.mock("@/components/songs/ChordProRenderer", () => ({
  ChordProRenderer: ({ content, showChords, fontSize, baseTranspose }: any) => (
    <div
      data-testid="chordpro-renderer"
      data-show-chords={showChords}
      data-font-size={fontSize}
      data-transpose={baseTranspose ?? 0}
    >
      {content}
    </div>
  ),
  AutoScroll: () => <div data-testid="auto-scroll">AutoScroll</div>,
}));

vi.mock("@/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock("@vpc-music/shared", () => {
  const scale = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const interval = (from: string, to: string) => {
    const f = scale.indexOf(from);
    const t = scale.indexOf(to);
    if (f === -1 || t === -1) return 0;
    return ((t - f) % 12 + 12) % 12;
  };
  const transposeKeyName = (key: string, steps: number) => {
    const index = scale.indexOf(key);
    if (index === -1) return key;
    return scale[((index + steps) % 12 + 12) % 12];
  };
  return {
    ALL_KEYS: ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"],
    interval,
    transposeKeyName,
    keyPrefersFlats: () => false,
    parseBarLine: () => ({ measures: [] }),
    composeTranspose: ({ sourceKey = null, overrideKey = null, nudge = 0 }: any = {}) => {
      const overrideSteps =
        sourceKey && overrideKey && overrideKey !== sourceKey ? interval(sourceKey, overrideKey) : 0;
      const semis = (((overrideSteps + nudge) % 12) + 12) % 12;
      return { semis, preferFlats: false, displayKey: sourceKey ? transposeKeyName(sourceKey, semis) : null };
    },
  };
});

// ---------- Test data ----------
const mockSongs: SetlistSongItem[] = [
  {
    id: "item-1", songId: "s1", variationId: null, variationName: null,
    position: 0, songTitle: "Amazing Grace", songKey: "G", songArtist: "Newton",
    songTempo: 72, key: null, notes: null,
  },
  {
    id: "item-2", songId: "s2", variationId: null, variationName: null,
    position: 1, songTitle: "How Great", songKey: "D", songArtist: "Tomlin",
    songTempo: 130, key: "E", notes: null,
  },
  {
    id: "item-3", songId: "s3", variationId: "v1", variationName: "Acoustic",
    position: 2, songTitle: "Be Thou My Vision", songKey: "Eb", songArtist: null,
    songTempo: null, key: null, notes: null,
  },
];

function makeSongContents() {
  const m = new Map<string, { songId: string; content: string; key?: string | null; originalKey?: string | null; tempo?: number | null }>();
  m.set("s1", { songId: "s1", content: "{title: Amazing Grace}\n[G]Amazing grace", key: "G", originalKey: "G", tempo: 72 });
  // s2 carries a set list key override: chart written in D, performed in E
  m.set("s2", { songId: "s2", content: "{title: How Great}\n[D]How great", key: "E", originalKey: "D", tempo: 130 });
  m.set("s3", { songId: "s3", content: "{title: Be Thou My Vision}\n[Eb]Be thou", key: "Eb", originalKey: "Eb", tempo: null });
  return m;
}

const defaultProps: PerformanceModeProps = {
  songs: mockSongs,
  songContents: makeSongContents(),
  setlistName: "Sunday Service",
  initialSongIndex: 0,
  onExit: vi.fn(),
  onSongChange: vi.fn(),
};

function renderPerf(overrides: Partial<PerformanceModeProps> = {}) {
  return render(<PerformanceMode {...defaultProps} {...overrides} />);
}

describe("PerformanceMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===================== RENDERING =====================

  describe("rendering", () => {
    it("renders the performance mode overlay", () => {
      renderPerf();
      expect(screen.getByTestId("performance-mode")).toBeInTheDocument();
    });

    it("shows the setlist name in the toolbar", () => {
      renderPerf();
      expect(screen.getByText("Sunday Service")).toBeInTheDocument();
    });

    it("shows song position counter", () => {
      renderPerf();
      expect(screen.getByText("1 / 3")).toBeInTheDocument();
    });

    it("renders first song title", () => {
      renderPerf();
      expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
    });

    it("renders song content via ChordProRenderer", () => {
      renderPerf();
      const renderer = screen.getByTestId("chordpro-renderer");
      expect(renderer).toBeInTheDocument();
      expect(renderer.textContent).toContain("Amazing grace");
    });

    it("shows song key and tempo", () => {
      renderPerf();
      expect(screen.getByText("G")).toBeInTheDocument();
      expect(screen.getByText("72 BPM")).toBeInTheDocument();
      expect(screen.getByLabelText("Tempo 72 BPM")).toBeInTheDocument();
    });

    it("shows artist name", () => {
      renderPerf();
      expect(screen.getByText("Newton")).toBeInTheDocument();
    });

    it("starts at specified initial song index", () => {
      renderPerf({ initialSongIndex: 1 });
      expect(screen.getByText("How Great")).toBeInTheDocument();
      expect(screen.getByText("2 / 3")).toBeInTheDocument();
    });

    it("renders AutoScroll controls", () => {
      renderPerf();
      expect(screen.getByTestId("auto-scroll")).toBeInTheDocument();
    });

    it("renders song dot navigation buttons", () => {
      renderPerf();
      // Should have 3 dot nav buttons (one per song)
      const dotBtns = screen.getAllByTitle(/Amazing Grace|How Great|Be Thou My Vision/);
      expect(dotBtns.length).toBe(3);
    });

    it("shows 'Up next' banner for non-last songs", () => {
      renderPerf();
      expect(screen.getByText(/up next/i)).toBeInTheDocument();
      expect(screen.getByText("How Great")).toBeInTheDocument();
    });

    it("shows 'Last song' message on final song", () => {
      renderPerf({ initialSongIndex: 2 });
      expect(screen.getByText(/last song in the setlist/i)).toBeInTheDocument();
    });

    it("shows keyboard shortcuts hint", () => {
      renderPerf();
      expect(screen.getByText(/←\/→ navigate/)).toBeInTheDocument();
    });
  });

  // ===================== NAVIGATION =====================

  describe("navigation", () => {
    it("navigates to next song on next button click", () => {
      renderPerf();
      fireEvent.click(screen.getByTestId("perf-next"));
      expect(screen.getByText("How Great")).toBeInTheDocument();
      expect(screen.getByText("2 / 3")).toBeInTheDocument();
    });

    it("navigates to previous song on prev button click", () => {
      renderPerf({ initialSongIndex: 1 });
      fireEvent.click(screen.getByTestId("perf-prev"));
      expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
      expect(screen.getByText("1 / 3")).toBeInTheDocument();
    });

    it("prev button is disabled on first song", () => {
      renderPerf();
      expect(screen.getByTestId("perf-prev")).toBeDisabled();
    });

    it("next button is disabled on last song", () => {
      renderPerf({ initialSongIndex: 2 });
      expect(screen.getByTestId("perf-next")).toBeDisabled();
    });

    it("calls onSongChange callback when navigating", () => {
      const onSongChange = vi.fn();
      renderPerf({ onSongChange });
      fireEvent.click(screen.getByTestId("perf-next"));
      expect(onSongChange).toHaveBeenCalledWith(1);
    });

    it("navigates to specific song via dot buttons", () => {
      renderPerf();
      const dot3 = screen.getByTitle("Be Thou My Vision");
      fireEvent.click(dot3);
      expect(screen.getByText("3 / 3")).toBeInTheDocument();
    });

    it("navigates via N key", () => {
      renderPerf();
      fireEvent.keyDown(document, { key: "n" });
      expect(screen.getByText("2 / 3")).toBeInTheDocument();
    });

    it("navigates via P key", () => {
      renderPerf({ initialSongIndex: 2 });
      fireEvent.keyDown(document, { key: "p" });
      expect(screen.getByText("2 / 3")).toBeInTheDocument();
    });
  });

  // ===================== EXIT =====================

  describe("exit", () => {
    it("calls onExit when exit button is clicked", () => {
      const onExit = vi.fn();
      renderPerf({ onExit });
      fireEvent.click(screen.getByTestId("perf-exit"));
      expect(onExit).toHaveBeenCalledOnce();
    });
  });

  // ===================== CHORD TOGGLE =====================

  describe("chord toggle", () => {
    it("toggles chords visibility on button click", () => {
      renderPerf();
      const renderer = screen.getByTestId("chordpro-renderer");
      expect(renderer.getAttribute("data-show-chords")).toBe("true");

      fireEvent.click(screen.getByTestId("perf-toggle-chords"));
      expect(screen.getByTestId("chordpro-renderer").getAttribute("data-show-chords")).toBe("false");
    });

    it("toggles chords via C key", () => {
      renderPerf();
      expect(screen.getByTestId("chordpro-renderer").getAttribute("data-show-chords")).toBe("true");
      fireEvent.keyDown(document, { key: "c" });
      expect(screen.getByTestId("chordpro-renderer").getAttribute("data-show-chords")).toBe("false");
    });
  });

  // ===================== FONT SIZE =====================

  describe("font size", () => {
    it("increases font size on + key", () => {
      renderPerf();
      const initialSize = screen.getByTestId("chordpro-renderer").getAttribute("data-font-size");
      fireEvent.keyDown(document, { key: "+" });
      const newSize = screen.getByTestId("chordpro-renderer").getAttribute("data-font-size");
      expect(Number(newSize)).toBe(Number(initialSize) + 2);
    });

    it("decreases font size on - key", () => {
      renderPerf();
      const initialSize = screen.getByTestId("chordpro-renderer").getAttribute("data-font-size");
      fireEvent.keyDown(document, { key: "-" });
      const newSize = screen.getByTestId("chordpro-renderer").getAttribute("data-font-size");
      expect(Number(newSize)).toBe(Number(initialSize) - 2);
    });

    it("has a minimum font size of 18 (readable from a music stand)", () => {
      renderPerf();
      // Press minus many times
      for (let i = 0; i < 20; i++) {
        fireEvent.keyDown(document, { key: "-" });
      }
      expect(Number(screen.getByTestId("chordpro-renderer").getAttribute("data-font-size"))).toBe(18);
    });

    it("persists font size changes to localStorage", () => {
      renderPerf();
      fireEvent.keyDown(document, { key: "+" });
      expect(localStorage.getItem("perform-font-size")).toBeTruthy();
    });
  });

  // ===================== LIVE TRANSPOSE & KEY OVERRIDES =====================

  describe("live transpose", () => {
    it("moves the chart and displayed key one tap at a time", () => {
      renderPerf();
      expect(screen.getByTestId("perf-current-key")).toHaveTextContent("G");
      fireEvent.click(screen.getByTestId("perf-transpose-up"));
      expect(screen.getByTestId("perf-current-key")).toHaveTextContent("G#");
      expect(screen.getByTestId("chordpro-renderer").getAttribute("data-transpose")).toBe("1");
      fireEvent.click(screen.getByTestId("perf-transpose-down"));
      expect(screen.getByTestId("perf-current-key")).toHaveTextContent("G");
    });

    it("applies the set list key override as a render-time transpose", () => {
      renderPerf({ initialSongIndex: 1 }); // chart in D, override E
      expect(screen.getByTestId("perf-current-key")).toHaveTextContent("E");
      expect(screen.getByTestId("chordpro-renderer").getAttribute("data-transpose")).toBe("2");
    });

    it("keeps per-song transpose independent between songs", () => {
      renderPerf();
      fireEvent.click(screen.getByTestId("perf-transpose-up"));
      expect(screen.getByTestId("perf-current-key")).toHaveTextContent("G#");
      fireEvent.click(screen.getByTestId("perf-next"));
      // Song 2 shows its own key, unaffected by song 1's nudge
      expect(screen.getByTestId("perf-current-key")).toHaveTextContent("E");
      fireEvent.click(screen.getByTestId("perf-prev"));
      expect(screen.getByTestId("perf-current-key")).toHaveTextContent("G#");
    });

    it("has a maximum font size of 36", () => {
      renderPerf();
      for (let i = 0; i < 20; i++) {
        fireEvent.keyDown(document, { key: "+" });
      }
      expect(Number(screen.getByTestId("chordpro-renderer").getAttribute("data-font-size"))).toBe(36);
    });

    it("shows current font size in toolbar", () => {
      renderPerf();
      expect(screen.getByText("20")).toBeInTheDocument(); // default
    });
  });

  // ===================== TOOLBAR =====================

  describe("toolbar", () => {
    it("hides toolbar via T key", () => {
      renderPerf();
      expect(screen.getByTestId("perf-toolbar")).toBeInTheDocument();
      fireEvent.keyDown(document, { key: "t" });
      expect(screen.queryByTestId("perf-toolbar")).not.toBeInTheDocument();
    });

    it("shows restore button when toolbar hidden", () => {
      renderPerf();
      fireEvent.keyDown(document, { key: "t" });
      expect(screen.getByTitle("Show toolbar (T)")).toBeInTheDocument();
    });

    it("restores toolbar on restore button click", () => {
      renderPerf();
      fireEvent.keyDown(document, { key: "t" });
      fireEvent.click(screen.getByTitle("Show toolbar (T)"));
      expect(screen.getByTestId("perf-toolbar")).toBeInTheDocument();
    });
  });

  // ===================== TIMER =====================

  describe("countdown timer", () => {
    it("timer is disabled by default", () => {
      renderPerf();
      expect(screen.queryByTestId("perf-timer-bar")).not.toBeInTheDocument();
      expect(screen.queryByTestId("perf-timer-duration")).not.toBeInTheDocument();
    });

    it("enables timer on toggle button click", () => {
      renderPerf();
      fireEvent.click(screen.getByTestId("perf-timer-toggle"));
      expect(screen.getByTestId("perf-timer-bar")).toBeInTheDocument();
      expect(screen.getByTestId("perf-timer-display")).toBeInTheDocument();
    });

    it("shows timer duration selector when enabled", () => {
      renderPerf();
      fireEvent.click(screen.getByTestId("perf-timer-toggle"));
      expect(screen.getByTestId("perf-timer-duration")).toBeInTheDocument();
    });

    it("counts down over time", () => {
      renderPerf();
      fireEvent.click(screen.getByTestId("perf-timer-toggle"));

      // Default is 4 min = 240s, display shows remaining
      expect(screen.getByTestId("perf-timer-display").textContent).toBe("4:00");

      // Advance 10 seconds
      act(() => { vi.advanceTimersByTime(10000); });
      expect(screen.getByTestId("perf-timer-display").textContent).toBe("3:50");
    });

    it("disables timer on second toggle click", () => {
      renderPerf();
      fireEvent.click(screen.getByTestId("perf-timer-toggle"));
      expect(screen.getByTestId("perf-timer-bar")).toBeInTheDocument();

      fireEvent.click(screen.getByTestId("perf-timer-toggle"));
      expect(screen.queryByTestId("perf-timer-bar")).not.toBeInTheDocument();
    });

    it("resets timer when navigating to a new song", () => {
      renderPerf();
      fireEvent.click(screen.getByTestId("perf-timer-toggle"));

      // Advance 30 seconds
      act(() => { vi.advanceTimersByTime(30000); });
      expect(screen.getByTestId("perf-timer-display").textContent).toBe("3:30");

      // Navigate to next song — timer resets
      fireEvent.click(screen.getByTestId("perf-next"));
      expect(screen.getByTestId("perf-timer-display").textContent).toBe("4:00");
    });

    it("changes timer duration via dropdown", () => {
      renderPerf();
      fireEvent.click(screen.getByTestId("perf-timer-toggle"));

      fireEvent.change(screen.getByTestId("perf-timer-duration"), { target: { value: "300" } });
      expect(screen.getByTestId("perf-timer-display").textContent).toBe("5:00");
    });
  });

  // ===================== MISSING CONTENT =====================

  describe("missing content", () => {
    it("shows placeholder when song content not available", () => {
      renderPerf({ songContents: new Map() });
      expect(screen.getByText(/no content available/i)).toBeInTheDocument();
    });
  });

  // ===================== VARIATION =====================

  describe("variations", () => {
    it("shows variation badge when song has a variation", () => {
      renderPerf({ initialSongIndex: 2 });
      expect(screen.getByText("Acoustic")).toBeInTheDocument();
    });
  });
});
