import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ChevronDown, Columns, Eye, Music, Pencil, Wand2 } from "lucide-react";
import { CHORD_REGEX, transposeChord } from "@vpc-music/shared";
import { ValidationPanel } from "./ValidationPanel";
import { ChordProRenderer } from "./ChordProRenderer";
import { ChordProRichEditorSurface, type ChordProRichEditorHandle } from "./ChordProRichEditorSurface";
import { formatChordPro } from "../../utils/chordpro-format";
import type { ValidationIssue } from "../../utils/chordpro-validate";

// ── Insert menu ──────────────────────────────────
const SECTION_INSERTS = ["Intro", "Verse 1", "Verse 2", "Verse 3", "Verse 4", "Pre-Chorus", "Chorus", "Bridge", "Interlude", "Tag", "Outro"].map(
  (label) => ({ label, value: `{comment: ${label}}` }),
);

interface LineInsert {
  label: string;
  value: string;
  /** Insert at the cursor on the current line instead of as a new block. */
  inline?: boolean;
  /** Where to leave the cursor, relative to the start of the inserted text. */
  cursorOffset: number;
}

const LINE_INSERTS: LineInsert[] = [
  { label: "Comment line", value: "{ci: }", cursorOffset: 5 },
  { label: "Secondary chord", value: "[*]", inline: true, cursorOffset: 2 },
];

interface ChordProEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Song metadata: kept in sync with the directives at the top of the content. */
  metadata?: {
    title?: string;
    artist?: string;
    key?: string;
    tempo?: string;
  };
  /** Called on Ctrl+S inside the editor. */
  onSave?: () => void;
}

type ViewMode = "edit" | "split" | "preview";

const SECTION_LINE = /^\{comment:\s*(.*?)\}\s*$/;
const NOTE_LINE = /^\{ci:\s*(.*)\}$/;

function charOffsetOfLine(text: string, lineIndex: number) {
  const lines = text.split("\n");
  let offset = 0;
  for (let index = 0; index < lineIndex && index < lines.length; index += 1) {
    offset += lines[index].length + 1;
  }
  return offset;
}

/**
 * One ChordPro editor (CodeMirror) with the handful of tools a worship team
 * uses: edit/split/preview, insert a section or note, a chord popup on a
 * selection, keyboard shortcuts, formatting, validation, and a cheat sheet.
 */
