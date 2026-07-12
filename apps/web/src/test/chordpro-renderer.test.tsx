import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { ChordProRenderer, AutoScroll } from "@/components/songs/ChordProRenderer";
import { createRef } from "react";
import type { ChordProRendererHandle } from "@/components/songs/ChordProRenderer";

// ---------- Mocks ----------
const mockParseChordPro = vi.fn();
const mockTransposeChordPro = vi.fn();
const mockChordToNashville = vi.fn();

vi.mock("@vpc-music/shared", () => ({
  transposeKeyName: (key: string) => key,
  keyPrefersFlats: () => false,
  parseChordPro: (...args: any[]) => mockParseChordPro(...args),
  transposeChordPro: (...args: any[]) => mockTransposeChordPro(...args),
  chordToNashville: (...args: any[]) => mockChordToNashville(...args),
}));

// Standard parsed document returned by parseChordPro
const baseParsedDoc = {
  directives: { title: "Amazing Grace", artist: "John Newton" },
  sections: [
    {
      name: "Verse 1",
      lines: [
        {
          chords: [{ chord: "G", position: 0 }],
          lyrics: "Amazing grace how sweet the sound",
        },
      ],
    },
    {
      name: "Chorus",
      lines: [
        {
          chords: [
            { chord: "C", position: 0 },
            { chord: "G", position: 10 },
          ],
          lyrics: "Was blind but now I see",
        },
      ],
    },
  ],
};

