import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChordProEditor } from "@/components/songs/ChordProEditor";

// ---------- Mocks ----------
vi.mock("@vpc-music/shared", () => ({
  transposeKeyName: (key: string) => key,
  composeTranspose: ({ sourceKey = null }: any = {}) => ({ semis: 0, preferFlats: false, displayKey: sourceKey }),
  spellForTarget: (key: string | null | undefined) =>
    key ? { preferFlats: false, targetKey: key } : { preferFlats: undefined, targetKey: null },
  keyPrefersFlats: () => false,
  parseBarLine: () => ({ measures: [] }),
  CHORD_REGEX: /^[A-G][b#]?(?:m|min|maj|dim|aug|sus[24]?|add)?[2-9]?(?:\/[A-G][b#]?)?$/,
  transposeChord: (chord: string, _steps: number) => `${chord}#`,
  parseChordPro: (content: string) => ({
    directives: { title: "Test" },
    sections: [{ name: "", lines: [{ chords: [], lyrics: content.slice(0, 50) }] }],
  }),
  transposeChordPro: (content: string) => content,
  chordToNashville: (chord: string) => chord,
}));

function renderEditor(
  props: Partial<React.ComponentProps<typeof ChordProEditor>> = {},
) {
  const defaultProps = {
    value: "{title: Test}\n{key: G}\n\n{comment: Verse 1}\n[G]Amazing grace\n\n{comment: Chorus}\n[C]How sweet",
    onChange: vi.fn(),
    ...props,
  };
  return { ...render(<ChordProEditor {...defaultProps} />), onChange: defaultProps.onChange };
}

describe("ChordProEditor — Phase 2 features", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ═══════ Split Preview ═══════

  describe("split preview", () => {
    it("renders view mode toggle buttons", () => {
      renderEditor();
      expect(screen.getByTestId("view-mode-toggle")).toBeInTheDocument();
      expect(screen.getByTestId("view-mode-edit")).toBeInTheDocument();
      expect(screen.getByTestId("view-mode-split")).toBeInTheDocument();
      expect(screen.getByTestId("view-mode-preview")).toBeInTheDocument();
    });

    it("defaults to edit mode — editor visible, preview hidden", () => {
      renderEditor();
      expect(screen.getByTestId("chordpro-editor")).toBeInTheDocument();
      expect(screen.queryByTestId("split-preview-pane")).not.toBeInTheDocument();
    });

    it("shows preview pane in split mode", async () => {
      renderEditor();
      const user = userEvent.setup();
      await user.click(screen.getByTestId("view-mode-split"));
      expect(screen.getByTestId("chordpro-editor")).toBeInTheDocument();
      expect(screen.getByTestId("split-preview-pane")).toBeInTheDocument();
    });

    it("hides editor in preview mode", async () => {
      renderEditor();
      const user = userEvent.setup();
      await user.click(screen.getByTestId("view-mode-preview"));
      expect(screen.queryByTestId("chordpro-editor")).not.toBeInTheDocument();
      expect(screen.getByTestId("split-preview-pane")).toBeInTheDocument();
    });

    it("shows empty state when no content in preview", async () => {
      renderEditor({ value: "" });
      const user = userEvent.setup();
      await user.click(screen.getByTestId("view-mode-preview"));
      expect(screen.getByText(/start typing in the editor/i)).toBeInTheDocument();
    });

    it("hides insert section button in preview mode", async () => {
      renderEditor();
      const user = userEvent.setup();
      await user.click(screen.getByTestId("view-mode-preview"));
      expect(screen.queryByTestId("section-insert-btn")).not.toBeInTheDocument();
    });

    it("hides hint text in preview mode", async () => {
      renderEditor();
      const user = userEvent.setup();
      await user.click(screen.getByTestId("view-mode-preview"));
      expect(screen.queryByText(/select any word and type a chord/i)).not.toBeInTheDocument();
    });

    it("restores editor when switching back to edit mode", async () => {
      renderEditor();
      const user = userEvent.setup();
      await user.click(screen.getByTestId("view-mode-preview"));
      expect(screen.queryByTestId("chordpro-editor")).not.toBeInTheDocument();
      await user.click(screen.getByTestId("view-mode-edit"));
      expect(screen.getByTestId("chordpro-editor")).toBeInTheDocument();
    });
  });

  // ═══════ Line Numbers ═══════

  describe("line numbers", () => {
    it("renders line number gutter", () => {
      renderEditor();
      expect(screen.getByTestId("line-number-gutter")).toBeInTheDocument();
    });

    it("shows correct number of lines", () => {
      const content = "Line 1\nLine 2\nLine 3";
      renderEditor({ value: content });
      const gutter = screen.getByTestId("line-number-gutter");
      // Should have 3 line numbers
      expect(gutter.textContent).toContain("1");
      expect(gutter.textContent).toContain("2");
      expect(gutter.textContent).toContain("3");
    });

    it("renders current line highlight", () => {
      renderEditor();
      expect(screen.getByTestId("current-line-highlight")).toBeInTheDocument();
    });
  });

  // ═══════ Section Navigation ═══════

  describe("section navigation", () => {
    it("renders section nav button when sections exist", () => {
      renderEditor();
      expect(screen.getByTestId("section-nav-btn")).toBeInTheDocument();
    });

    it("shows Go to Section text", () => {
      renderEditor();
      expect(screen.getByText("Go to Section")).toBeInTheDocument();
    });

    it("renders quick-access section chips", () => {
      renderEditor();
      expect(screen.getByTestId("section-chip-bar")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /jump to section verse 1/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /jump to section chorus/i })).toBeInTheDocument();
    });

    it("opens section navigation dropdown", async () => {
      renderEditor();
      const user = userEvent.setup();
      await user.click(screen.getByTestId("section-nav-btn"));
      expect(screen.getByTestId("section-nav-dropdown")).toBeInTheDocument();
    });

    it("lists detected sections", async () => {
      renderEditor();
      const user = userEvent.setup();
      await user.click(screen.getByTestId("section-nav-btn"));
      expect(screen.getAllByText("Verse 1").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Chorus").length).toBeGreaterThanOrEqual(1);
    });

    it("shows line numbers for sections", async () => {
      renderEditor();
      const user = userEvent.setup();
      await user.click(screen.getByTestId("section-nav-btn"));
      // Line numbers displayed as "Ln N"
      const lineLabels = screen.getAllByText(/Ln \d+/);
      expect(lineLabels.length).toBeGreaterThanOrEqual(2);
    });

    it("does not render nav button when no sections", () => {
      renderEditor({ value: "{title: Test}\nJust lyrics" });
      expect(screen.queryByTestId("section-nav-btn")).not.toBeInTheDocument();
    });

    it("renders the structured section organizer", () => {
      renderEditor();
      expect(screen.getByTestId("section-organizer")).toBeInTheDocument();
      expect(screen.getAllByTestId("section-organizer-item").length).toBeGreaterThanOrEqual(2);
    });

    it("duplicates sections from the organizer", async () => {
      const onChange = vi.fn();
      renderEditor({ onChange });
      const user = userEvent.setup();
      await user.click(screen.getAllByRole("button", { name: /duplicate/i })[0]);
      expect(onChange).toHaveBeenCalled();
      expect((onChange.mock.calls[0][0] as string)).toContain("{comment: Verse 2}");
    });

    it("reorders sections from the organizer with drag and drop", () => {
      const onChange = vi.fn();
      renderEditor({ onChange });
      const items = screen.getAllByTestId("section-organizer-item");
      fireEvent.dragStart(items[0]);
      fireEvent.dragOver(items[1]);
      fireEvent.drop(items[1]);
      expect(onChange).toHaveBeenCalled();
      const nextValue = onChange.mock.calls[0][0] as string;
      expect(nextValue.indexOf("{comment: Chorus}")).toBeLessThan(nextValue.indexOf("{comment: Verse 1}"));
    });

    it("collapses sections into a folded read-only editor view", async () => {
      renderEditor();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /collapse verse 1/i }));
      expect(screen.getByTestId("collapsed-sections-banner")).toBeInTheDocument();
      expect(screen.getByTestId("chordpro-editor")).toHaveAttribute("readonly");
      expect((screen.getByTestId("chordpro-editor") as HTMLTextAreaElement).value).toContain("… 2 lines hidden …");
    });
  });

  // ═══════ Format Button ═══════

  describe("format button", () => {
    it("renders format button", () => {
      renderEditor();
      expect(screen.getByTestId("format-btn")).toBeInTheDocument();
    });

    it("calls onChange with formatted content on click", async () => {
      const onChange = vi.fn();
      renderEditor({ value: "{ title :  Test }\n{ key : G}\n\n\n\n{comment: Verse}\n", onChange });
      const user = userEvent.setup();
      await user.click(screen.getByTestId("format-btn"));
      expect(onChange).toHaveBeenCalled();
      const formatted = onChange.mock.calls[0][0] as string;
      expect(formatted).toContain("{title: Test}");
      expect(formatted).toContain("{key: G}");
    });

    it("renders format on save checkbox", () => {
      renderEditor();
      expect(screen.getByTestId("format-on-save-checkbox")).toBeInTheDocument();
    });

    it("toggles format on save", async () => {
      renderEditor();
      const user = userEvent.setup();
      const checkbox = screen.getByTestId("format-on-save-checkbox") as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
      await user.click(checkbox);
      expect(checkbox.checked).toBe(true);
    });

    it("hides format button in preview mode", async () => {
      renderEditor();
      const user = userEvent.setup();
      await user.click(screen.getByTestId("view-mode-preview"));
      expect(screen.queryByTestId("format-btn")).not.toBeInTheDocument();
    });

    it("formats with Ctrl+Shift+F keyboard shortcut", () => {
      const onChange = vi.fn();
      renderEditor({ value: "{ title : Test }", onChange });
      fireEvent.keyDown(screen.getByTestId("chordpro-editor"), { key: "F", ctrlKey: true, shiftKey: true });
      expect(onChange).toHaveBeenCalled();
    });
  });

  // ═══════ Command Palette Trigger ═══════

  describe("command palette trigger", () => {
    it("renders hint about Ctrl+Space", () => {
      renderEditor();
      expect(screen.getAllByText(/ctrl\+space/i).length).toBeGreaterThanOrEqual(1);
    });

    it("renders hint about slash commands", () => {
      renderEditor();
      expect(screen.getAllByText(/slash commands/i).length).toBeGreaterThanOrEqual(1);
    });

    it("opens help with F1", () => {
      renderEditor();
      expect(screen.queryByTestId("help-content")).not.toBeInTheDocument();
      fireEvent.keyDown(screen.getByTestId("chordpro-editor"), { key: "F1" });
      expect(screen.getByTestId("help-content")).toBeInTheDocument();
    });

    it("opens section navigation with Ctrl+P", () => {
      renderEditor();
      fireEvent.keyDown(screen.getByTestId("chordpro-editor"), { key: "p", ctrlKey: true });
      expect(screen.getByTestId("section-nav-dropdown")).toBeInTheDocument();
    });

    it("jumps to verse/chorus/bridge shortcuts with Ctrl+1/2/3", () => {
      renderEditor();
      const editor = screen.getByTestId("chordpro-editor") as HTMLTextAreaElement;
      fireEvent.keyDown(editor, { key: "2", ctrlKey: true });
      expect(editor.selectionStart).toBeGreaterThan(0);
      fireEvent.keyDown(editor, { key: "3", ctrlKey: true });
      expect(editor.selectionStart).toBeGreaterThan(0);
    });

    it("renders sticky toolbar and accessible control labels", () => {
      renderEditor();
      expect(screen.getByTestId("editor-toolbar").className).toContain("sticky");
      expect(screen.getByLabelText(/switch to editor-only mode/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/switch to split editor and preview mode/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/format chordpro document/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/open insert section menu/i)).toBeInTheDocument();
    });

    it("shows beginner mode examples and defaults help open", () => {
      localStorage.setItem("vpc-editor-mode", "beginner");
      renderEditor();
      expect(screen.getByTestId("beginner-example-panel")).toBeInTheDocument();
      expect(screen.getByText("Full Song Example")).toBeInTheDocument();
      expect(screen.getByTestId("help-content")).toBeInTheDocument();
      expect(screen.queryByTestId("format-btn")).not.toBeInTheDocument();
      expect(screen.queryByTestId("view-mode-split")).not.toBeInTheDocument();
    });

    it("shows advanced mode shortcut chips", () => {
      renderEditor();
      expect(screen.getByTestId("advanced-shortcuts")).toBeInTheDocument();
      expect(screen.getByText(/ctrl\+space palette/i)).toBeInTheDocument();
    });

    it("shows cursor-aware help based on the current cursor context", () => {
      renderEditor({ value: "{title: Test}\n{artist: Someone}\n{key: G}\n\n[G]Amazing grace" });
      expect(screen.getByTestId("cursor-context-help")).toHaveTextContent(/directive help/i);
      expect(screen.getByTestId("cursor-context-help")).toHaveTextContent(/keep song metadata near the top/i);
    });

    it("renders smart suggestions and applies them", async () => {
      const onChange = vi.fn();
      renderEditor({ value: "[G]Amazing grace\nHow sweet the sound\n\n[G]Amazing grace\nHow sweet the sound", onChange });
      expect(screen.getByTestId("smart-suggestions-panel")).toBeInTheDocument();
      expect(screen.getAllByText(/likely chorus detected/i).length).toBeGreaterThanOrEqual(1);

      const user = userEvent.setup();
      await user.click(screen.getAllByRole("button", { name: /insert chorus label/i })[0]);
      expect(onChange).toHaveBeenCalledWith("{comment: Chorus}\n[G]Amazing grace\nHow sweet the sound\n\n[G]Amazing grace\nHow sweet the sound");
    });

    it("applies inline validation fixes from the editor panel", async () => {
      const onChange = vi.fn();
      renderEditor({ value: "[g / b]Amazing grace", onChange });
      const user = userEvent.setup();
      await user.click(screen.getAllByTestId("validation-fix-btn")[0]);
      expect(onChange).toHaveBeenCalledWith("[G/B]Amazing grace");
    });
  });
});
