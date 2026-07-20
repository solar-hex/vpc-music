import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { ChevronDown, Music, Columns, Eye, Pencil, MapPin, Wand2 } from "lucide-react";
import { CHORD_REGEX, transposeChord } from "@vpc-music/shared";
import { SyntaxHighlightOverlay } from "./SyntaxHighlightOverlay";
import { ValidationPanel } from "./ValidationPanel";
import { EditorHelpSection } from "./EditorHelpSection";
import { CommandPalette, type CommandItem } from "./CommandPalette";
import { ChordProRenderer } from "./ChordProRenderer";
import { ChordProRichEditorSurface, type ChordProRichEditorHandle } from "./ChordProRichEditorSurface";
import { EditorContextMenu, detectContext, type ContextMenuPosition } from "./EditorContextMenu";
import { SmartSuggestionsPanel } from "./SmartSuggestionsPanel";
import { CursorContextHelp } from "./CursorContextHelp";
import { SectionOrganizer } from "./SectionOrganizer";
import { formatChordPro } from "../../utils/chordpro-format";
import { applySmartSuggestion, getSmartSuggestions } from "../../utils/chordpro-smart-tools";
import { buildCollapsedChordProView, duplicateChordProSection, getOrganizedSections, reorderChordProSections } from "../../utils/chordpro-section-organizer";
import type { ValidationIssue } from "../../utils/chordpro-validate";

// ── Section choices for the insert dropdown ──────
const SECTION_INSERTS = [
  { label: "Verse 1", value: "{comment: Verse 1}" },
  { label: "Verse 2", value: "{comment: Verse 2}" },
  { label: "Verse 3", value: "{comment: Verse 3}" },
  { label: "Verse 4", value: "{comment: Verse 4}" },
  { label: "Chorus", value: "{comment: Chorus}" },
  { label: "Pre-Chorus", value: "{comment: Pre-Chorus}" },
  { label: "Bridge", value: "{comment: Bridge}" },
  { label: "Intro", value: "{comment: Intro}" },
  { label: "Outro", value: "{comment: Outro}" },
  { label: "Interlude", value: "{comment: Interlude}" },
  { label: "Instrumental", value: "{comment: Instrumental}" },
  { label: "Tag", value: "{comment: Tag}" },
  { label: "Ending", value: "{comment: Ending}" },
  { label: "Solo", value: "{comment: Solo}" },
  { label: "Turnaround", value: "{comment: Turnaround}" },
  { label: "Vamp", value: "{comment: Vamp}" },
  { label: "Coda", value: "{comment: Coda}" },
  // ── Expanded inserts ──
  { label: "Metadata Block", value: "{title: Song Title}\n{artist: Artist Name}\n{key: G}\n{tempo: 120}" },
  { label: "Song Skeleton", value: "{title: Song Title}\n{artist: Artist Name}\n{key: G}\n{tempo: 120}\n\n{comment: Verse 1}\n\n\n{comment: Chorus}\n\n\n{comment: Verse 2}\n\n\n{comment: Bridge}\n" },
];

interface ChordProEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Song metadata — used to sync directives at the top of content */
  metadata?: {
    title?: string;
    artist?: string;
    key?: string;
    tempo?: string;
  };
  /** Called when Ctrl+S is pressed inside the editor */
  onSave?: () => void;
}

type ViewMode = "edit" | "split" | "preview";
type EditorMode = "beginner" | "advanced";

const EDITOR_MODE_STORAGE_KEY = "vpc-editor-mode";

const BEGINNER_EXAMPLES = [
  { label: "Full Song Example", value: SECTION_INSERTS[18].value },
  { label: "Metadata Block", value: SECTION_INSERTS[17].value },
  { label: "Verse", value: "{comment: Verse 1}" },
  { label: "Chorus", value: "{comment: Chorus}" },
];

function getStoredEditorMode(): EditorMode {
  if (typeof document !== "undefined") {
    const datasetMode = document.documentElement.dataset.editorMode;
    if (datasetMode === "beginner" || datasetMode === "advanced") {
      return datasetMode;
    }
  }

  if (typeof window !== "undefined") {
    const storedMode = localStorage.getItem(EDITOR_MODE_STORAGE_KEY);
    if (storedMode === "beginner" || storedMode === "advanced") {
      return storedMode;
    }
  }

  return "advanced";
}

function shouldUseRichEditor() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return !/jsdom/i.test(navigator.userAgent);
}

/**
 * Rich ChordPro editor with:
 * 1) Metadata → directive sync (pre-fill)
 * 2) Section insert dropdown (17 sections + metadata block + song skeleton)
 * 3) Chord insertion via text selection popup
 * 4) Syntax highlighting overlay
 * 5) Inline validation panel
 * 6) Keyboard shortcuts (Ctrl+S, Ctrl+/, Ctrl+K, Ctrl+Shift+V/C/B, Alt+Up/Down)
 * 7) Collapsible help section with tips, shortcuts, directives, and templates
 */
