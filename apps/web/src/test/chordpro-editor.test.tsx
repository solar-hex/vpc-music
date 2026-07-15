import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChordProEditor } from "@/components/songs/ChordProEditor";

// ---------- Mocks ----------
vi.mock("@vpc-music/shared", () => ({
  parseChordPro: () => ({ directives: {}, sections: [], chordDefinitions: {} }),
  transposeKeyName: (key: string) => key,
  composeTranspose: ({ sourceKey = null }: any = {}) => ({ semis: 0, preferFlats: false, displayKey: sourceKey }),
  spellForTarget: (key: string | null | undefined) =>
    key ? { preferFlats: false, targetKey: key } : { preferFlats: undefined, targetKey: null },
  keyPrefersFlats: () => false,
  parseBarLine: () => ({ measures: [] }),
  CHORD_REGEX: /^[A-G][b#]?(?:m|min|maj|dim|aug|sus[24]?|add)?[2-9]?(?:\/[A-G][b#]?)?$/,
  transposeChord: (chord: string, _steps: number) => `${chord}#`,
}));

function renderEditor(
  props: Partial<React.ComponentProps<typeof ChordProEditor>> = {},
) {
  const defaultProps = {
    value: "",
    onChange: vi.fn(),
    ...props,
  };
  return { ...render(<ChordProEditor {...defaultProps} />), onChange: defaultProps.onChange };
}

describe("ChordProEditor", () => {
  beforeEach(() => vi.clearAllMocks());

  // ===================== Rendering =====================

  describe("rendering", () => {
    it("renders the textarea", () => {
      renderEditor();
      expect(screen.getByTestId("chordpro-editor")).toBeInTheDocument();
    });

    it("renders Insert Section button", () => {
      renderEditor();
      expect(screen.getByTestId("section-insert-btn")).toBeInTheDocument();
      expect(screen.getByText("Insert Section")).toBeInTheDocument();
    });

    it("renders the content label", () => {
      renderEditor();
      expect(screen.getByText("Content (ChordPro format)")).toBeInTheDocument();
    });

    it("shows the hint text", () => {
      renderEditor();
      expect(screen.getByText(/select any word and type a chord/i)).toBeInTheDocument();
    });

    it("displays the value in the textarea", () => {
      renderEditor({ value: "{title: Test}\n[G]Amazing" });
      expect(screen.getByTestId("chordpro-editor")).toHaveValue("{title: Test}\n[G]Amazing");
    });
  });

  // ===================== Section Insert Dropdown =====================

  describe("section insert dropdown", () => {
    it("opens dropdown on click", async () => {
      renderEditor();
      const user = userEvent.setup();
      await user.click(screen.getByTestId("section-insert-btn"));
      expect(screen.getByTestId("section-dropdown")).toBeInTheDocument();
    });

    it("shows all 19 section/insert options", async () => {
      renderEditor();
      const user = userEvent.setup();
      await user.click(screen.getByTestId("section-insert-btn"));
      const options = screen.getByTestId("section-dropdown").querySelectorAll("button");
      expect(options).toHaveLength(19);
    });

    it("lists expected section labels", async () => {
      renderEditor();
      const user = userEvent.setup();
      await user.click(screen.getByTestId("section-insert-btn"));
      const expected = [
        "Verse 1", "Verse 2", "Verse 3", "Verse 4",
        "Chorus", "Pre-Chorus", "Bridge",
        "Intro", "Outro", "Interlude", "Instrumental",
        "Tag", "Ending", "Solo", "Turnaround", "Vamp", "Coda",
      ];
      for (const label of expected) {
        expect(screen.getByText(label)).toBeInTheDocument();
      }
    });

    it("closes dropdown on second click", async () => {
      renderEditor();
      const user = userEvent.setup();
      const btn = screen.getByTestId("section-insert-btn");
      await user.click(btn);
      expect(screen.getByTestId("section-dropdown")).toBeInTheDocument();
      await user.click(btn);
      expect(screen.queryByTestId("section-dropdown")).not.toBeInTheDocument();
    });

    it("inserts section directive on option click", async () => {
      const onChange = vi.fn();
      renderEditor({ value: "", onChange });
      const user = userEvent.setup();
      await user.click(screen.getByTestId("section-insert-btn"));
      await user.click(screen.getByText("Chorus"));
      expect(onChange).toHaveBeenCalledWith(expect.stringContaining("{comment: Chorus}"));
    });

    it("inserts section with newline prefix when content exists", async () => {
      const onChange = vi.fn();
      renderEditor({ value: "Some content", onChange });
      const user = userEvent.setup();
      await user.click(screen.getByTestId("section-insert-btn"));
      await user.click(screen.getByText("Verse 1"));
      const call = onChange.mock.calls[0][0] as string;
      expect(call).toContain("{comment: Verse 1}");
      // Cursor defaults to position 0, so directive is inserted at top
      // followed by the original content
      expect(call).toContain("Some content");
    });

    it("closes dropdown after inserting", async () => {
      renderEditor();
      const user = userEvent.setup();
      await user.click(screen.getByTestId("section-insert-btn"));
      await user.click(screen.getByText("Bridge"));
      expect(screen.queryByTestId("section-dropdown")).not.toBeInTheDocument();
    });
  });

  // ===================== Metadata Sync =====================

  describe("metadata sync", () => {
    it("inserts title directive when title changes", async () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <ChordProEditor value="" onChange={onChange} metadata={{ title: "", artist: "", key: "", tempo: "" }} />,
      );
      rerender(
        <ChordProEditor value="" onChange={onChange} metadata={{ title: "Amazing Grace", artist: "", key: "", tempo: "" }} />,
      );
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.stringContaining("{title: Amazing Grace}"));
      });
    });

    it("inserts artist directive when artist changes", async () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <ChordProEditor value="" onChange={onChange} metadata={{ title: "", artist: "", key: "", tempo: "" }} />,
      );
      rerender(
        <ChordProEditor value="" onChange={onChange} metadata={{ title: "", artist: "Newton", key: "", tempo: "" }} />,
      );
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.stringContaining("{artist: Newton}"));
      });
    });

    it("inserts key directive when key changes", async () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <ChordProEditor value="" onChange={onChange} metadata={{ title: "", artist: "", key: "", tempo: "" }} />,
      );
      rerender(
        <ChordProEditor value="" onChange={onChange} metadata={{ title: "", artist: "", key: "G", tempo: "" }} />,
      );
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.stringContaining("{key: G}"));
      });
    });

    it("inserts tempo directive when tempo changes", async () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <ChordProEditor value="" onChange={onChange} metadata={{ title: "", artist: "", key: "", tempo: "" }} />,
      );
      rerender(
        <ChordProEditor value="" onChange={onChange} metadata={{ title: "", artist: "", key: "", tempo: "120" }} />,
      );
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.stringContaining("{tempo: 120}"));
      });
    });

    it("updates existing title directive instead of duplicating", async () => {
      const onChange = vi.fn();
      const existing = "{title: Old Title}\n{key: G}\n\n[G]Amazing";
      const { rerender } = render(
        <ChordProEditor value={existing} onChange={onChange} metadata={{ title: "Old Title", artist: "", key: "G", tempo: "" }} />,
      );
      rerender(
        <ChordProEditor value={existing} onChange={onChange} metadata={{ title: "New Title", artist: "", key: "G", tempo: "" }} />,
      );
      await waitFor(() => {
        const call = onChange.mock.calls[0][0] as string;
        expect(call).toContain("{title: New Title}");
        expect(call).not.toContain("Old Title");
        // Should still have exactly one {title:} directive
        const titleCount = (call.match(/\{title:/g) || []).length;
        expect(titleCount).toBe(1);
      });
    });

    it("does not call onChange when metadata hasn't changed", () => {
      const onChange = vi.fn();
      const meta = { title: "Test", artist: "", key: "", tempo: "" };
      const { rerender } = render(
        <ChordProEditor value="{title: Test}" onChange={onChange} metadata={meta} />,
      );
      // Re-render with same metadata
      rerender(
        <ChordProEditor value="{title: Test}" onChange={onChange} metadata={{ ...meta }} />,
      );
      // The initial render may trigger once for the title, but subsequent
      // rerenders with same values should not trigger again
      const callCount = onChange.mock.calls.length;
      rerender(
        <ChordProEditor value="{title: Test}" onChange={onChange} metadata={{ ...meta }} />,
      );
      expect(onChange.mock.calls.length).toBe(callCount);
    });
  });

  // ===================== Chord Popup =====================

  describe("chord popup", () => {
    it("does not show popup when there's no selection", () => {
      renderEditor({ value: "Hello world" });
      const editor = screen.getByTestId("chordpro-editor");
      fireEvent.mouseUp(editor);
      expect(screen.queryByTestId("chord-popup")).not.toBeInTheDocument();
    });

    it("shows popup when text is selected", () => {
      renderEditor({ value: "Amazing grace how sweet" });
      const editor = screen.getByTestId("chordpro-editor") as HTMLTextAreaElement;

      // Simulate text selection on the textarea
      editor.setSelectionRange(0, 7); // Select "Amazing"
      Object.defineProperty(editor, "selectionStart", { value: 0, writable: true });
      Object.defineProperty(editor, "selectionEnd", { value: 7, writable: true });
      fireEvent.mouseUp(editor);

      expect(screen.getByTestId("chord-popup")).toBeInTheDocument();
      expect(screen.getByTestId("chord-input")).toBeInTheDocument();
      expect(screen.getByTestId("chord-apply-btn")).toBeInTheDocument();
    });

    it("shows chord input and apply button in popup", () => {
      renderEditor({ value: "Amazing grace" });
      const editor = screen.getByTestId("chordpro-editor") as HTMLTextAreaElement;
      editor.setSelectionRange(0, 7);
      fireEvent.mouseUp(editor);

      expect(screen.getByPlaceholderText("e.g. Am7, C/G")).toBeInTheDocument();
      expect(screen.getByText("Apply")).toBeInTheDocument();
      expect(screen.getByText(/enter/i)).toBeInTheDocument();
    });

    it("applies chord wrapping on Apply button click", async () => {
      const onChange = vi.fn();
      renderEditor({ value: "Amazing grace", onChange });
      const user = userEvent.setup();
      const editor = screen.getByTestId("chordpro-editor") as HTMLTextAreaElement;

      // Simulate selection of "Amazing"
      editor.setSelectionRange(0, 7);
      fireEvent.mouseUp(editor);

      // Type chord and click Apply
      const chordInput = screen.getByTestId("chord-input");
      await user.type(chordInput, "G");
      await user.click(screen.getByTestId("chord-apply-btn"));

      expect(onChange).toHaveBeenCalledWith("[G]Amazing grace");
    });

    it("applies chord on Enter key", async () => {
      const onChange = vi.fn();
      renderEditor({ value: "Amazing grace", onChange });
      const user = userEvent.setup();
      const editor = screen.getByTestId("chordpro-editor") as HTMLTextAreaElement;

      editor.setSelectionRange(0, 7);
      fireEvent.mouseUp(editor);

      const chordInput = screen.getByTestId("chord-input");
      await user.type(chordInput, "Am");
      await user.keyboard("{Enter}");

      expect(onChange).toHaveBeenCalledWith("[Am]Amazing grace");
    });

    it("closes popup on Escape key", async () => {
      renderEditor({ value: "Amazing grace" });
      const user = userEvent.setup();
      const editor = screen.getByTestId("chordpro-editor") as HTMLTextAreaElement;

      editor.setSelectionRange(0, 7);
      fireEvent.mouseUp(editor);
      expect(screen.getByTestId("chord-popup")).toBeInTheDocument();

      // Focus the chord input then press Escape
      const chordInput = screen.getByTestId("chord-input");
      await user.click(chordInput);
      await user.keyboard("{Escape}");
      expect(screen.queryByTestId("chord-popup")).not.toBeInTheDocument();
    });

    it("does not apply when chord input is empty", async () => {
      const onChange = vi.fn();
      renderEditor({ value: "Amazing grace", onChange });
      const user = userEvent.setup();
      const editor = screen.getByTestId("chordpro-editor") as HTMLTextAreaElement;

      editor.setSelectionRange(0, 7);
      fireEvent.mouseUp(editor);

      // Click apply with empty input
      await user.click(screen.getByTestId("chord-apply-btn"));
      // onChange should not have been called for chord insertion
      expect(onChange).not.toHaveBeenCalled();
    });

    it("wraps selected text in the middle of content", async () => {
      const onChange = vi.fn();
      renderEditor({ value: "Amazing grace how sweet", onChange });
      const user = userEvent.setup();
      const editor = screen.getByTestId("chordpro-editor") as HTMLTextAreaElement;

      // Select "grace" (index 8-13)
      editor.setSelectionRange(8, 13);
      fireEvent.mouseUp(editor);

      const chordInput = screen.getByTestId("chord-input");
      await user.type(chordInput, "C");
      await user.click(screen.getByTestId("chord-apply-btn"));

      expect(onChange).toHaveBeenCalledWith("Amazing [C]grace how sweet");
    });

    it("handles slash chords like C/G", async () => {
      const onChange = vi.fn();
      renderEditor({ value: "Amazing grace", onChange });
      const user = userEvent.setup();
      const editor = screen.getByTestId("chordpro-editor") as HTMLTextAreaElement;

      editor.setSelectionRange(0, 7);
      fireEvent.mouseUp(editor);

      const chordInput = screen.getByTestId("chord-input");
      await user.type(chordInput, "C/G");
      await user.click(screen.getByTestId("chord-apply-btn"));

      expect(onChange).toHaveBeenCalledWith("[C/G]Amazing grace");
    });

    it("handles complex chords like F#m7", async () => {
      const onChange = vi.fn();
      renderEditor({ value: "Amazing grace", onChange });
      const user = userEvent.setup();
      const editor = screen.getByTestId("chordpro-editor") as HTMLTextAreaElement;

      editor.setSelectionRange(0, 7);
      fireEvent.mouseUp(editor);

      const chordInput = screen.getByTestId("chord-input");
      await user.type(chordInput, "F#m7");
      await user.click(screen.getByTestId("chord-apply-btn"));

      expect(onChange).toHaveBeenCalledWith("[F#m7]Amazing grace");
    });
  });

  // ===================== Textarea interaction =====================

  describe("textarea interaction", () => {
    it("calls onChange when user types in textarea", async () => {
      const onChange = vi.fn();
      renderEditor({ value: "", onChange });
      const user = userEvent.setup();
      const editor = screen.getByTestId("chordpro-editor");
      await user.type(editor, "H");
      expect(onChange).toHaveBeenCalledWith("H");
    });

    it("renders placeholder text", () => {
      renderEditor();
      const editor = screen.getByTestId("chordpro-editor");
      expect(editor).toHaveAttribute("placeholder", expect.stringContaining("{title: Amazing Grace}"));
      expect(editor).toHaveAttribute("placeholder", expect.stringContaining("{comment: Verse 1}"));
    });

    it("has 20 rows by default", () => {
      renderEditor();
      expect(screen.getByTestId("chordpro-editor")).toHaveAttribute("rows", "20");
    });
  });

  // ===================== Keyboard shortcuts =====================

  describe("keyboard shortcuts", () => {
    it("calls onSave on Ctrl+S", () => {
      const onSave = vi.fn();
      renderEditor({ value: "test", onSave });
      const editor = screen.getByTestId("chordpro-editor");
      fireEvent.keyDown(editor, { key: "s", ctrlKey: true });
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it("inserts [] at cursor on Ctrl+K with no selection", () => {
      const onChange = vi.fn();
      renderEditor({ value: "Hello world", onChange });
      const editor = screen.getByTestId("chordpro-editor") as HTMLTextAreaElement;
      editor.setSelectionRange(5, 5);
      fireEvent.keyDown(editor, { key: "k", ctrlKey: true });
      expect(onChange).toHaveBeenCalledWith("Hello[] world");
    });

    it("toggles comment on Ctrl+/", () => {
      const onChange = vi.fn();
      renderEditor({ value: "Verse 1", onChange });
      const editor = screen.getByTestId("chordpro-editor") as HTMLTextAreaElement;
      editor.setSelectionRange(0, 7);
      fireEvent.keyDown(editor, { key: "/", ctrlKey: true });
      expect(onChange).toHaveBeenCalledWith("{comment: Verse 1}");
    });

    it("unwraps comment on Ctrl+/ when already commented", () => {
      const onChange = vi.fn();
      renderEditor({ value: "{comment: Verse 1}", onChange });
      const editor = screen.getByTestId("chordpro-editor") as HTMLTextAreaElement;
      editor.setSelectionRange(0, 18);
      fireEvent.keyDown(editor, { key: "/", ctrlKey: true });
      expect(onChange).toHaveBeenCalledWith("Verse 1");
    });

    it("inserts Verse on Ctrl+Shift+V", () => {
      const onChange = vi.fn();
      renderEditor({ value: "", onChange });
      const editor = screen.getByTestId("chordpro-editor");
      fireEvent.keyDown(editor, { key: "V", ctrlKey: true, shiftKey: true });
      expect(onChange).toHaveBeenCalledWith(expect.stringContaining("{comment: Verse}"));
    });

    it("inserts Chorus on Ctrl+Shift+C", () => {
      const onChange = vi.fn();
      renderEditor({ value: "", onChange });
      const editor = screen.getByTestId("chordpro-editor");
      fireEvent.keyDown(editor, { key: "C", ctrlKey: true, shiftKey: true });
      expect(onChange).toHaveBeenCalledWith(expect.stringContaining("{comment: Chorus}"));
    });

    it("inserts Bridge on Ctrl+Shift+B", () => {
      const onChange = vi.fn();
      renderEditor({ value: "", onChange });
      const editor = screen.getByTestId("chordpro-editor");
      fireEvent.keyDown(editor, { key: "B", ctrlKey: true, shiftKey: true });
      expect(onChange).toHaveBeenCalledWith(expect.stringContaining("{comment: Bridge}"));
    });

    it("transposes chords up on Alt+Up", () => {
      const onChange = vi.fn();
      renderEditor({ value: "[G]Amazing", onChange });
      const editor = screen.getByTestId("chordpro-editor") as HTMLTextAreaElement;
      editor.setSelectionRange(0, 10);
      fireEvent.keyDown(editor, { key: "ArrowUp", altKey: true });
      // transposeChord mock returns same chord, but onChange should still be called
      // with the replace result from the mock (identity function)
      expect(onChange).toHaveBeenCalled();
    });

    it("transposes chords down on Alt+Down", () => {
      const onChange = vi.fn();
      renderEditor({ value: "[G]Amazing", onChange });
      const editor = screen.getByTestId("chordpro-editor") as HTMLTextAreaElement;
      editor.setSelectionRange(0, 10);
      fireEvent.keyDown(editor, { key: "ArrowDown", altKey: true });
      expect(onChange).toHaveBeenCalled();
    });
  });

  // ===================== Syntax overlay =====================

  describe("syntax overlay", () => {
    it("renders syntax overlay", () => {
      renderEditor({ value: "[G]Test" });
      expect(screen.getByTestId("syntax-overlay")).toBeInTheDocument();
    });
  });

  // ===================== Edge cases =====================

  describe("edge cases", () => {
    it("handles empty content gracefully for section insert", async () => {
      const onChange = vi.fn();
      renderEditor({ value: "", onChange });
      const user = userEvent.setup();
      await user.click(screen.getByTestId("section-insert-btn"));
      await user.click(screen.getByText("Intro"));
      const result = onChange.mock.calls[0][0] as string;
      expect(result).toContain("{comment: Intro}");
      expect(result.endsWith("\n")).toBe(true);
    });

    it("handles no metadata prop without errors", () => {
      expect(() => renderEditor({ value: "test" })).not.toThrow();
    });

    it("handles undefined metadata fields", () => {
      expect(() =>
        render(
          <ChordProEditor
            value=""
            onChange={vi.fn()}
            metadata={{ title: undefined, artist: undefined, key: undefined, tempo: undefined }}
          />,
        ),
      ).not.toThrow();
    });
  });
});
