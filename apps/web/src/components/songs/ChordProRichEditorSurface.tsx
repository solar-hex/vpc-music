import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { EditorState, RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { lintGutter, linter, type Diagnostic } from "@codemirror/lint";
import { defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands";
import { basicSetup } from "codemirror";
import { tokenizeLine } from "@/utils/chordpro-highlight";
import { validateChordPro } from "@/utils/chordpro-validate";

export interface ChordProRichEditorHandle {
  focus: () => void;
  getSelection: () => { start: number; end: number };
  setSelection: (start: number, end: number) => void;
  getScrollMetrics: () => {
    top: number;
    left: number;
    scrollHeight: number;
    clientHeight: number;
  };
  setScrollTop: (top: number) => void;
  getDomRect: () => DOMRect | null;
}

interface ChordProRichEditorSurfaceProps {
  value: string;
  onValueChange: (value: string, selectionStart: number, selectionEnd: number) => void;
  onSelectionChange: (start: number, end: number) => void;
  onScrollChange?: (metrics: {
    top: number;
    left: number;
    scrollHeight: number;
    clientHeight: number;
  }) => void;
  onKeyDown?: (event: globalThis.KeyboardEvent) => void;
  onMouseUp?: (event: globalThis.MouseEvent) => void;
  onContextMenu?: (event: globalThis.MouseEvent) => void;
  readOnly?: boolean;
  placeholderText?: string;
}

const TOKEN_CLASS_MAP: Record<string, string> = {
  chord: "song-primary-chord font-bold",
  directive: "text-sky-400",
  section: "song-secondary-chord font-bold italic",
  lyrics: "text-[hsl(var(--foreground))]",
  invalid: "text-red-400 underline decoration-wavy decoration-red-400",
};

function buildChordProDecorations(view: EditorView) {
  const builder = new RangeSetBuilder<Decoration>();

  for (let lineNumber = 1; lineNumber <= view.state.doc.lines; lineNumber++) {
    const line = view.state.doc.line(lineNumber);
    const tokens = tokenizeLine(line.text);
    let offset = line.from;

    for (const token of tokens) {
      const tokenLength = token.text.length;
      const className = TOKEN_CLASS_MAP[token.type];
      if (tokenLength > 0 && className) {
        builder.add(offset, offset + tokenLength, Decoration.mark({ class: className }));
      }
      offset += tokenLength;
    }
  }

  return builder.finish();
}

const chordProHighlightPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = buildChordProDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = buildChordProDecorations(update.view);
    }
  }
}, {
  decorations: (value) => value.decorations,
});

const chordProLinter = linter((view): Diagnostic[] => {
  return validateChordPro(view.state.doc.toString()).map((issue) => {
    const line = view.state.doc.line(issue.line);
    return {
      from: line.from,
      to: Math.max(line.from + 1, line.from),
      severity: issue.severity,
      message: issue.message,
    };
  });
});

const chordProTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "hsl(var(--foreground))",
    fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
    borderRadius: "0.375rem",
    border: "1px solid hsl(var(--input))",
  },
  ".cm-scroller": {
    overflow: "auto",
    minHeight: "calc(20 * 20px + 1rem)",
    maxHeight: "calc(20 * 20px + 1rem)",
    padding: "0.5rem 0",
  },
  ".cm-content": {
    padding: "0 0.75rem 0.5rem 0.75rem",
    caretColor: "hsl(var(--foreground))",
  },
  ".cm-gutters": {
    backgroundColor: "hsl(var(--muted))",
    color: "hsl(var(--muted-foreground))",
    borderRight: "1px solid hsl(var(--border))",
  },
  ".cm-activeLine": {
    backgroundColor: "hsl(var(--accent) / 0.10)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "hsl(var(--accent) / 0.18)",
    color: "hsl(var(--foreground))",
    fontWeight: "600",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "hsl(var(--secondary) / 0.28)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "hsl(var(--foreground))",
  },
  ".cm-focused": {
    outline: "2px solid hsl(var(--ring))",
    outlineOffset: "2px",
  },
  ".cm-placeholder": {
    color: "hsl(var(--muted-foreground))",
  },
});

