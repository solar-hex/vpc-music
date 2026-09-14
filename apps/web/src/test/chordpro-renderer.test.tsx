import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChordProRenderer, AutoScroll, chartSections } from "@/components/songs/ChordProRenderer";
import { createRef } from "react";

// ---------- Mocks ----------
const mockParseChordPro = vi.fn();
const mockTransposeChordPro = vi.fn();
const mockChordToNashville = vi.fn();

vi.mock("@vpc-music/shared", () => ({
  spellForTarget: (key: string | null | undefined) =>
    key ? { preferFlats: false, targetKey: key } : { preferFlats: undefined, targetKey: null },
  parseBarLine: () => ({ measures: [] }),
  parseChordPro: (...args: any[]) => mockParseChordPro(...args),
  transposeChordPro: (...args: any[]) => mockTransposeChordPro(...args),
  chordToNashville: (...args: any[]) => mockChordToNashville(...args),
  isSecondaryToken: (token: string) => token.startsWith("*"),
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
    it("renders section names", () => {
      render(<ChordProRenderer content="{sov:Verse 1}" />);
      expect(screen.getByText("Verse 1")).toBeInTheDocument();
      expect(screen.getByText("Chorus")).toBeInTheDocument();
    });

    it("does not render title or artist directives (the host page owns the title block)", () => {
      render(<ChordProRenderer content="{t:Amazing Grace}" />);
      expect(screen.queryByText("Amazing Grace")).not.toBeInTheDocument();
      expect(screen.queryByText("John Newton")).not.toBeInTheDocument();
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
        sections: [{ name: "", lines: [{ chords: [{ chord: "G", position: 0 }], lyrics: "Just lyrics" }] }],
      });
      render(<ChordProRenderer content="test" showChords={false} />);
      expect(screen.queryByText("G")).not.toBeInTheDocument();
      expect(screen.getByText("Just lyrics")).toBeInTheDocument();
    });

    it("renders no controls of its own", () => {
      render(<ChordProRenderer content="test" songKey="G" />);
      expect(screen.queryByText("Transpose:")).not.toBeInTheDocument();
      expect(screen.queryByText(/Capo/)).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("gives every section an id a jump bar can scroll to", () => {
      const { container } = render(<ChordProRenderer content="test" />);
      expect(container.querySelector("#section-0")).toHaveTextContent("Verse 1");
      expect(container.querySelector("#section-1")).toHaveTextContent("Chorus");
    });
  });

  // ===================== TRANSPOSE PROP =====================

  describe("transpose prop", () => {
    it("does not call transposeChordPro when transpose is 0", () => {
      render(<ChordProRenderer content="test" />);
      expect(mockTransposeChordPro).not.toHaveBeenCalled();
      expect(mockParseChordPro).toHaveBeenCalledWith("test");
    });

    it("transposes the source then parses the result", () => {
      mockTransposeChordPro.mockReturnValue("transposed-content");
      render(<ChordProRenderer content="test" songKey="G" transpose={2} />);
      expect(mockTransposeChordPro).toHaveBeenCalledWith("test", 2, false);
      expect(mockParseChordPro).toHaveBeenCalledWith("transposed-content");
    });

    it("normalizes shifts to within an octave", () => {
      render(<ChordProRenderer content="test" transpose={14} />);
      expect(mockTransposeChordPro).toHaveBeenCalledWith("test", 2, undefined);
    });

    it("treats a full octave as no transposition", () => {
      render(<ChordProRenderer content="test" transpose={12} />);
      expect(mockTransposeChordPro).not.toHaveBeenCalled();
    });
  });

  // ===================== SECONDARY CHORDS AND NOTES =====================

  describe("secondary chords and note lines", () => {
    it("renders [*x] tokens as a separate row above the primary chords, without the marker", () => {
      mockParseChordPro.mockReturnValue({
        directives: {},
        sections: [
          {
            name: "Chorus",
            lines: [
              {
                chords: [
                  { chord: "*ab", position: 3 },
                  { chord: "E", position: 3 },
                  { chord: "*gb", position: 10 },
                  { chord: "B", position: 10 },
                ],
                lyrics: "He is the Truth",
              },
            ],
          },
        ],
      });
      render(<ChordProRenderer content="test" songKey="E" nashville />);
      const secondaryRow = screen.getByTestId("secondary-chord-row");
      expect(secondaryRow).toHaveTextContent("ab");
      expect(secondaryRow).toHaveTextContent("gb");
      expect(secondaryRow.textContent).not.toContain("*");
      // Nashville numbers apply to primary chords only
      expect(mockChordToNashville).toHaveBeenCalledWith("E", "E");
      expect(mockChordToNashville).not.toHaveBeenCalledWith("*ab", "E");
    });

    it("renders {ci} note lines in italics and hides them when showComments is false", () => {
      mockParseChordPro.mockReturnValue({
        directives: {},
        sections: [{ name: "Verse", lines: [{ chords: [], lyrics: "", note: "staccato chords" }, { chords: [], lyrics: "La la" }] }],
      });
      const { rerender } = render(<ChordProRenderer content="test" />);
      expect(screen.getByText("staccato chords")).toHaveClass("italic");
      rerender(<ChordProRenderer content="test" showComments={false} />);
      expect(screen.queryByText("staccato chords")).not.toBeInTheDocument();
      expect(screen.getByText("La la")).toBeInTheDocument();
    });

    it("keeps lyric lines unwrapped when wrap is false", () => {
      render(<ChordProRenderer content="test" wrap={false} />);
      expect(screen.getByText("Amazing grace how sweet the sound").className).toContain("whitespace-pre");
      expect(screen.getByText("Amazing grace how sweet the sound").className).not.toContain("whitespace-pre-wrap");
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


  });

  // ===================== CHORD TAP =====================

  describe("onChordTap", () => {
    it("renders chords as buttons that report the raw chord", () => {
      const onChordTap = vi.fn();
      render(<ChordProRenderer content="test" onChordTap={onChordTap} />);
      fireEvent.click(screen.getByTitle("Show C chord diagram"));
      expect(onChordTap).toHaveBeenCalledWith("C");
    });
  });

  // ===================== EMPTY CONTENT =====================

  describe("empty content", () => {
    it("handles empty content gracefully", () => {
      mockParseChordPro.mockReturnValue({ directives: {}, sections: [] });
      render(<ChordProRenderer content="" />);
      expect(screen.getByTestId("chordpro-renderer")).toBeInTheDocument();
    });

    it("skips empty lines", () => {
      mockParseChordPro.mockReturnValue({
        directives: {},
        sections: [{ name: "", lines: [{ chords: [], lyrics: "   " }] }],
      });
      const { container } = render(<ChordProRenderer content="test" />);
      // ChordLine returns null for empty chords + blank lyrics
      expect(container.querySelectorAll(".leading-relaxed").length).toBe(0);
    });

    it("renders chords in the chord colour", () => {
      const { container } = render(<ChordProRenderer content="test" />);
      expect(container.querySelector(".song-primary-chord")).toBeTruthy();
    });

    it("never styles a section name like a secondary chord", () => {
      // They shared a colour, and "Chorus" was hard to tell from a purple `ab`.
      mockParseChordPro.mockReturnValue({
        directives: {},
        sections: [
          {
            name: "Chorus",
            lines: [{ chords: [{ chord: "*ab", position: 0 }, { chord: "E", position: 0 }], lyrics: "He is" }],
          },
        ],
      });
      const { container } = render(<ChordProRenderer content="test" />);
      const name = screen.getByText("Chorus");
      expect(name).toHaveClass("chart-section-name");
      expect(name).not.toHaveClass("song-secondary-chord");
      expect(name.closest(".song-secondary-chord")).toBeNull();
      expect(container.querySelector("[data-testid='secondary-chord-row']")).toHaveClass("song-secondary-chord");
    });
  });
});

describe("chartSections", () => {
  it("lists named sections with the ids the renderer uses", () => {
    mockParseChordPro.mockReturnValue({
      directives: {},
      sections: [{ name: "Intro", lines: [] }, { name: "", lines: [] }, { name: "Chorus", lines: [] }],
    });
    expect(chartSections("x")).toEqual([
      { id: "section-0", label: "Intro" },
      { id: "section-2", label: "Chorus" },
    ]);
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
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });

  it("toggles button text on click", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <div>
        <div ref={ref} />
        <AutoScroll containerRef={ref} />
      </div>,
    );
    fireEvent.click(screen.getByText("Auto-scroll"));
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
    expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("50");
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
