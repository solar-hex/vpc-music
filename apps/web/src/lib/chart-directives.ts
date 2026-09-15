/**
 * Read and write one property of a chart where it lives: a `{name: value}`
 * directive in the chart text.
 *
 * The chart file is the complete record of a song (see CLAUDE.md, "The
 * corpus"), so properties like time signature, album and songwriters are kept
 * in the chart, not in side columns. 217 charts already carry `{time:}`, 211
 * `{x_album:}` and 112 `{x_writers:}`; reading them from the text is what makes
 * the editor show them.
 */

function directivePattern(name: string, flags = "i") {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // One optional space after the colon belongs to the format; anything else is
  // the value, trailing spaces included, so a field being typed into keeps them.
  return new RegExp(`^\\s*\\{\\s*${escaped}\\s*:[ \\t]?(.*)\\}\\s*$`, flags);
}

/** The value of a directive, or "" when the chart has none. The last one wins, as in the parser. */
export function readDirective(content: string, name: string): string {
  let value = "";
  const pattern = directivePattern(name);
  for (const line of String(content ?? "").split("\n")) {
    const match = line.match(pattern);
    if (match) value = match[1];
  }
  return value;
}

/** Whether the chart has the directive at all, even an empty one. */
export function hasDirective(content: string, name: string): boolean {
  const pattern = directivePattern(name);
  return String(content ?? "").split("\n").some((line) => pattern.test(line));
}

/**
 * The chart with a directive set to a value. An empty value removes the
 * directive. A directive a chart repeats is left once, where it was first. A
 * new one goes at the end of the directive block at the top of the chart.
 */
export function writeDirective(content: string, name: string, value: string): string {
  // A brace or a line break would end the directive early and spill into the chart.
  const clean = String(value ?? "").replace(/[{}\r\n]/g, "");
  const pattern = directivePattern(name);
  const lines = String(content ?? "").split("\n");

  const kept: string[] = [];
  let placed = false;
  for (const line of lines) {
    if (!pattern.test(line)) {
      kept.push(line);
      continue;
    }
    if (!placed && clean.trim()) kept.push(`{${name}: ${clean}}`);
    placed = true;
  }
  if (placed || !clean.trim()) return kept.join("\n");

  let insertAt = 0;
  while (insertAt < kept.length && /^\s*\{\s*[a-z_]+\s*:/i.test(kept[insertAt])) insertAt += 1;
  kept.splice(insertAt, 0, `{${name}: ${clean}}`);
  return kept.join("\n");
}

export interface AdvancedSongField {
  directive: string;
  label: string;
  placeholder?: string;
  hint?: string;
  suggestions?: string[];
  inputMode?: "text" | "numeric";
}

/**
 * The song properties behind the editor's Advanced section, in the order a
 * musician reaches for them. Names match what the library already uses, so
 * existing values appear, and what the corpus pipeline reads back.
 */
export const ADVANCED_SONG_FIELDS: AdvancedSongField[] = [
  { directive: "x_aka", label: "Alternate titles", placeholder: "Other names people search for", hint: "Separate names with commas. The song list finds the song by these too." },
  { directive: "subtitle", label: "Subtitle" },
  { directive: "x_writers", label: "Songwriters", placeholder: "Separate names with commas" },
  { directive: "x_album", label: "Album" },
  { directive: "time", label: "Time signature", placeholder: "4/4", suggestions: ["4/4", "3/4", "6/8", "12/8", "2/4", "5/4", "7/8"] },
  { directive: "duration", label: "Length", placeholder: "4:05" },
  { directive: "copyright", label: "Copyright", placeholder: "© 2021 Integrity Music" },
  { directive: "ccli", label: "CCLI song number", placeholder: "7117726", inputMode: "numeric" },
];