export const ChordProRichEditorSurface = forwardRef<ChordProRichEditorHandle, ChordProRichEditorSurfaceProps>(
  function ChordProRichEditorSurface(
    {
      value,
      onValueChange,
      onSelectionChange,
      onScrollChange,
      onKeyDown,
      onMouseUp,
      onContextMenu,
      readOnly = false,
      placeholderText,
    },
    ref,
  ) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const applyingExternalChangeRef = useRef(false);

    const onValueChangeRef = useRef(onValueChange);
    const onSelectionChangeRef = useRef(onSelectionChange);
    const onScrollChangeRef = useRef(onScrollChange);
    const onKeyDownRef = useRef(onKeyDown);
    const onMouseUpRef = useRef(onMouseUp);
    const onContextMenuRef = useRef(onContextMenu);

    useEffect(() => {
      onValueChangeRef.current = onValueChange;
      onSelectionChangeRef.current = onSelectionChange;
      onScrollChangeRef.current = onScrollChange;
      onKeyDownRef.current = onKeyDown;
      onMouseUpRef.current = onMouseUp;
      onContextMenuRef.current = onContextMenu;
    }, [onContextMenu, onKeyDown, onMouseUp, onScrollChange, onSelectionChange, onValueChange]);

    const extensions = useMemo<Extension[]>(() => {
      return [
        basicSetup,
        drawSelection(),
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        EditorState.readOnly.of(readOnly),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          "data-testid": "chordpro-editor",
          "aria-label": "ChordPro song content editor",
        }),
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
        chordProTheme,
        chordProHighlightPlugin,
        chordProLinter,
        lintGutter(),
        ...(placeholderText ? [placeholder(placeholderText)] : []),
        EditorView.updateListener.of((update) => {
          const selection = update.state.selection.main;
          onSelectionChangeRef.current(selection.from, selection.to);

          if (update.docChanged && !applyingExternalChangeRef.current) {
            onValueChangeRef.current(update.state.doc.toString(), selection.from, selection.to);
          }
        }),
        EditorView.domEventHandlers({
          keydown: (event) => {
            onKeyDownRef.current?.(event);
            return event.defaultPrevented;
          },
          mouseup: (event) => {
            onMouseUpRef.current?.(event);
            return false;
          },
          contextmenu: (event) => {
            onContextMenuRef.current?.(event);
            return false;
          },
        }),
      ];
    }, [placeholderText, readOnly]);

    useEffect(() => {
      if (!hostRef.current) {
        return;
      }

      const state = EditorState.create({
        doc: value,
        extensions,
      });
      const view = new EditorView({ state, parent: hostRef.current });

      const handleScroll = () => {
        onScrollChangeRef.current?.({
          top: view.scrollDOM.scrollTop,
          left: view.scrollDOM.scrollLeft,
          scrollHeight: view.scrollDOM.scrollHeight,
          clientHeight: view.scrollDOM.clientHeight,
        });
      };

      view.scrollDOM.addEventListener("scroll", handleScroll, { passive: true });
      handleScroll();
      const selection = view.state.selection.main;
      onSelectionChangeRef.current(selection.from, selection.to);
      viewRef.current = view;

      return () => {
        view.scrollDOM.removeEventListener("scroll", handleScroll);
        view.destroy();
        viewRef.current = null;
      };
      // The document is seeded once here; later `value` changes are applied by the effect below.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [extensions]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) {
        return;
      }

      const currentValue = view.state.doc.toString();
      if (currentValue === value) {
        return;
      }

      const selection = view.state.selection.main;
      applyingExternalChangeRef.current = true;
      view.dispatch({
        changes: { from: 0, to: currentValue.length, insert: value },
        selection: {
          anchor: Math.min(selection.from, value.length),
          head: Math.min(selection.to, value.length),
        },
      });
      applyingExternalChangeRef.current = false;
    }, [value]);

    useImperativeHandle(ref, () => ({
      focus: () => {
        viewRef.current?.focus();
      },
      getSelection: () => {
        const selection = viewRef.current?.state.selection.main;
        return {
          start: selection?.from ?? 0,
          end: selection?.to ?? 0,
        };
      },
      setSelection: (start, end) => {
        const view = viewRef.current;
        if (!view) {
          return;
        }
        view.dispatch({
          selection: { anchor: start, head: end },
          scrollIntoView: true,
        });
        view.focus();
      },
      getScrollMetrics: () => {
        const scrollDOM = viewRef.current?.scrollDOM;
        return {
          top: scrollDOM?.scrollTop ?? 0,
          left: scrollDOM?.scrollLeft ?? 0,
          scrollHeight: scrollDOM?.scrollHeight ?? 0,
          clientHeight: scrollDOM?.clientHeight ?? 0,
        };
      },
      setScrollTop: (top) => {
        const scrollDOM = viewRef.current?.scrollDOM;
        if (scrollDOM) {
          scrollDOM.scrollTop = top;
        }
      },
      getDomRect: () => viewRef.current?.scrollDOM.getBoundingClientRect() ?? null,
    }), []);

    return <div ref={hostRef} data-testid="chordpro-rich-editor-shell" />;
  },
);