describe("ChordProRenderer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParseChordPro.mockReturnValue(baseParsedDoc);
    mockTransposeChordPro.mockReturnValue("{t:Transposed}");
    mockChordToNashville.mockImplementation((chord: string) => {
      const map: Record<string, string> = { G: "1", C: "4", D: "5" };
      return map[chord] ?? chord;
    });
  });

  // ===================== BASIC RENDERING =====================

  describe("basic rendering", () => {
    it("renders title directive", () => {
      render(<ChordProRenderer content="{t:Amazing Grace}" />);
      expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
    });

    it("renders artist directive", () => {
      render(<ChordProRenderer content="{artist:John Newton}" />);
      expect(screen.getByText("John Newton")).toBeInTheDocument();
    });

    it("renders section names", () => {
      render(<ChordProRenderer content="{sov:Verse 1}" />);
      expect(screen.getByText("Verse 1")).toBeInTheDocument();
      expect(screen.getByText("Chorus")).toBeInTheDocument();
    });

    it("renders lyric text", () => {
      render(<ChordProRenderer content="lyrics here" />);
      expect(screen.getByText("Amazing grace how sweet the sound")).toBeInTheDocument();
    });

    it("renders chord names when showChords is true", () => {
      render(<ChordProRenderer content="chords" showChords={true} />);
      expect(screen.getAllByText("G").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("C")).toBeInTheDocument();
    });

    it("hides chords when showChords is false", () => {
      mockParseChordPro.mockReturnValue({
        directives: {},
        sections: [
          {
            name: "",
            lines: [
              { chords: [{ chord: "G", position: 0 }], lyrics: "Just lyrics" },
            ],
          },
        ],
      });
      render(<ChordProRenderer content="test" showChords={false} />);
      expect(screen.queryByText("G")).not.toBeInTheDocument();
      expect(screen.getByText("Just lyrics")).toBeInTheDocument();
    });
  });

  // ===================== TRANSPOSE CONTROLS =====================

  describe("transpose controls", () => {
    it("shows transpose controls when showChords is true", () => {
      render(<ChordProRenderer content="test" showChords={true} />);
      expect(screen.getByText("Transpose:")).toBeInTheDocument();
      expect(screen.getByText("+")).toBeInTheDocument();
      expect(screen.getByText("−")).toBeInTheDocument();
    });

    it("hides transpose controls when showChords is false", () => {
      render(<ChordProRenderer content="test" showChords={false} />);
      expect(screen.queryByText("Transpose:")).not.toBeInTheDocument();
    });

    it("shows 0 as default transpose value", () => {
      render(<ChordProRenderer content="test" />);
      expect(screen.getByText("0")).toBeInTheDocument();
    });

    it("increments transpose on + click", () => {
      render(<ChordProRenderer content="test" />);
      fireEvent.click(screen.getByText("+"));
      expect(screen.getByText("+1")).toBeInTheDocument();
      expect(mockTransposeChordPro).toHaveBeenCalledWith("test", 1, undefined);
    });

    it("decrements transpose on − click", () => {
      render(<ChordProRenderer content="test" />);
      fireEvent.click(screen.getByText("−"));
      expect(mockTransposeChordPro).toHaveBeenCalledWith("test", -1, undefined);
    });

    it("shows Reset button when transposed", () => {
      render(<ChordProRenderer content="test" />);
      expect(screen.queryByText("Reset")).not.toBeInTheDocument();
      fireEvent.click(screen.getByText("+"));
      expect(screen.getByText("Reset")).toBeInTheDocument();
    });

    it("resets to 0 on Reset click", () => {
      render(<ChordProRenderer content="test" />);
      fireEvent.click(screen.getByText("+"));
      fireEvent.click(screen.getByText("+"));
      expect(screen.getByText("+2")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Reset"));
      expect(screen.getByText("0")).toBeInTheDocument();
    });

    it("does not call transposeChordPro when transpose is 0", () => {
      render(<ChordProRenderer content="test" />);
      expect(mockTransposeChordPro).not.toHaveBeenCalled();
      expect(mockParseChordPro).toHaveBeenCalledWith("test");
    });

    it("calls transposeChordPro then parseChordPro when transposed", () => {
      mockTransposeChordPro.mockReturnValue("transposed-content");
      render(<ChordProRenderer content="test" />);
      fireEvent.click(screen.getByText("+"));
      expect(mockTransposeChordPro).toHaveBeenCalledWith("test", 1, undefined);
      expect(mockParseChordPro).toHaveBeenCalledWith("transposed-content");
    });

    it("wraps transpose back to 0 after 12 upward clicks", () => {
      render(<ChordProRenderer content="test" />);
      for (let i = 0; i < 12; i++) {
        fireEvent.click(screen.getByText("+"));
      }
      expect(screen.getByText("0")).toBeInTheDocument();
      expect(mockTransposeChordPro).toHaveBeenLastCalledWith("test", 11, undefined);
    });

    it("wraps transpose back to 0 after 12 downward clicks", () => {
      render(<ChordProRenderer content="test" />);
      for (let i = 0; i < 12; i++) {
        fireEvent.click(screen.getByText("−"));
      }
      expect(screen.getByText("0")).toBeInTheDocument();
      expect(mockTransposeChordPro).toHaveBeenLastCalledWith("test", -11, undefined);
    });
  });

  // ===================== IMPERATIVE HANDLE =====================

  describe("imperative handle (ref)", () => {
    it("exposes transposeUp method", () => {
      const ref = createRef<ChordProRendererHandle>();
      render(<ChordProRenderer ref={ref} content="test" />);
      act(() => ref.current!.transposeUp());
      expect(screen.getByText("+1")).toBeInTheDocument();
    });

    it("exposes transposeDown method", () => {
      const ref = createRef<ChordProRendererHandle>();
      render(<ChordProRenderer ref={ref} content="test" />);
      act(() => ref.current!.transposeDown());
      expect(mockTransposeChordPro).toHaveBeenCalledWith("test", -1, undefined);
    });

    it("exposes transposeReset method", () => {
      const ref = createRef<ChordProRendererHandle>();
      render(<ChordProRenderer ref={ref} content="test" />);
      act(() => ref.current!.transposeUp());
      act(() => ref.current!.transposeUp());
      act(() => ref.current!.transposeReset());
      expect(screen.getByText("0")).toBeInTheDocument();
    });
  });

  // ===================== NASHVILLE =====================

  describe("Nashville number display", () => {
    it("shows Nashville numbers when nashville=true and songKey provided", () => {
      render(<ChordProRenderer content="test" nashville={true} songKey="G" />);
      expect(mockChordToNashville).toHaveBeenCalledWith("G", "G");
      expect(mockChordToNashville).toHaveBeenCalledWith("C", "G");
    });

    it("shows original chords when nashville=false", () => {
      render(<ChordProRenderer content="test" nashville={false} />);
      expect(mockChordToNashville).not.toHaveBeenCalled();
      expect(screen.getAllByText("G").length).toBeGreaterThanOrEqual(1);
    });
  });

  // ===================== FONT SIZE =====================

  describe("fontSize prop", () => {
    it("applies custom font size to sections container", () => {
      const { container } = render(<ChordProRenderer content="test" fontSize={20} />);
      const styled = container.querySelector('[style*="font-size"]');
      expect(styled).toBeTruthy();
      expect(styled!.getAttribute("style")).toContain("20px");
    });

    it("defaults to 16px", () => {
      const { container } = render(<ChordProRenderer content="test" />);
      const styled = container.querySelector('[style*="font-size"]');
      expect(styled).toBeTruthy();
      expect(styled!.getAttribute("style")).toContain("16px");
    });

    it("uses the song display font class on the renderer root", () => {
      render(<ChordProRenderer content="test" />);
      expect(screen.getByTestId("chordpro-renderer").className).toContain("song-display-font");
    });
  });

  // ===================== SONG KEY =====================

  describe("songKey display", () => {
    it("shows original key when songKey provided", () => {
      render(<ChordProRenderer content="test" songKey="G" />);
      expect(screen.getByText(/Original key: G/)).toBeInTheDocument();
    });

    it("applies base transpose before rendering", () => {
      render(<ChordProRenderer content="test" songKey="G" baseTranspose={2} />);
      expect(mockTransposeChordPro).toHaveBeenCalledWith("test", 2, false);
      expect(screen.getByText("+2")).toBeInTheDocument();
    });

    it("does not show key indicator when songKey is null", () => {
      render(<ChordProRenderer content="test" />);
      expect(screen.queryByText(/Original key/)).not.toBeInTheDocument();
    });
  });

  // ===================== EMPTY CONTENT =====================

  describe("empty content", () => {
    it("handles empty content gracefully", () => {
      mockParseChordPro.mockReturnValue({
        directives: {},
        sections: [],
      });
      const { container } = render(<ChordProRenderer content="" />);
      expect(container.querySelector(".space-y-2")).toBeInTheDocument();
    });

    it("skips empty lines", () => {
      mockParseChordPro.mockReturnValue({
        directives: {},
        sections: [
          {
            name: "",
            lines: [{ chords: [], lyrics: "   " }],
          },
        ],
      });
      const { container } = render(<ChordProRenderer content="test" />);
      // ChordLine returns null for empty chords + blank lyrics
      const leadingRelaxed = container.querySelectorAll(".leading-relaxed");
      expect(leadingRelaxed.length).toBe(0);
    });

    it("renders chord and section semantic color classes", () => {
      const { container } = render(<ChordProRenderer content="test" />);
      expect(container.querySelector(".song-primary-chord")).toBeTruthy();
      expect(container.querySelector(".song-secondary-chord")).toBeTruthy();
    });
  });
});