export function ChordProEditor({ value, onChange, metadata, onSave }: ChordProEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const richEditorRef = useRef<ChordProRichEditorHandle>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>(getStoredEditorMode);
  const [helpOpen, setHelpOpen] = useState<boolean | undefined>(undefined);
  const [sectionDropdownOpen, setSectionDropdownOpen] = useState(false);
  const sectionBtnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Chord popup state ──────────────────────────
  const [chordPopup, setChordPopup] = useState<{
    open: boolean;
    x: number;
    y: number;
    selStart: number;
    selEnd: number;
  }>({ open: false, x: 0, y: 0, selStart: 0, selEnd: 0 });
  const [chordInput, setChordInput] = useState("");
  const chordInputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // ── Command palette state ──────────────────────
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState("");
  /** Track slash-command "/" position so we can remove the slash on insert */
  const slashPosRef = useRef<number | null>(null);

  // ── View mode state (edit / split / preview) ──
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const previewRef = useRef<HTMLDivElement>(null);
  const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 });
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);

  // ── Line numbers & current line tracking ──────
  const [currentLine, setCurrentLine] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const gutterRef = useRef<HTMLDivElement>(null);

  // Sections detected from content for the section-nav dropdown
  const sections = useMemo(() => {
    const result: { name: string; line: number }[] = [];
    value.split("\n").forEach((line, i) => {
      const m = line.match(/^\{comment:\s*(.*?)\}\s*$/);
      if (m) result.push({ name: m[1], line: i });
    });
    return result;
  }, [value]);

  const organizedSections = useMemo(() => getOrganizedSections(value), [value]);

  const [sectionNavOpen, setSectionNavOpen] = useState(false);
  const sectionNavBtnRef = useRef<HTMLButtonElement>(null);
  const sectionNavDropdownRef = useRef<HTMLDivElement>(null);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<string[]>([]);

  // ── Context menu state ────────────────────────
  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    position: ContextMenuPosition;
    groups: { label: string; actions: { label: string; action: () => void; shortcut?: string }[] }[];
  }>({ open: false, position: { x: 0, y: 0 }, groups: [] });

  // ── Format on save toggle ─────────────────────
  const [formatOnSave, setFormatOnSave] = useState(() => {
    try {
      return localStorage.getItem("chordpro-format-on-save") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try { localStorage.setItem("chordpro-format-on-save", String(formatOnSave)); }
    catch { /* ignore */ }
  }, [formatOnSave]);

  useEffect(() => {
    setHelpOpen(editorMode === "beginner");
    if (editorMode === "beginner" && viewMode === "split") {
      setViewMode("edit");
    }
  }, [editorMode, viewMode]);

  useEffect(() => {
    const syncEditorMode = () => setEditorMode(getStoredEditorMode());
    window.addEventListener("storage", syncEditorMode);
    window.addEventListener("vpc-appearance-change", syncEditorMode as EventListener);
    return () => {
      window.removeEventListener("storage", syncEditorMode);
      window.removeEventListener("vpc-appearance-change", syncEditorMode as EventListener);
    };
  }, []);

  const handleFormat = useCallback(() => {
    const formatted = formatChordPro(value);
    if (formatted !== value) {
      onChange(formatted);
    }
  }, [value, onChange]);

  const findSectionLine = useCallback((matcher: RegExp) => {
    const match = sections.find((section) => matcher.test(section.name));
    return match?.line ?? null;
  }, [sections]);

  const smartSuggestions = useMemo(() => getSmartSuggestions(value), [value]);
  const isRichEditorEnabled = editorMode === "advanced" && shouldUseRichEditor();
  const editorSurfaceValue = useMemo(
    () => buildCollapsedChordProView(value, collapsedSectionIds),
    [collapsedSectionIds, value],
  );
  const lineCount = editorSurfaceValue.split("\n").length;

  const cursorContext = useMemo(() => detectContext(value, cursorPosition), [value, cursorPosition]);

  const cursorHelp = useMemo(() => {
    const trimmedLine = cursorContext.lineText.trim();

    if (/^\{\w+(?::.*)?\}$/.test(trimmedLine)) {
      return {
        title: "Directive help",
        body: "Keep song metadata near the top so exports, search, and previews stay accurate.",
        tips: [
          "Use {title}, {artist}, {key}, and {tempo} before the first lyric section.",
          "Ctrl+Shift+F normalizes directive spacing and ordering.",
          "The smart suggestions panel can insert missing metadata with one click.",
        ],
      };
    }

    if (cursorContext.type === "section") {
      return {
        title: "Section tools",
        body: "Section labels power quick navigation, performance mode jumps, and arrangement suggestions.",
        tips: [
          "Right-click a section header to duplicate or move it.",
          "Use consistent labels like Verse 1, Chorus, and Bridge.",
          "The smart suggestions panel can label unlabeled sections for you.",
        ],
      };
    }

    if (cursorContext.type === "chord") {
      return {
        title: "Chord at cursor",
        body: "You are on a chord token. Quick transpose and cleanup tools are available here.",
        tips: [
          "Alt+↑ and Alt+↓ transpose the selected chord or current line.",
          "Right-click a chord to transpose or remove it.",
          "Malformed chord spellings will show fix suggestions below the editor.",
        ],
      };
    }

    if (cursorContext.type === "lyrics") {
      return {
        title: "Lyric line help",
        body: "Select a lyric word first, then add a chord exactly where the singer will see it.",
        tips: [
          "Ctrl+K inserts chord brackets or opens the chord popup for a selection.",
          "Ctrl+/ wraps a line in {comment: ...} when you need rehearsal notes or labels.",
          "Blank lines help separate verses, choruses, and bridges visually.",
        ],
      };
    }

    return {
      title: "Editor guidance",
      body: "Move the cursor onto metadata, section headers, chords, or lyrics to see context-aware help.",
      tips: [
        "Ctrl+Space opens the command palette.",
        "F1 toggles the help/reference panel.",
        "Smart suggestions appear when the editor notices likely improvements.",
      ],
    };
  }, [cursorContext]);

  // Update current line on cursor movement
  const handleSelectionChange = useCallback((start: number, end: number) => {
    setSelectionRange({ start, end });
    setCursorPosition(start);
    setCurrentLine(editorSurfaceValue.slice(0, start).split("\n").length - 1);
  }, [editorSurfaceValue]);

  const updateCurrentLine = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    handleSelectionChange(ta.selectionStart, ta.selectionEnd);
  }, [handleSelectionChange]);

  const getActiveSelection = useCallback(() => {
    if (isRichEditorEnabled) {
      return richEditorRef.current?.getSelection() ?? selectionRange;
    }

    return {
      start: textareaRef.current?.selectionStart ?? selectionRange.start,
      end: textareaRef.current?.selectionEnd ?? selectionRange.end,
    };
  }, [isRichEditorEnabled, selectionRange]);

  const focusActiveEditor = useCallback(() => {
    if (isRichEditorEnabled) {
      richEditorRef.current?.focus();
      return;
    }

    textareaRef.current?.focus();
  }, [isRichEditorEnabled]);

  const applySelection = useCallback((start: number, end: number) => {
    if (isRichEditorEnabled) {
      if (!richEditorRef.current) {
        return false;
      }
      richEditorRef.current.setSelection(start, end);
      handleSelectionChange(start, end);
      return true;
    }

    const ta = textareaRef.current;
    if (!ta) {
      return false;
    }

    ta.focus();
    ta.setSelectionRange(start, end);
    handleSelectionChange(start, end);
    return true;
  }, [handleSelectionChange, isRichEditorEnabled]);

  const flushPendingSelection = useCallback(() => {
    if (!pendingSelectionRef.current) {
      return;
    }

    const pending = pendingSelectionRef.current;
    if (applySelection(pending.start, pending.end)) {
      pendingSelectionRef.current = null;
    }
  }, [applySelection]);

  const scheduleSelection = useCallback((start: number, end: number) => {
    pendingSelectionRef.current = { start, end };
    requestAnimationFrame(() => {
      flushPendingSelection();
    });
  }, [flushPendingSelection]);

  useEffect(() => {
    flushPendingSelection();
  }, [flushPendingSelection, value, isRichEditorEnabled]);

  // Sync gutter scroll with textarea
  const syncGutterScroll = useCallback(() => {
    const ta = textareaRef.current;
    const gutter = gutterRef.current;
    if (ta && gutter) {
      gutter.scrollTop = ta.scrollTop;
    }
  }, []);

  // ── Close dropdowns when clicking outside ──────
  useEffect(() => {
    function handleClickOutside(e: globalThis.MouseEvent) {
      if (
        sectionDropdownOpen &&
        dropdownRef.current &&
        sectionBtnRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !sectionBtnRef.current.contains(e.target as Node)
      ) {
        setSectionDropdownOpen(false);
      }
      if (
        chordPopup.open &&
        popupRef.current &&
        !popupRef.current.contains(e.target as Node)
      ) {
        setChordPopup((p) => ({ ...p, open: false }));
      }
      if (
        sectionNavOpen &&
        sectionNavDropdownRef.current &&
        sectionNavBtnRef.current &&
        !sectionNavDropdownRef.current.contains(e.target as Node) &&
        !sectionNavBtnRef.current.contains(e.target as Node)
      ) {
        setSectionNavOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [sectionDropdownOpen, chordPopup.open, sectionNavOpen]);

  // ── 1) Metadata → directive sync ──────────────
  // When metadata fields change, update/insert matching directives at
  // the top of the content so the user doesn't have to type them twice.
  const prevMetaRef = useRef(metadata);
  useEffect(() => {
    if (!metadata) return;
    const prev = prevMetaRef.current ?? {};
    prevMetaRef.current = metadata;

    // Only act when a metadata field actually changed
    const titleChanged = metadata.title !== prev.title;
    const artistChanged = metadata.artist !== prev.artist;
    const keyChanged = metadata.key !== prev.key;
    const tempoChanged = metadata.tempo !== prev.tempo;
    if (!titleChanged && !artistChanged && !keyChanged && !tempoChanged) return;

    let updated = value;

    const syncDirective = (tag: string, val: string | undefined) => {
      const re = new RegExp(`^\\{${tag}:\\s*.*\\}\\s*$`, "m");
      if (val?.trim()) {
        const directive = `{${tag}: ${val.trim()}}`;
        if (re.test(updated)) {
          updated = updated.replace(re, directive);
        } else {
          // Insert at top — after any existing directives block
          const lines = updated.split("\n");
          // Find last directive line at the top
          let insertIdx = 0;
          for (let i = 0; i < lines.length; i++) {
            if (/^\{[a-z_]+:/.test(lines[i].trim())) {
              insertIdx = i + 1;
            } else {
              break;
            }
          }
          lines.splice(insertIdx, 0, directive);
          updated = lines.join("\n");
        }
      }
    };

    if (titleChanged) syncDirective("title", metadata.title);
    if (artistChanged) syncDirective("artist", metadata.artist);
    if (keyChanged) syncDirective("key", metadata.key);
    if (tempoChanged) syncDirective("tempo", metadata.tempo);

    if (updated !== value) {
      onChange(updated);
    }
    // We intentionally only depend on metadata — value changes are driven
    // by the parent's onChange and we read `value` inside the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadata?.title, metadata?.artist, metadata?.key, metadata?.tempo, onChange]);

  // ── 2) Insert text at cursor ──────────────────
  const insertAtCursor = useCallback(
    (text: string) => {
      const start = getActiveSelection().start;
      const before = value.slice(0, start);
      const after = value.slice(start);

      // Ensure blank line before section header for readability
      const prefix = before.length > 0 && !before.endsWith("\n\n") && !before.endsWith("\n")
        ? "\n\n"
        : before.length > 0 && before.endsWith("\n") && !before.endsWith("\n\n")
          ? "\n"
          : "";
      const inserted = `${prefix}${text}\n`;
      const newValue = before + inserted + after;
      onChange(newValue);
      setSectionDropdownOpen(false);

      scheduleSelection(start + inserted.length, start + inserted.length);
    },
    [getActiveSelection, onChange, scheduleSelection, value],
  );

  // ── Command palette select handler ────────────
  const handleCommandSelect = useCallback(
    (item: CommandItem) => {
      // If triggered via slash command, remove the "/" (and any typed filter text)
      if (slashPosRef.current !== null) {
        const slashStart = slashPosRef.current;
        const cursorPos = getActiveSelection().start;
        // Remove everything from the slash to current cursor
        const before = value.slice(0, slashStart);
        const after = value.slice(cursorPos);
        const newValue = before + after;
        onChange(newValue);

        requestAnimationFrame(() => {
          focusActiveEditor();
          scheduleSelection(slashStart, slashStart);
          requestAnimationFrame(() => {
            insertAtCursor(item.value);
          });
        });
        slashPosRef.current = null;
      } else {
        insertAtCursor(item.value);
      }
    },
    [focusActiveEditor, getActiveSelection, insertAtCursor, onChange, scheduleSelection, value],
  );

  const handleCommandPaletteClose = useCallback(() => {
    setCommandPaletteOpen(false);
    setCommandPaletteQuery("");
    slashPosRef.current = null;
    focusActiveEditor();
  }, [focusActiveEditor]);

  const handleApplyValidationFix = useCallback(
    (issue: ValidationIssue) => {
      const lines = value.split("\n");
      const lineIndex = Math.max(0, issue.line - 1);
      const next = [...lines];

      switch (issue.code) {
        case "duplicate-directive":
          next.splice(lineIndex, 1);
          onChange(next.join("\n"));
          return;
        case "missing-metadata":
          onChange(applySmartSuggestion(value, {
            id: `fix-${issue.directiveName ?? "title"}`,
            type: "missing-metadata",
            line: 1,
            title: "",
            description: "",
            directiveName: (issue.directiveName === "artist" || issue.directiveName === "key" || issue.directiveName === "title")
              ? issue.directiveName
              : "title",
          }, metadata));
          return;
        case "malformed-chord":
          onChange(applySmartSuggestion(value, {
            id: `fix-${issue.line}-${issue.chordText ?? "chord"}`,
            type: "chord-correction",
            line: issue.line,
            title: "",
            description: "",
            originalChord: issue.chordText,
            suggestedChord: issue.suggestedValue,
          }, metadata));
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

  const handleApplySmartSuggestion = useCallback(
    (suggestion: ReturnType<typeof getSmartSuggestions>[number]) => {
      onChange(applySmartSuggestion(value, suggestion, metadata));
    },
    [metadata, onChange, value],
  );

  const handleSectionDrop = useCallback(
    (targetSectionId: string) => {
      if (!draggedSectionId || draggedSectionId === targetSectionId) {
        setDraggedSectionId(null);
        return;
      }

      onChange(reorderChordProSections(value, draggedSectionId, targetSectionId));
      setDraggedSectionId(null);
    },
    [draggedSectionId, onChange, value],
  );

  const handleSectionDuplicate = useCallback(
    (sectionId: string) => {
      onChange(duplicateChordProSection(value, sectionId));
    },
    [onChange, value],
  );

  const handleToggleSectionCollapse = useCallback((sectionId: string) => {
    setCollapsedSectionIds((current) => (
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId]
    ));
  }, []);

  // ── Jump to a specific line (for section nav) ──
  const jumpToLine = useCallback(
    (lineIndex: number) => {
      const lines = value.split("\n");
      let charPos = 0;
      for (let i = 0; i < lineIndex && i < lines.length; i++) {
        charPos += lines[i].length + 1; // +1 for \n
      }

      applySelection(charPos, charPos);
      if (!isRichEditorEnabled) {
        const ta = textareaRef.current;
        if (ta) {
          const lineHeight = 20;
          ta.scrollTop = Math.max(0, lineIndex * lineHeight - ta.clientHeight / 3);
        }
      }

      focusActiveEditor();
      setSectionNavOpen(false);
    },
    [applySelection, focusActiveEditor, isRichEditorEnabled, value],
  );

  // ── Context menu handler ──────────────────────
  const handleContextMenu = useCallback(
    (e: Pick<globalThis.MouseEvent, "preventDefault" | "clientX" | "clientY">) => {
      e.preventDefault();
      const cursorPos = getActiveSelection().start;
      const ctx = detectContext(value, cursorPos);
      const lines = value.split("\n");

      // Helper: get char offset of line start
      const lineOffset = (li: number) => {
        let off = 0;
        for (let i = 0; i < li && i < lines.length; i++) off += lines[i].length + 1;
        return off;
      };

      const groups: typeof contextMenu.groups = [];

      // ── Chord context actions ──
      if (ctx.type === "chord" && ctx.chord != null && ctx.chordStart != null && ctx.chordEnd != null) {
        const { chord, chordStart, chordEnd } = ctx;
        groups.push({
          label: "Chord",
          actions: [
            {
              label: "Transpose Up",
              shortcut: "Alt+↑",
              action: () => {
                const transposed = value.slice(chordStart, chordEnd).replace(
                  /\[([^\]]+)\]/g, (_m: string, c: string) => `[${transposeChord(c, 1)}]`
                );
                onChange(value.slice(0, chordStart) + transposed + value.slice(chordEnd));
              },
            },
            {
              label: "Transpose Down",
              shortcut: "Alt+↓",
              action: () => {
                const transposed = value.slice(chordStart, chordEnd).replace(
                  /\[([^\]]+)\]/g, (_m: string, c: string) => `[${transposeChord(c, -1)}]`
                );
                onChange(value.slice(0, chordStart) + transposed + value.slice(chordEnd));
              },
            },
            {
              label: "Remove Chord",
              action: () => {
                // Remove the [chord] brackets — keep any text after
                onChange(value.slice(0, chordStart) + value.slice(chordEnd));
              },
            },
          ],
        });
      }

      // ── Section header context actions ──
      if (ctx.type === "section") {
        const li = ctx.lineIndex;
        groups.push({
          label: "Section",
          actions: [
            {
              label: "Duplicate Section",
              action: () => {
                // Find the section block: from this line to the next section header (or end)
                let endLine = li + 1;
                while (endLine < lines.length) {
                  if (/^\{comment:\s*.*\}\s*$/.test(lines[endLine].trim()) && endLine > li + 1) break;
                  endLine++;
                }
                const sectionBlock = lines.slice(li, endLine).join("\n");
                const insertPos = lineOffset(endLine);
                onChange(value.slice(0, insertPos) + sectionBlock + "\n" + value.slice(insertPos));
              },
            },
            {
              label: "Move Section Up",
              action: () => {
                if (li === 0) return;
                // Find previous section start
                let prevStart = li - 1;
                while (prevStart > 0 && !/^\{comment:\s*.*\}\s*$/.test(lines[prevStart].trim())) {
                  prevStart--;
                }
                const newLines = [...lines];
                // Find current section block end
                let endLine = li + 1;
                while (endLine < lines.length && !/^\{comment:\s*.*\}\s*$/.test(lines[endLine].trim())) {
                  endLine++;
                }
                const block = newLines.splice(li, endLine - li);
                newLines.splice(prevStart, 0, ...block);
                onChange(newLines.join("\n"));
              },
            },
            {
              label: "Move Section Down",
              action: () => {
                // Find current section block end
                let endLine = li + 1;
                while (endLine < lines.length && !/^\{comment:\s*.*\}\s*$/.test(lines[endLine].trim())) {
                  endLine++;
                }
                if (endLine >= lines.length) return;
                // Find next section block end
                let nextEnd = endLine + 1;
                while (nextEnd < lines.length && !/^\{comment:\s*.*\}\s*$/.test(lines[nextEnd].trim())) {
                  nextEnd++;
                }
                const newLines = [...lines];
                const block = newLines.splice(li, endLine - li);
                const insertAt = Math.min(nextEnd - block.length, newLines.length);
                newLines.splice(insertAt < 0 ? 0 : insertAt, 0, ...block);
                onChange(newLines.join("\n"));
              },
            },
          ],
        });
      }

      // ── Lyrics context actions ──
      if (ctx.type === "lyrics") {
        groups.push({
          label: "Lyrics",
          actions: [
            {
              label: "Insert Chord",
              shortcut: "Ctrl+K",
              action: () => {
                const newValue = value.slice(0, cursorPos) + "[]" + value.slice(cursorPos);
                onChange(newValue);
                scheduleSelection(cursorPos + 1, cursorPos + 1);
              },
            },
            {
              label: "Convert to Comment",
              shortcut: "Ctrl+/",
              action: () => {
                const li = ctx.lineIndex;
                const trimmed = lines[li].trim();
                if (!/^\{comment:/.test(trimmed)) {
                  const newLines = [...lines];
                  newLines[li] = `{comment: ${trimmed}}`;
                  onChange(newLines.join("\n"));
                }
              },
            },
          ],
        });
      }

      // ── General line actions (always shown) ──
      groups.push({
        label: "Line",
        actions: [
          {
            label: "Insert Line Above",
            action: () => {
              const pos = lineOffset(ctx.lineIndex);
              onChange(value.slice(0, pos) + "\n" + value.slice(pos));
              scheduleSelection(pos, pos);
            },
          },
          {
            label: "Insert Line Below",
            action: () => {
              const pos = lineOffset(ctx.lineIndex) + lines[ctx.lineIndex].length;
              onChange(value.slice(0, pos) + "\n" + value.slice(pos));
              scheduleSelection(pos + 1, pos + 1);
            },
          },
          {
            label: "Duplicate Line",
            action: () => {
              const pos = lineOffset(ctx.lineIndex) + lines[ctx.lineIndex].length;
              onChange(value.slice(0, pos) + "\n" + lines[ctx.lineIndex] + value.slice(pos));
            },
          },
          {
            label: "Delete Line",
            action: () => {
              const newLines = [...lines];
              newLines.splice(ctx.lineIndex, 1);
              onChange(newLines.join("\n"));
            },
          },
        ],
      });

      setContextMenu({
        open: true,
        position: { x: e.clientX, y: e.clientY },
        groups,
      });
    },
    [getActiveSelection, onChange, scheduleSelection, value],
  );

  // ── 3) Chord popup on text selection ──────────
  const handleMouseUp = useCallback(() => {
    const { start: selectionStart, end: selectionEnd } = getActiveSelection();
    if (selectionStart === selectionEnd) return; // no selection

    const rect = isRichEditorEnabled
      ? richEditorRef.current?.getDomRect()
      : textareaRef.current?.getBoundingClientRect();
    if (!rect) return;

    const scrollTop = isRichEditorEnabled
      ? richEditorRef.current?.getScrollMetrics().top ?? 0
      : textareaRef.current?.scrollTop ?? 0;

    // Use a rough approximation: character position → pixel offset
    const linesBefore = value.slice(0, selectionStart).split("\n");
    const lineHeight = 20; // approximation for font-mono text-sm
    const charWidth = 8;
    const row = linesBefore.length - 1;
    const col = linesBefore[linesBefore.length - 1].length;

    const x = Math.min(rect.width - 180, Math.max(0, col * charWidth));
    const y = Math.min(rect.height - 40, Math.max(0, (row + 1) * lineHeight - scrollTop));

    setChordPopup({
      open: true,
      x,
      y,
      selStart: selectionStart,
      selEnd: selectionEnd,
    });
    setChordInput("");
    requestAnimationFrame(() => chordInputRef.current?.focus());
  }, [getActiveSelection, isRichEditorEnabled, value]);

  const applyChord = useCallback(() => {
    const chord = chordInput.trim();
    if (!chord) {
      setChordPopup((p) => ({ ...p, open: false }));
      return;
    }
    const { selStart, selEnd } = chordPopup;
    const selectedText = value.slice(selStart, selEnd);
    const newValue =
      value.slice(0, selStart) + `[${chord}]${selectedText}` + value.slice(selEnd);
    onChange(newValue);
    setChordPopup((p) => ({ ...p, open: false }));

    // Restore cursor after the inserted chord+text
    requestAnimationFrame(() => {
      const pos = selStart + chord.length + 2 + selectedText.length;
      focusActiveEditor();
      scheduleSelection(pos, pos);
    });
  }, [chordInput, chordPopup, focusActiveEditor, onChange, scheduleSelection, value]);

  const handleChordKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyChord();
      } else if (e.key === "Escape") {
        setChordPopup((p) => ({ ...p, open: false }));
        focusActiveEditor();
      }
    },
    [applyChord, focusActiveEditor],
  );

  const toggleCommentSelection = useCallback(() => {
    const { start: selectionStart, end: selectionEnd } = getActiveSelection();
    const lines = value.split("\n");
    let charIdx = 0;
    let startLine = 0;
    let endLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineEnd = charIdx + lines[i].length;
      if (charIdx <= selectionStart && selectionStart <= lineEnd + 1) startLine = i;
      if (charIdx <= selectionEnd && selectionEnd <= lineEnd + 1) endLine = i;
      charIdx = lineEnd + 1;
    }

    const allComments = lines.slice(startLine, endLine + 1).every((line) =>
      /^\{comment:\s*.*\}$/.test(line.trim()),
    );
    const newLines = [...lines];
    for (let i = startLine; i <= endLine; i++) {
      const trimmed = newLines[i].trim();
      if (allComments) {
        const match = trimmed.match(/^\{comment:\s*(.*)\}$/);
        newLines[i] = match ? match[1] : trimmed;
      } else if (trimmed && !/^\{comment:/.test(trimmed)) {
        newLines[i] = `{comment: ${trimmed}}`;
      }
    }

    onChange(newLines.join("\n"));
  }, [getActiveSelection, onChange, value]);

  const insertEmptyChordAtCursor = useCallback(() => {
    const { start: selectionStart } = getActiveSelection();
    const newValue = value.slice(0, selectionStart) + "[]" + value.slice(selectionStart);
    onChange(newValue);
    scheduleSelection(selectionStart + 1, selectionStart + 1);
  }, [getActiveSelection, onChange, scheduleSelection, value]);

  const transposeSelection = useCallback((steps: number) => {
    const { start, end } = getActiveSelection();
    let rangeStart = start;
    let rangeEnd = end;

    if (rangeStart === rangeEnd) {
      const lineStart = value.lastIndexOf("\n", rangeStart - 1) + 1;
      const lineEnd = value.indexOf("\n", rangeStart);
      rangeStart = lineStart;
      rangeEnd = lineEnd === -1 ? value.length : lineEnd;
    }

    const selectedText = value.slice(rangeStart, rangeEnd);
    const transposed = selectedText.replace(/\[([^\]]+)\]/g, (_m: string, chord: string) => {
      return `[${transposeChord(chord, steps)}]`;
    });

    if (transposed !== selectedText) {
      const newValue = value.slice(0, rangeStart) + transposed + value.slice(rangeEnd);
      onChange(newValue);
      scheduleSelection(rangeStart, rangeStart + transposed.length);
    }
  }, [getActiveSelection, onChange, scheduleSelection, value]);

  // ── 4) Keyboard shortcuts on the textarea ─────
  const handleEditorKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement> | globalThis.KeyboardEvent) => {
      // Ctrl+S — save (with optional format-on-save)
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (formatOnSave) {
          const formatted = formatChordPro(value);
          if (formatted !== value) onChange(formatted);
        }
        onSave?.();
        return;
      }

      // Ctrl+Space — open command palette
      if ((e.ctrlKey || e.metaKey) && e.key === " ") {
        e.preventDefault();
        slashPosRef.current = null;
        setCommandPaletteQuery("");
        setCommandPaletteOpen(true);
        return;
      }

      // F1 — toggle help panel
      if (e.key === "F1") {
        e.preventDefault();
        setHelpOpen((prev) => !(prev ?? false));
        return;
      }

      // Ctrl+Shift+F — format document
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        handleFormat();
        return;
      }

      // Ctrl+P — open section navigator
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "p") {
        if (sections.length > 0) {
          e.preventDefault();
          setSectionNavOpen(true);
        }
        return;
      }

      // Ctrl+1 / Ctrl+2 / Ctrl+3 — jump to common sections
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && ["1", "2", "3"].includes(e.key)) {
        e.preventDefault();
        const line = e.key === "1"
          ? findSectionLine(/^verse/i)
          : e.key === "2"
            ? findSectionLine(/^chorus/i)
            : findSectionLine(/^bridge/i);
        if (line !== null) {
          jumpToLine(line);
        }
        return;
      }

      // Ctrl+/ — toggle comment on selected line(s)
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        toggleCommentSelection();
        return;
      }

      // Ctrl+K — insert chord at cursor / on selection
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const { start: selectionStart, end: selectionEnd } = getActiveSelection();
        if (selectionStart !== selectionEnd) {
          // Trigger chord popup at selection
          handleMouseUp();
        } else {
          insertEmptyChordAtCursor();
        }
        return;
      }

      // Ctrl+Shift+V — insert Verse header
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "V") {
        e.preventDefault();
        insertAtCursor("{comment: Verse}");
        return;
      }

      // Ctrl+Shift+C — insert Chorus header
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "C") {
        e.preventDefault();
        insertAtCursor("{comment: Chorus}");
        return;
      }

      // Ctrl+Shift+B — insert Bridge header
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "B") {
        e.preventDefault();
        insertAtCursor("{comment: Bridge}");
        return;
      }

      // Alt+Up / Alt+Down — transpose selected chord(s) up/down one semitone
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        transposeSelection(e.key === "ArrowUp" ? 1 : -1);
        return;
      }
    },
    [findSectionLine, formatOnSave, getActiveSelection, handleFormat, handleMouseUp, insertAtCursor, insertEmptyChordAtCursor, jumpToLine, onSave, sections.length, toggleCommentSelection, transposeSelection],
  );

  // ── Sync overlay scroll with textarea (and optionally preview) ──
  const overlayRef = useRef<HTMLPreElement | null>(null);
  const handleScroll = useCallback(() => {
    const ta = textareaRef.current;
    const overlay = overlayRef.current;
    if (ta && overlay) {
      overlay.scrollTop = ta.scrollTop;
      overlay.scrollLeft = ta.scrollLeft;
    }
    syncGutterScroll();
    // Optionally sync preview in split mode
    if (viewMode === "split" && ta && previewRef.current) {
      const scrollRatio = ta.scrollTop / (ta.scrollHeight - ta.clientHeight || 1);
      const previewEl = previewRef.current;
      previewEl.scrollTop = scrollRatio * (previewEl.scrollHeight - previewEl.clientHeight);
    }
  }, [viewMode, syncGutterScroll]);

  const handleRichEditorScroll = useCallback((metrics: {
    top: number;
    left: number;
    scrollHeight: number;
    clientHeight: number;
  }) => {
    if (viewMode === "split" && previewRef.current) {
      const scrollRatio = metrics.top / (metrics.scrollHeight - metrics.clientHeight || 1);
      const previewEl = previewRef.current;
      previewEl.scrollTop = scrollRatio * (previewEl.scrollHeight - previewEl.clientHeight);
    }
  }, [viewMode]);

  // Quick chord validation for the visual indicator
  const isValidChord = chordInput.trim()
    ? CHORD_REGEX.test(chordInput.trim()) || /^[A-G]/.test(chordInput.trim())
    : null;
  const isBeginnerMode = editorMode === "beginner";
  const showPowerTools = !isBeginnerMode;

  // ── Slash-command detection on change ─────────
  const handleEditorValueChange = useCallback((newValue: string, cursor: number) => {
      onChange(newValue);

      // Detect "/" typed at line start → open command palette
      if (cursor > 0 && newValue[cursor - 1] === "/") {
        const lineStart = newValue.lastIndexOf("\n", cursor - 2) + 1;
        const textBefore = newValue.slice(lineStart, cursor - 1).trim();
        if (textBefore === "") {
          slashPosRef.current = cursor - 1; // position of the "/"
          setCommandPaletteQuery("");
          setCommandPaletteOpen(true);
        }
      }
  },
    [onChange],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      handleEditorValueChange(e.target.value, e.target.selectionStart);
    },
    [handleEditorValueChange],
  );

  return (
    <div className="space-y-2" role="region" aria-label="ChordPro editor">
      {/* Toolbar */}
      <div className="sticky top-16 z-20 -mx-2 rounded-lg border border-transparent bg-[hsl(var(--background))/0.95] px-2 py-2 backdrop-blur supports-backdrop-filter:bg-[hsl(var(--background))/0.85] md:mx-0" data-testid="editor-toolbar">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium text-[hsl(var(--foreground))]">
          Content (ChordPro format)
        </label>

        <div className="ml-auto flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center rounded-md border border-[hsl(var(--border))]" data-testid="view-mode-toggle">
            <button
              type="button"
              onClick={() => setViewMode("edit")}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors rounded-l-md ${
                viewMode === "edit"
                  ? "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
              title="Editor only"
              data-testid="view-mode-edit"
              aria-label="Switch to editor-only mode"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
            {showPowerTools && (
              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={`inline-flex items-center gap-1 border-x border-[hsl(var(--border))] px-2 py-1 text-xs font-medium transition-colors ${
                  viewMode === "split"
                    ? "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
                title="Split view"
                data-testid="view-mode-split"
                aria-label="Switch to split editor and preview mode"
              >
                <Columns className="h-3 w-3" />
                Split
              </button>
            )}
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors ${
                viewMode === "preview"
                  ? "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              } ${showPowerTools ? "rounded-r-md" : "border-l border-[hsl(var(--border))] rounded-r-md"}`}
              title="Preview only"
              data-testid="view-mode-preview"
              aria-label="Switch to preview-only mode"
            >
              <Eye className="h-3 w-3" />
              Preview
            </button>
          </div>

          {/* Section insert dropdown (hidden in preview-only mode) */}
          {viewMode !== "preview" && (
            <>
              {showPowerTools && (
                <>
                  {/* Format button */}
                  <button
                    type="button"
                    onClick={handleFormat}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                    title="Format document (normalize directives, spacing, etc.)"
                    data-testid="format-btn"
                    aria-label="Format ChordPro document"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    Format
                  </button>

                  {/* Format on save toggle */}
                  <label
                    className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]"
                    title="Auto-format when saving"
                    data-testid="format-on-save-label"
                  >
                    <input
                      type="checkbox"
                      checked={formatOnSave}
                      onChange={(e) => setFormatOnSave(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[hsl(var(--secondary))]"
                      data-testid="format-on-save-checkbox"
                      aria-label="Auto-format document on save"
                    />
                    Auto
                  </label>

                  {/* Section navigation dropdown */}
                  {sections.length > 0 && (
                    <div className="relative">
                      <button
                        ref={sectionNavBtnRef}
                        type="button"
                        onClick={() => setSectionNavOpen((o) => !o)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                        data-testid="section-nav-btn"
                        aria-label="Open section navigation menu"
                        aria-expanded={sectionNavOpen}
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        Go to Section
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      {sectionNavOpen && (
                        <div
                          ref={sectionNavDropdownRef}
                          className="fixed inset-x-4 bottom-4 z-50 max-h-[45vh] overflow-y-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--popover))] py-1 shadow-lg md:absolute md:right-0 md:inset-x-auto md:bottom-auto md:mt-1 md:max-h-64 md:w-48"
                          data-testid="section-nav-dropdown"
                          role="dialog"
                          aria-label="Section navigation"
                        >
                          {sections.map((sec) => (
                            <button
                              key={`${sec.name}-${sec.line}`}
                              type="button"
                              onClick={() => jumpToLine(sec.line)}
                              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-[hsl(var(--popover-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] transition-colors"
                            >
                              <span>{sec.name}</span>
                              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                Ln {sec.line + 1}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              <div className="relative">
              <button
                ref={sectionBtnRef}
                type="button"
                onClick={() => setSectionDropdownOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                data-testid="section-insert-btn"
                aria-label="Open insert section menu"
                aria-expanded={sectionDropdownOpen}
              >
                <Music className="h-3.5 w-3.5" />
                {isBeginnerMode ? "Insert" : "Insert Section"}
                <ChevronDown className="h-3 w-3" />
              </button>
              {sectionDropdownOpen && (
                <div className="relative">
                  <div
                    ref={dropdownRef}
                    className="fixed inset-x-4 bottom-4 z-50 max-h-[45vh] overflow-y-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--popover))] py-1 shadow-lg md:absolute md:right-0 md:inset-x-auto md:bottom-auto md:mt-1 md:max-h-64 md:w-48"
                    data-testid="section-dropdown"
                    role="dialog"
                    aria-label="Insert section options"
                  >
                    {SECTION_INSERTS.map(({ label, value: v }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => insertAtCursor(v)}
                        className="w-full px-3 py-1.5 text-left text-sm text-[hsl(var(--popover-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            </>
          )}
        </div>
      </div>
      </div>

      {/* Hint (hidden in preview-only mode) */}
      {viewMode !== "preview" && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {isBeginnerMode ? (
            <>
              Start with an example below, keep the help panel open while you learn, and use the Insert menu for common song sections.
            </>
          ) : (
            <>
              Select any word and type a chord to insert it • Use the dropdown to add section markers • <kbd className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-1 py-0.5 text-[10px] font-mono">Ctrl+Space</kbd> command palette • <kbd className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-1 py-0.5 text-[10px] font-mono">/</kbd> slash commands • <kbd className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-1 py-0.5 text-[10px] font-mono">Ctrl+Shift+F</kbd> format • <kbd className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-1 py-0.5 text-[10px] font-mono">F1</kbd> help • <kbd className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-1 py-0.5 text-[10px] font-mono">Ctrl+S</kbd> to save
            </>
          )}
        </p>
      )}

      {viewMode !== "preview" && isBeginnerMode && (
        <div
          className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/60 p-3"
          data-testid="beginner-example-panel"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[hsl(var(--foreground))]">Beginner tools</p>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Examples stay visible by default so you can build a song without memorizing directives first.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="btn-outline btn-sm"
            >
              Open Help
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {BEGINNER_EXAMPLES.map((example) => (
              <button
                key={example.label}
                type="button"
                onClick={() => insertAtCursor(example.value)}
                className="btn-outline btn-sm"
              >
                {example.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {viewMode !== "preview" && showPowerTools && (
        <div
          className="flex flex-wrap gap-2 text-xs text-[hsl(var(--muted-foreground))]"
          data-testid="advanced-shortcuts"
        >
          <span className="rounded-full border border-[hsl(var(--border))] px-2 py-1">Ctrl+Space palette</span>
          <span className="rounded-full border border-[hsl(var(--border))] px-2 py-1">/ slash commands</span>
          <span className="rounded-full border border-[hsl(var(--border))] px-2 py-1">Ctrl+Shift+F format</span>
          <span className="rounded-full border border-[hsl(var(--border))] px-2 py-1">Alt+↑/↓ transpose</span>
        </div>
      )}

      {viewMode !== "preview" && showPowerTools && (
        <CursorContextHelp
          title={cursorHelp.title}
          body={cursorHelp.body}
          tips={cursorHelp.tips}
        />
      )}

      <SmartSuggestionsPanel
        suggestions={smartSuggestions}
        onApplySuggestion={handleApplySmartSuggestion}
      />

      {viewMode !== "preview" && showPowerTools && organizedSections.length > 0 && (
        <SectionOrganizer
          sections={organizedSections}
          draggedSectionId={draggedSectionId}
          collapsedSectionIds={collapsedSectionIds}
          onDragStart={setDraggedSectionId}
          onDrop={handleSectionDrop}
          onDuplicate={handleSectionDuplicate}
          onToggleCollapse={handleToggleSectionCollapse}
          onJumpToLine={jumpToLine}
        />
      )}

      {collapsedSectionIds.length > 0 && viewMode !== "preview" && (
        <div
          className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/70 px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]"
          data-testid="collapsed-sections-banner"
        >
          {collapsedSectionIds.length} section{collapsedSectionIds.length === 1 ? " is" : "s are"} folded in the editor view. Expand them from the section organizer to resume direct source editing.
        </div>
      )}

      {viewMode !== "preview" && sections.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1" data-testid="section-chip-bar" aria-label="Quick section navigation">
          {sections.map((section) => (
            <button
              key={`${section.name}-${section.line}`}
              type="button"
              onClick={() => jumpToLine(section.line)}
              className="btn-outline btn-sm whitespace-nowrap"
              aria-label={`Jump to section ${section.name}`}
            >
              {section.name}
            </button>
          ))}
        </div>
      )}

      {/* Editor / Preview content area */}
      <div className={viewMode === "split" ? "grid grid-cols-2 gap-4" : ""}>
        {/* ── Editor pane (hidden in preview-only mode) ── */}
        {viewMode !== "preview" && (
          <div className="relative">
            {isRichEditorEnabled ? (
              <ChordProRichEditorSurface
                ref={richEditorRef}
                value={editorSurfaceValue}
                onValueChange={handleEditorValueChange}
                onSelectionChange={handleSelectionChange}
                onScrollChange={handleRichEditorScroll}
                onKeyDown={handleEditorKeyDown}
                onMouseUp={handleMouseUp}
                onContextMenu={handleContextMenu}
                readOnly={collapsedSectionIds.length > 0}
                placeholderText={`{title: Amazing Grace}
{key: G}

{comment: Verse 1}
[G]Amazing [G/B]grace, how [C]sweet the [G]sound
That [G]saved a [Em]wretch like [D]me`}
              />
            ) : (
              <div className="relative flex">
                {/* Line number gutter */}
                <div
                  ref={gutterRef}
                  className="pointer-events-none select-none overflow-hidden rounded-l-md border-r border-[hsl(var(--border))] bg-[hsl(var(--muted))] py-2 pr-2 text-right font-mono text-xs leading-5 text-[hsl(var(--muted-foreground))]"
                  style={{ minWidth: `${Math.max(2, String(lineCount).length) * 0.75 + 0.75}rem` }}
                  aria-hidden="true"
                  data-testid="line-number-gutter"
                >
                  {Array.from({ length: lineCount }, (_, i) => (
                    <div
                      key={i}
                      className={`px-1 ${i === currentLine ? "text-[hsl(var(--foreground))] font-medium" : ""}`}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>

                {/* Editor area (overlay + textarea) */}
                <div className="relative flex-1">
                  {/* Current line highlight */}
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-5 bg-[hsl(var(--accent))]/10"
                    style={{
                      top: `${currentLine * 20 + 8 - (textareaRef.current?.scrollTop ?? 0)}px`,
                      height: "20px",
                    }}
                    data-testid="current-line-highlight"
                  />

                  {/* Syntax highlight overlay */}
                  <SyntaxHighlightOverlay value={editorSurfaceValue} ref={overlayRef} />

                  <textarea
                    ref={textareaRef}
                    value={editorSurfaceValue}
                    onChange={handleChange}
                    onMouseUp={() => { handleMouseUp(); updateCurrentLine(); }}
                    onKeyDown={handleEditorKeyDown}
                    onKeyUp={updateCurrentLine}
                    onClick={updateCurrentLine}
                    onContextMenu={handleContextMenu}
                    onScroll={handleScroll}
                    rows={20}
                    spellCheck={false}
                    readOnly={collapsedSectionIds.length > 0}
                    className="relative z-10 w-full rounded-r-md border border-l-0 border-[hsl(var(--input))] bg-transparent px-3 py-2 font-mono text-sm leading-5 text-transparent caret-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                    placeholder={`{title: Amazing Grace}
{key: G}

{comment: Verse 1}
[G]Amazing [G/B]grace, how [C]sweet the [G]sound
That [G]saved a [Em]wretch like [D]me`}
                    data-testid="chordpro-editor"
                    aria-label="ChordPro song content editor"
                  />
                </div>
              </div>
            )}

              {/* ── Chord popup ────────────────────────── */}
              {chordPopup.open && (
                <div
                  ref={popupRef}
                  className="absolute z-50 flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-2 shadow-xl"
                  style={{ left: chordPopup.x, top: chordPopup.y }}
                  data-testid="chord-popup"
                  role="dialog"
                  aria-modal="false"
                  aria-label="Insert chord"
                >
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">Chord:</span>
                  <input
                    ref={chordInputRef}
                    type="text"
                    value={chordInput}
                    onChange={(e) => setChordInput(e.target.value)}
                    onKeyDown={handleChordKeyDown}
                    placeholder="e.g. Am7, C/G"
                    className={`w-28 rounded border px-2 py-1 font-mono text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-1 ${
                      isValidChord === null
                        ? "border-[hsl(var(--input))] bg-[hsl(var(--background))]"
                        : isValidChord
                          ? "border-green-500 bg-green-500/10"
                          : "border-amber-500 bg-amber-500/10"
                    }`}
                    data-testid="chord-input"
                    aria-label="Chord name"
                  />
                  <button
                    type="button"
                    onClick={applyChord}
                    disabled={!chordInput.trim()}
                    className="rounded-md bg-[hsl(var(--secondary))] px-2.5 py-1 text-xs font-medium text-[hsl(var(--secondary-foreground))] hover:opacity-90 disabled:opacity-40 transition-opacity"
                    data-testid="chord-apply-btn"
                    aria-label="Apply chord insertion"
                  >
                    Apply
                  </button>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    Enter ↵
                  </span>
                </div>
              )}

          </div>
        )}

        {/* ── Preview pane (visible in split and preview modes) ── */}
        {viewMode !== "edit" && (
          <div
            ref={previewRef}
            className={`song-surface overflow-y-auto rounded-md border border-[hsl(var(--border))] p-4 ${
              viewMode === "split" ? "max-h-[calc(20*20px+1rem)]" : ""
            }`}
            style={viewMode === "split" ? { maxHeight: "calc(20 * 20px + 1rem)" } : undefined}
            data-testid="split-preview-pane"
          >
            {value.trim() ? (
              <ChordProRenderer
                content={value}
                songKey={metadata?.key}
                showChords
                fontSize={14}
              />
            ) : (
              <p className="text-sm italic opacity-60">
                Start typing in the editor to see a live preview…
              </p>
            )}
          </div>
        )}
      </div>

      {/* Validation panel */}
      <ValidationPanel source={value} onApplyFix={handleApplyValidationFix} />

      {/* Collapsible help section */}
      <EditorHelpSection onInsertTemplate={insertAtCursor} open={helpOpen} onOpenChange={setHelpOpen} />

      {/* Context menu */}
      <EditorContextMenu
        open={contextMenu.open}
        position={contextMenu.position}
        groups={contextMenu.groups}
        onClose={() => setContextMenu((m) => ({ ...m, open: false }))}
      />

      {/* Command palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={handleCommandPaletteClose}
        onSelect={handleCommandSelect}
        initialQuery={commandPaletteQuery}
      />
    </div>
  );
}
