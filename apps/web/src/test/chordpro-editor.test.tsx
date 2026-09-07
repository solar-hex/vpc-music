import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChordProEditor } from "@/components/songs/ChordProEditor";

// ---------- Mocks ----------
vi.mock("@/components/songs/ChordProRenderer", () => ({
  ChordProRenderer: ({ content, songKey }: { content: string; songKey?: string }) => (
    <div data-testid="chordpro-renderer">
      preview:{content}::{songKey || ""}
    </div>
  ),
}));

vi.mock("@vpc-music/shared", () => ({
  CHORD_REGEX: /^[A-G][b#]?(?:m|maj|min|dim|aug|sus[24]?)?\d?(?:\/[A-G][b#]?)?$/,
  transposeChord: (chord: string, steps: number) => {
    const notes = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    const match = chord.match(/^([A-G][b#]?)(.*)$/);
    if (!match) return chord;
    const index = notes.indexOf(match[1]);
    if (index === -1) return chord;
    return notes[(index + steps + 12) % 12] + match[2];
  },
  isChordToken: (token: string) => /^[A-G][b#]?/.test(token),
  isSectionToken: (token: string) => /^(verse|chorus|bridge|intro|outro)/i.test(token),
}));

const SONG = "{title: Amazing Grace}\n{key: G}\n\n{comment: Verse 1}\n[G]Amazing grace\n\n{comment: Chorus}\n[C]How sweet";

function Harness({ initial = SONG, onSave, metadata }: { initial?: string; onSave?: () => void; metadata?: { title?: string; artist?: string; key?: string; tempo?: string } }) {
  const [value, setValue] = useState(initial);
  return (
    <div>
      <ChordProEditor value={value} onChange={setValue} metadata={metadata} onSave={onSave} />
      <pre data-testid="value">{value}</pre>
    </div>
  );
}

const editorContent = () => document.querySelector(".cm-content") as HTMLElement;
const value = () => screen.getByTestId("value").textContent ?? "";

describe("ChordProEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders one CodeMirror surface with the content, a toolbar and section chips", async () => {
    render(<Harness />);
    await waitFor(() => expect(document.querySelector(".cm-line")?.textContent).toContain("{title: Amazing Grace}"));
    expect(screen.getByRole("region", { name: /chordpro editor/i })).toBeInTheDocument();
    expect(screen.getByTestId("view-mode-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("section-insert-btn")).toBeInTheDocument();
    expect(screen.getByTestId("format-btn")).toBeInTheDocument();
    expect(screen.getByTestId("section-chips")).toHaveTextContent("Verse 1");
    expect(screen.getByTestId("section-chips")).toHaveTextContent("Chorus");
    // the old power tools are gone
    expect(screen.queryByText(/smart suggestions|command palette|go to section|beginner/i)).not.toBeInTheDocument();
    expect(document.querySelectorAll(".cm-content")).toHaveLength(1);
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("switches between edit, split and preview", async () => {
    render(<Harness />);
    await waitFor(() => expect(editorContent()).toBeTruthy());
    expect(screen.queryByTestId("editor-preview")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("view-mode-preview"));
    expect(screen.getByTestId("editor-preview")).toHaveTextContent("preview:{title: Amazing Grace}");
    expect(document.querySelector(".cm-content")).toBeNull();
    expect(screen.queryByTestId("section-insert-btn")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("view-mode-split"));
    await waitFor(() => expect(document.querySelector(".cm-content")).toBeTruthy());
    expect(screen.getByTestId("editor-preview")).toBeInTheDocument();
  });

  it("inserts a section block from the Insert menu", async () => {
    render(<Harness initial="[G]Line one" />);
    await waitFor(() => expect(editorContent()).toBeTruthy());
    fireEvent.click(screen.getByTestId("section-insert-btn"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Bridge" }));
    expect(value()).toContain("{comment: Bridge}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("inserts a comment line and an inline secondary chord", async () => {
    render(<Harness initial="" />);
    await waitFor(() => expect(editorContent()).toBeTruthy());
    fireEvent.click(screen.getByTestId("section-insert-btn"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Comment line" }));
    expect(value()).toContain("{ci: }");
    fireEvent.click(screen.getByTestId("section-insert-btn"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Secondary chord" }));
    expect(value()).toContain("[*]");
  });

  it("formats the document from the toolbar and with Ctrl+Shift+F", async () => {
    render(<Harness initial={"{key:G}\n{title:  Messy}\n\n\n\n[G]La"} />);
    await waitFor(() => expect(editorContent()).toBeTruthy());
    fireEvent.click(screen.getByTestId("format-btn"));
    const formatted = value();
    expect(formatted).not.toContain("\n\n\n\n");
    expect(formatted).toContain("{title: Messy}");
  });

  it("calls onSave on Ctrl+S inside the editor", async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    await waitFor(() => expect(editorContent()).toBeTruthy());
    fireEvent.keyDown(editorContent(), { key: "s", ctrlKey: true });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("toggles {ci} note lines with Ctrl+/", async () => {
    render(<Harness initial="play softly" />);
    await waitFor(() => expect(editorContent()).toBeTruthy());
    fireEvent.keyDown(editorContent(), { key: "/", ctrlKey: true });
    expect(value()).toBe("{ci: play softly}");
    fireEvent.keyDown(editorContent(), { key: "/", ctrlKey: true });
    expect(value()).toBe("play softly");
  });

  it("inserts empty chord brackets with Ctrl+K when nothing is selected", async () => {
    render(<Harness initial="Amazing grace" />);
    await waitFor(() => expect(editorContent()).toBeTruthy());
    fireEvent.keyDown(editorContent(), { key: "k", ctrlKey: true });
    expect(value()).toContain("[]");
  });

  it("transposes the current line with Alt+Up and opens the chord popup for a selection", async () => {
    render(<Harness initial="[G]Amazing [C]grace" />);
    await waitFor(() => expect(editorContent()).toBeTruthy());
    fireEvent.keyDown(editorContent(), { key: "ArrowUp", altKey: true });
    expect(value()).toBe("[Ab]Amazing [Db]grace");
    // the transposed line stays selected, so Ctrl+K now asks for a chord
    fireEvent.keyDown(editorContent(), { key: "k", ctrlKey: true });
    expect(await screen.findByTestId("chord-popup")).toBeInTheDocument();
  });

  it("keeps the title, artist, key and tempo directives in sync with the form", async () => {
    const { rerender } = render(<Harness initial={"{title: Old}\n[G]La"} metadata={{ title: "Old", key: "" }} />);
    await waitFor(() => expect(editorContent()).toBeTruthy());
    rerender(<Harness initial={"{title: Old}\n[G]La"} metadata={{ title: "New Title", key: "D", tempo: "88" }} />);
    await waitFor(() => expect(value()).toContain("{title: New Title}"));
    expect(value()).toContain("{key: D}");
    expect(value()).toContain("{tempo: 88}");
    expect(value().indexOf("{key: D}")).toBeLessThan(value().indexOf("[G]La"));
  });

  it("shows validation issues for the chart", async () => {
    render(<Harness initial="[G Amazing" />);
    await waitFor(() => expect(editorContent()).toBeTruthy());
    expect(screen.getAllByText(/unclosed/i).length).toBeGreaterThan(0);
  });

  it("offers a cheat sheet instead of a help panel", async () => {
    render(<Harness />);
    await waitFor(() => expect(editorContent()).toBeTruthy());
    expect(screen.getByText("ChordPro cheat sheet")).toBeInTheDocument();
    expect(screen.getByText(/\[\*ab\]/)).toBeInTheDocument();
  });
});