export function ChordProEditor({ value, onChange, metadata, onSave }: ChordProEditorProps) {
  const editorRef = useRef<ChordProRichEditorHandle>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const insertRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const chordInputRef = useRef<HTMLInputElement>(null);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [insertOpen, setInsertOpen] = useState(false);
  const [chordPopup, setChordPopup] = useState({ open: false, x: 0, y: 0, selStart: 0, selEnd: 0 });
  const [chordInput, setChordInput] = useState("");

  const sections = useMemo(() => {
    const result: { name: string; line: number }[] = [];
    value.split("\n").forEach((line, index) => {
      const match = line.match(SECTION_LINE);
      if (match) result.push({ name: match[1], line: index });
    });
    return result;
  }, [value]);

  // ── Selection helpers ─────────────────────────
  const getSelection = useCallback(() => editorRef.current?.getSelection() ?? selection, [selection]);

  const applySelection = useCallback((start: number, end: number) => {
    if (!editorRef.current) return false;
    editorRef.current.setSelection(start, end);
    setSelection({ start, end });
    return true;
  }, []);

  const flushPendingSelection = useCallback(() => {
    const pending = pendingSelectionRef.current;
    if (pending && applySelection(pending.start, pending.end)) pendingSelectionRef.current = null;
  }, [applySelection]);

  const scheduleSelection = useCallback(
    (start: number, end: number) => {
      pendingSelectionRef.current = { start, end };
      requestAnimationFrame(flushPendingSelection);
    },
    [flushPendingSelection],
  );

  useEffect(() => {
    flushPendingSelection();
  }, [flushPendingSelection, value]);

  const focusEditor = useCallback(() => editorRef.current?.focus(), []);

  // ── Metadata -> directive sync ────────────────
  const prevMetaRef = useRef(metadata);
  useEffect(() => {
    if (!metadata) return;
    const prev = prevMetaRef.current ?? {};
    prevMetaRef.current = metadata;
    const changed = (["title", "artist", "key", "tempo"] as const).filter((field) => metadata[field] !== prev[field]);
    if (changed.length === 0) return;

    let updated = value;
    for (const field of changed) {
      const next = metadata[field]?.trim();
      if (!next) continue;
      const directive = `{${field}: ${next}}`;
      const existing = new RegExp(`^\\{${field}:\\s*.*\\}\\s*$`, "m");
      if (existing.test(updated)) {
        updated = updated.replace(existing, directive);
      } else {
        const lines = updated.split("\n");
        let insertAt = 0;
        while (insertAt < lines.length && /^\{[a-z_]+:/.test(lines[insertAt].trim())) insertAt += 1;
        lines.splice(insertAt, 0, directive);
        updated = lines.join("\n");
      }
    }
    if (updated !== value) onChange(updated);
    // Only metadata changes drive this; `value` is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadata?.title, metadata?.artist, metadata?.key, metadata?.tempo, onChange]);

  // ── Editing commands ──────────────────────────
  const insertBlock = useCallback(
    (text: string, cursorOffset?: number) => {
      const { start } = getSelection();
      const before = value.slice(0, start);
      const after = value.slice(start);
      const prefix = before.length === 0 || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
      const inserted = `${prefix}${text}\n`;
      onChange(before + inserted + after);
      setInsertOpen(false);
      const cursor = cursorOffset === undefined ? start + inserted.length : start + prefix.length + cursorOffset;
      scheduleSelection(cursor, cursor);
    },
    [getSelection, onChange, scheduleSelection, value],
  );

  const insertInline = useCallback(
    (text: string, cursorOffset: number) => {
      const { start } = getSelection();
      onChange(value.slice(0, start) + text + value.slice(start));
      setInsertOpen(false);
      scheduleSelection(start + cursorOffset, start + cursorOffset);
    },
    [getSelection, onChange, scheduleSelection, value],
  );

  const handleFormat = useCallback(() => {
    const formatted = formatChordPro(value);
    if (formatted !== value) onChange(formatted);
  }, [value, onChange]);

  const jumpToLine = useCallback(
    (lineIndex: number) => {
      const position = charOffsetOfLine(value, lineIndex);
      applySelection(position, position);
      focusEditor();
    },
    [applySelection, focusEditor, value],
  );

  /** Ctrl+/ : wrap the selected line(s) in {ci: ...} notes, or unwrap them. */
  const toggleNoteLines = useCallback(() => {
    const { start, end } = getSelection();
    const lines = value.split("\n");
    let offset = 0;
    let startLine = 0;
    let endLine = 0;
    lines.forEach((line, index) => {
      const lineEnd = offset + line.length;
      if (offset <= start && start <= lineEnd + 1) startLine = index;
      if (offset <= end && end <= lineEnd + 1) endLine = index;
      offset = lineEnd + 1;
    });
    const targets = lines.slice(startLine, endLine + 1);
    const allNotes = targets.every((line) => NOTE_LINE.test(line.trim()));
    const next = [...lines];
    for (let index = startLine; index <= endLine; index += 1) {
      const trimmed = next[index].trim();
      if (allNotes) {
        next[index] = trimmed.match(NOTE_LINE)?.[1] ?? trimmed;
      } else if (trimmed && !trimmed.startsWith("{")) {
        next[index] = `{ci: ${trimmed}}`;
      }
    }
    onChange(next.join("\n"));
  }, [getSelection, onChange, value]);

  const transposeSelection = useCallback(
    (steps: number) => {
      const { start, end } = getSelection();
      let from = start;
      let to = end;
      if (from === to) {
        from = value.lastIndexOf("\n", from - 1) + 1;
        const lineEnd = value.indexOf("\n", to);
        to = lineEnd === -1 ? value.length : lineEnd;
      }
      const selected = value.slice(from, to);
      const transposed = selected.replace(/\[([^\]]+)\]/g, (_match: string, chord: string) => `[${transposeChord(chord, steps)}]`);
      if (transposed !== selected) {
        onChange(value.slice(0, from) + transposed + value.slice(to));
        scheduleSelection(from, from + transposed.length);
      }
    },
    [getSelection, onChange, scheduleSelection, value],
  );

  // ── Chord popup on a selection ────────────────
  const openChordPopup = useCallback(() => {
    const { start, end } = getSelection();
    if (start === end) return;
    const rect = editorRef.current?.getDomRect();
    if (!rect) return;
    const scrollTop = editorRef.current?.getScrollMetrics().top ?? 0;
    const linesBefore = value.slice(0, start).split("\n");
    const row = linesBefore.length - 1;
    const col = linesBefore[linesBefore.length - 1].length;
    setChordPopup({
      open: true,
      x: Math.min(Math.max(rect.width - 190, 0), Math.max(0, col * 8)),
      y: Math.max(0, Math.min(rect.height - 40, (row + 1) * 20 - scrollTop)),
      selStart: start,
      selEnd: end,
    });
    setChordInput("");
    requestAnimationFrame(() => chordInputRef.current?.focus());
  }, [getSelection, value]);

  const closeChordPopup = useCallback(() => setChordPopup((popup) => ({ ...popup, open: false })), []);

  const applyChord = useCallback(() => {
    const chord = chordInput.trim();
    if (!chord) {
      closeChordPopup();
      return;
    }
    const { selStart, selEnd } = chordPopup;
    const selected = value.slice(selStart, selEnd);
    onChange(`${value.slice(0, selStart)}[${chord}]${selected}${value.slice(selEnd)}`);
    closeChordPopup();
    const cursor = selStart + chord.length + 2 + selected.length;
    requestAnimationFrame(() => {
      focusEditor();
      scheduleSelection(cursor, cursor);
    });
  }, [chordInput, chordPopup, closeChordPopup, focusEditor, onChange, scheduleSelection, value]);

  const insertEmptyChord = useCallback(() => {
    const { start } = getSelection();
    onChange(`${value.slice(0, start)}[]${value.slice(start)}`);
    scheduleSelection(start + 1, start + 1);
  }, [getSelection, onChange, scheduleSelection, value]);

  // ── Keyboard shortcuts ────────────────────────
  const handleKeyDown = useCallback(
    (event: globalThis.KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key === "s") {
        event.preventDefault();
        onSave?.();
      } else if (mod && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        handleFormat();
      } else if (mod && event.key === "/") {
        event.preventDefault();
        toggleNoteLines();
      } else if (mod && event.key === "k") {
        event.preventDefault();
        const { start, end } = getSelection();
        if (start !== end) openChordPopup();
        else insertEmptyChord();
      } else if (mod && event.shiftKey && event.key === "V") {
        event.preventDefault();
        insertBlock("{comment: Verse}");
      } else if (mod && event.shiftKey && event.key === "C") {
        event.preventDefault();
        insertBlock("{comment: Chorus}");
      } else if (mod && event.shiftKey && event.key === "B") {
        event.preventDefault();
        insertBlock("{comment: Bridge}");
      } else if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        transposeSelection(event.key === "ArrowUp" ? 1 : -1);
      }
    },
    [getSelection, handleFormat, insertBlock, insertEmptyChord, onSave, openChordPopup, toggleNoteLines, transposeSelection],
  );

  const handleChordInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyChord();
      } else if (event.key === "Escape") {
        closeChordPopup();
        focusEditor();
      }
    },
    [applyChord, closeChordPopup, focusEditor],
  );

  // ── Validation quick fixes ────────────────────
  const applyValidationFix = useCallback(
    (issue: ValidationIssue) => {
      const lines = value.split("\n");
      const lineIndex = Math.max(0, issue.line - 1);
      const next = [...lines];
      switch (issue.code) {
        case "duplicate-directive":
          next.splice(lineIndex, 1);
          onChange(next.join("\n"));
          return;
        case "missing-metadata": {
          const name = issue.directiveName === "artist" || issue.directiveName === "key" ? issue.directiveName : "title";
          const fallback = metadata?.[name]?.trim() || (name === "title" ? "Untitled" : "");
          onChange(`{${name}: ${fallback}}\n${value}`);
          return;
        }
        case "malformed-chord":
          if (issue.chordText && issue.suggestedValue) {
            next[lineIndex] = (next[lineIndex] ?? "").replace(`[${issue.chordText}]`, `[${issue.suggestedValue}]`);
            onChange(next.join("\n"));
          }
          return;
        case "unclosed-bracket":
          next[lineIndex] = `${next[lineIndex] ?? ""}]`;
          onChange(next.join("\n"));
          return;
        case "unclosed-brace":
          next[lineIndex] = `${next[lineIndex] ?? ""}}`;
          onChange(next.join("\n"));
          return;
        case "unexpected-closing-bracket":
          next[lineIndex] = (next[lineIndex] ?? "").replace("]", "");
          onChange(next.join("\n"));
          return;
        case "unexpected-closing-brace":
          next[lineIndex] = (next[lineIndex] ?? "").replace("}", "");
          onChange(next.join("\n"));
          return;
        default:
          return;
      }
    },
    [metadata, onChange, value],
  );

  // ── Split view scroll sync ────────────────────
  const handleScroll = useCallback(
    (metrics: { top: number; scrollHeight: number; clientHeight: number }) => {
      if (viewMode !== "split" || !previewRef.current) return;
      const ratio = metrics.top / (metrics.scrollHeight - metrics.clientHeight || 1);
      previewRef.current.scrollTop = ratio * (previewRef.current.scrollHeight - previewRef.current.clientHeight);
    },
    [viewMode],
  );

  // ── Close the insert menu and chord popup on outside clicks ──
  useEffect(() => {
    if (!insertOpen && !chordPopup.open) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (insertOpen && insertRef.current && !insertRef.current.contains(target)) setInsertOpen(false);
      if (chordPopup.open && popupRef.current && !popupRef.current.contains(target)) closeChordPopup();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [insertOpen, chordPopup.open, closeChordPopup]);

  const chordLooksValid = chordInput.trim() ? CHORD_REGEX.test(chordInput.trim()) || /^[A-G]/.test(chordInput.trim()) : null;
  const viewButton = (mode: ViewMode, label: string, icon: React.ReactNode, extra = "") => (
    <button
      type="button"
      onClick={() => setViewMode(mode)}
      aria-pressed={viewMode === mode}
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${extra} ${
        viewMode === mode
          ? "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"
          : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      }`}
      data-testid={`view-mode-${mode}`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="space-y-2" role="region" aria-label="ChordPro editor">
      <div className="flex flex-wrap items-center gap-2" data-testid="editor-toolbar">
        <span className="text-sm font-medium text-[hsl(var(--foreground))]">Chart (ChordPro)</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center overflow-hidden rounded-md border border-[hsl(var(--border))]" data-testid="view-mode-toggle">
            {viewButton("edit", "Edit", <Pencil className="h-3 w-3" />)}
            {viewButton("split", "Split", <Columns className="h-3 w-3" />, "hidden border-x border-[hsl(var(--border))] sm:inline-flex")}
            {viewButton("preview", "Preview", <Eye className="h-3 w-3" />, "border-l border-[hsl(var(--border))] sm:border-l-0")}
          </div>

          {viewMode !== "preview" && (
            <>
              <div className="relative" ref={insertRef}>
                <button
                  type="button"
                  onClick={() => setInsertOpen((open) => !open)}
                  className="btn-outline btn-sm gap-1.5"
                  aria-haspopup="menu"
                  aria-expanded={insertOpen}
                  data-testid="section-insert-btn"
                >
                  <Music className="h-3.5 w-3.5" />
                  Insert
                  <ChevronDown className="h-3 w-3" />
                </button>
                {insertOpen && (
                  <div
                    role="menu"
                    aria-label="Insert"
                    className="fixed inset-x-4 bottom-4 z-40 max-h-[50vh] overflow-y-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--popover))] py-1 shadow-lg sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:mt-1 sm:max-h-72 sm:w-52"
                    data-testid="section-dropdown"
                  >
                    {SECTION_INSERTS.map((item) => (
                      <button key={item.label} type="button" role="menuitem" onClick={() => insertBlock(item.value)} className="block w-full px-3 py-2 text-left text-sm hover:bg-[hsl(var(--muted))]">
                        {item.label}
                      </button>
                    ))}
                    <div className="my-1 border-t border-[hsl(var(--border))]" role="separator" />
                    {LINE_INSERTS.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        role="menuitem"
                        onClick={() => (item.inline ? insertInline(item.value, item.cursorOffset) : insertBlock(item.value, item.cursorOffset))}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-[hsl(var(--muted))]"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" onClick={handleFormat} className="btn-outline btn-sm gap-1.5" title="Tidy directives and spacing (Ctrl+Shift+F)" data-testid="format-btn">
                <Wand2 className="h-3.5 w-3.5" />
                Format
              </button>
            </>
          )}
        </div>
      </div>

      {viewMode !== "preview" && sections.length > 0 && (
        <div className="flex flex-wrap gap-1.5" data-testid="section-chips" aria-label="Jump to section">
          {sections.map((section) => (
            <button key={`${section.name}-${section.line}`} type="button" onClick={() => jumpToLine(section.line)} className="badge-muted hover:bg-[hsl(var(--muted))]">
              {section.name}
            </button>
          ))}
        </div>
      )}

      <div className={viewMode === "split" ? "grid gap-4 sm:grid-cols-2" : ""}>
        {viewMode !== "preview" && (
          <div className="relative">
            <ChordProRichEditorSurface
              ref={editorRef}
              value={value}
              onValueChange={(next, start, end) => {
                onChange(next);
                setSelection({ start, end });
              }}
              onSelectionChange={(start, end) => setSelection({ start, end })}
              onScrollChange={handleScroll}
              onKeyDown={handleKeyDown}
              onMouseUp={openChordPopup}
              placeholderText={"{title: Song title}\n{key: G}\n\n{comment: Verse 1}\n[G]Lyrics with [C]chords in [D]brackets"}
            />
            {chordPopup.open && (
              <div
                ref={popupRef}
                className="absolute z-30 flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-2 shadow-lg"
                style={{ left: chordPopup.x, top: chordPopup.y }}
                data-testid="chord-popup"
              >
                <input
                  ref={chordInputRef}
                  value={chordInput}
                  onChange={(event) => setChordInput(event.target.value)}
                  onKeyDown={handleChordInputKeyDown}
                  placeholder="Chord, e.g. G/B"
                  aria-label="Chord to insert"
                  className={`input h-9 w-32 text-sm ${chordLooksValid === false ? "border-[hsl(var(--destructive))]" : ""}`}
                />
                <button type="button" onClick={applyChord} className="btn-primary btn-sm">
                  Add
                </button>
              </div>
            )}
          </div>
        )}
        {viewMode !== "edit" && (
          <div ref={previewRef} className="card card-body max-h-[70vh] overflow-y-auto" data-testid="editor-preview">
            <ChordProRenderer content={value} songKey={metadata?.key} fontSize={14} />
          </div>
        )}
      </div>

      <ValidationPanel source={value} onApplyFix={applyValidationFix} />

      <details className="text-xs text-[hsl(var(--muted-foreground))]">
        <summary className="cursor-pointer select-none">ChordPro cheat sheet</summary>
        <ul className="mt-2 space-y-1 font-mono">
          <li>[G]Lyrics — a chord goes in brackets right before the syllable it lands on</li>
          <li>{"{comment: Chorus}"} — a section header (use the Insert menu)</li>
          <li>{"{ci: play softly}"} — an italic note the chart can hide (Ctrl+/ toggles)</li>
          <li>[*ab] — a secondary chord or bass note shown in a second row</li>
          <li>| G | C/E | D | — a bar line with one chord per measure</li>
          <li>Select a word and press Ctrl+K to add a chord to it; Ctrl+K alone inserts []</li>
          <li>Alt+Up / Alt+Down transposes the selection or the current line</li>
          <li>Ctrl+S saves, Ctrl+Shift+F tidies the whole chart</li>
        </ul>
      </details>
    </div>
  );
}