// ===================== AutoScroll =====================

describe("AutoScroll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders Auto-scroll button", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <div>
        <div ref={ref} />
        <AutoScroll containerRef={ref} />
      </div>,
    );
    expect(screen.getByText("Auto-scroll")).toBeInTheDocument();
  });

  it("renders speed slider", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <div>
        <div ref={ref} />
        <AutoScroll containerRef={ref} />
      </div>,
    );
    expect(screen.getByText("Speed")).toBeInTheDocument();
    const slider = screen.getByRole("slider");
    expect(slider).toBeInTheDocument();
  });

  it("toggles button text on click", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <div>
        <div ref={ref} />
        <AutoScroll containerRef={ref} />
      </div>,
    );
    const btn = screen.getByText("Auto-scroll");
    fireEvent.click(btn);
    expect(screen.getByText("Stop")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Stop"));
    expect(screen.getByText("Auto-scroll")).toBeInTheDocument();
  });

  it("accepts defaultSpeed prop", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <div>
        <div ref={ref} />
        <AutoScroll containerRef={ref} defaultSpeed={50} />
      </div>,
    );
    const slider = screen.getByRole("slider") as HTMLInputElement;
    expect(slider.value).toBe("50");
  });

  it("changes speed via slider", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <div>
        <div ref={ref} />
        <AutoScroll containerRef={ref} />
      </div>,
    );
    const slider = screen.getByRole("slider") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "60" } });
    expect(slider.value).toBe("60");
  });
});
