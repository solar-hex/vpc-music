/**
 * The small pieces of the duplicate review that are not layout: what to call
 * where a chart came from, how alike two songs are in words, and copying text
 * from one chart into the other.
 */

const SOURCE_LABELS: Record<string, string> = {
  chrd: "Church chart",
  docx: "Word lyric sheet",
  pdf: "Publisher PDF",
  text: "Publisher text chart",
  onsong: "OnSong file",
  app: "Made in the app",
};

export function sourceLabel(source: string | null | undefined): string {
  return SOURCE_LABELS[String(source ?? "")] ?? "Imported";
}

export function overlapLabel(overlap: number): string {
  return `${Math.round(overlap * 100)}% of the words match`;
}

export interface TextState {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Text copied from one chart into the other.
 *
 * With text selected, the selection goes in where the other chart's cursor is
 * (replacing anything selected there). With nothing selected, the whole line
 * the cursor is on is copied in as a new line below the other chart's cursor
 * line, which is the usual case: "this line is missing from that chart".
 *
 * @returns the other chart's new text, where its cursor should end up, and what was copied
 */
export function copyAcross(from: TextState, to: TextState): { value: string; caret: number; copied: string } {
  const selected = from.value.slice(Math.min(from.selectionStart, from.selectionEnd), Math.max(from.selectionStart, from.selectionEnd));
  if (selected) {
    const start = Math.min(to.selectionStart, to.selectionEnd);
    const end = Math.max(to.selectionStart, to.selectionEnd);
    return { value: to.value.slice(0, start) + selected + to.value.slice(end), caret: start + selected.length, copied: selected };
  }

  const lineStart = from.value.lastIndexOf("\n", Math.max(0, from.selectionStart - 1)) + 1;
  const newline = from.value.indexOf("\n", from.selectionStart);
  const line = from.value.slice(from.selectionStart === 0 ? 0 : lineStart, newline === -1 ? from.value.length : newline);
  if (!line) return { value: to.value, caret: to.selectionStart, copied: "" };

  if (!to.value) return { value: line, caret: line.length, copied: line };
  const lineEnd = to.value.indexOf("\n", to.selectionStart);
  const at = lineEnd === -1 ? to.value.length : lineEnd;
  const value = `${to.value.slice(0, at)}\n${line}${to.value.slice(at)}`;
  return { value, caret: at + 1 + line.length, copied: line };
}

/** "3 lines" / "1 line" / "12 characters" — what a copy moved, for the screen reader and the toast. */
export function describeCopy(copied: string): string {
  const lines = copied.split("\n").length;
  if (lines > 1) return `${lines} lines`;
  return copied.length > 40 ? "1 line" : `"${copied.trim()}"`;
}
