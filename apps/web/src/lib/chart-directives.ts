/**
 * The song properties the editor shows as fields, each kept where it lives: a
 * `{name: value}` directive in the chart text.
 *
 * The chart file is the complete record of a song (see CLAUDE.md, "The
 * corpus"), so properties like time signature, album and songwriters are kept
 * in the chart, not in side columns. 217 charts already carry `{time:}`, 211
 * `{x_album:}` and 112 `{x_writers:}`; reading them from the text is what makes
 * the editor show them. The reader and writer live in shared/, so the editor,
 * the API and the corpus tools find and write a directive the same way.
 */

export { hasDirective, readDirective, writeDirective } from "@vpc-music/shared";

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
  { directive: "x_aka", label: "Alternate titles", placeholder: "Other names people search for", hint: "Separate names with semicolons, since a title can have a comma. The song list finds the song by these too." },
  { directive: "subtitle", label: "Subtitle" },
  { directive: "x_writers", label: "Songwriters", placeholder: "Separate names with commas" },
  { directive: "x_album", label: "Album" },
  // Placeholders describe the format, never a sample value: in the dark theme
  // a realistic "4:05" reads as if the song already had a length.
  { directive: "time", label: "Time signature", placeholder: "Pick or type, like 6/8", suggestions: ["4/4", "3/4", "6/8", "12/8", "2/4", "5/4", "7/8"] },
  { directive: "duration", label: "Length", placeholder: "Minutes:seconds" },
  { directive: "copyright", label: "Copyright", placeholder: "Year and publisher" },
  { directive: "ccli", label: "CCLI song number", placeholder: "The number from SongSelect", inputMode: "numeric" },
];
