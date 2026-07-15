/**
 * ChordPro parser and utilities.
 * Parse ChordPro text into a structured document object.
 */
import { isSectionToken } from "./transpose.js";

// ChordPro environment directives → default section names. Both the long and
// short forms open a named section; the matching end_* closes it. A label
// value overrides the default ({start_of_verse: Verse 2} → "Verse 2").
const ENVIRONMENT_STARTS = {
  soc: "Chorus", start_of_chorus: "Chorus",
  sov: "Verse", start_of_verse: "Verse",
  sob: "Bridge", start_of_bridge: "Bridge",
  sot: "Tab", start_of_tab: "Tab",
};
const ENVIRONMENT_ENDS = new Set([
  "eoc", "end_of_chorus",
  "eov", "end_of_verse",
  "eob", "end_of_bridge",
  "eot", "end_of_tab",
]);
// Environments whose body is preformatted — no chord extraction, no trimming.
const RAW_ENVIRONMENTS = new Set(["sot", "start_of_tab"]);

/**
 * Parse a `{define: Name base-fret N frets f f f f f f [fingers …]}` value
 * into a chord-shape object. Returns null when it doesn't match the spec.
 */
function parseDefineValue(value) {
  const match = value.match(/^(\S+)\s+base-fret\s+(\d+)\s+frets((?:\s+(?:x|X|\d+))+)(?:\s+fingers((?:\s+(?:x|X|\d+))+))?\s*$/);
  if (!match) return null;
  const toFret = (token) => (token.toLowerCase() === "x" ? -1 : Number(token));
  return {
    name: match[1],
    baseFret: Number(match[2]),
    frets: match[3].trim().split(/\s+/).map(toFret),
    fingers: match[4] ? match[4].trim().split(/\s+/).map(toFret) : null,
  };
}

/**
 * Parse a ChordPro string into sections of directives and lyric/chord lines.
 * @param {string} input — raw ChordPro source text
 * @returns {{ directives: Record<string, string>, sections: Array<{ name: string, raw?: boolean, lines: Array<{ chords: Array<{chord: string, position: number}>, lyrics: string }> }>, chordDefinitions: Record<string, {name: string, baseFret: number, frets: number[], fingers: number[]|null}> }}
 */
export function parseChordPro(input) {
  const lines = input.split("\n");
  const directives = {};
  const chordDefinitions = {};
  const sections = [];
  let currentSection = { name: "", lines: [] };
  let rawMode = false;

  const pushSection = () => {
    if (currentSection.lines.length > 0) sections.push(currentSection);
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Inside a raw environment (tab): only the end directive is special;
    // every other line is preserved verbatim (no trimming, no chord parse).
    if (rawMode) {
      const endMatch = trimmed.match(/^\{(\w+)\}$/);
      if (endMatch && ENVIRONMENT_ENDS.has(endMatch[1])) {
        pushSection();
        currentSection = { name: "", lines: [] };
        rawMode = false;
        continue;
      }
      currentSection.lines.push({ chords: [], lyrics: line });
      continue;
    }

    // Comment line — stripped on render
    if (trimmed.startsWith("#")) continue;

    // Standalone section header line, e.g. "[Verse 1]" / "[Chorus]"
    const bracketHeader = trimmed.match(/^\[([^\]]+)\]$/);
    if (bracketHeader && isSectionToken(bracketHeader[1])) {
      pushSection();
      currentSection = { name: bracketHeader[1], lines: [] };
      continue;
    }

    // Directive: {key: value}
    const directiveMatch = trimmed.match(/^\{(\w+):\s*(.*?)\}$/);
    if (directiveMatch) {
      const [, key, value] = directiveMatch;
      if (key === "comment" || key === "c") {
        pushSection();
        currentSection = { name: value, lines: [] };
      } else if (key in ENVIRONMENT_STARTS) {
        pushSection();
        currentSection = { name: value || ENVIRONMENT_STARTS[key], lines: [] };
        if (RAW_ENVIRONMENTS.has(key)) {
          currentSection.raw = true;
          rawMode = true;
        }
      } else if (key === "define" || key === "chord") {
        const def = parseDefineValue(value);
        if (def) chordDefinitions[def.name] = def;
      } else {
        directives[key] = value;
      }
      continue;
    }

    // Standalone directive: {directive}
    if (/^\{\w+\}$/.test(trimmed)) {
      const key = trimmed.slice(1, -1);
      if (key in ENVIRONMENT_STARTS) {
        pushSection();
        currentSection = { name: ENVIRONMENT_STARTS[key], lines: [] };
        if (RAW_ENVIRONMENTS.has(key)) {
          currentSection.raw = true;
          rawMode = true;
        }
      } else if (ENVIRONMENT_ENDS.has(key)) {
        pushSection();
        currentSection = { name: "", lines: [] };
      }
      continue;
    }

    // Blank line — section break
    if (trimmed === "") {
      if (currentSection.lines.length > 0) {
        sections.push(currentSection);
        currentSection = { name: "", lines: [] };
      }
      continue;
    }

    // Lyric/chord line — extract [Chord] tokens
    const chords = [];
    let lyrics = "";
    const regex = /\[([^\]]+)\]/g;
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(trimmed)) !== null) {
      lyrics += trimmed.slice(lastIndex, match.index);
      chords.push({ chord: match[1], position: lyrics.length });
      lastIndex = match.index + match[0].length;
    }
    lyrics += trimmed.slice(lastIndex);

    currentSection.lines.push({ chords, lyrics });
  }

  pushSection();

  return { directives, sections, chordDefinitions };
}

/**
 * Serialize a parsed ChordPro document back to string.
 */
export function toChordProString(doc) {
  const parts = [];

  // Directives
  for (const [key, value] of Object.entries(doc.directives)) {
    parts.push(`{${key}: ${value}}`);
  }
  parts.push("");

  // Sections
  for (const section of doc.sections) {
    if (section.name) {
      parts.push(`{comment: ${section.name}}`);
    }
    for (const line of section.lines) {
      let result = "";
      let lyricPos = 0;
      const sortedChords = [...line.chords].sort((a, b) => a.position - b.position);
      for (const { chord, position } of sortedChords) {
        result += line.lyrics.slice(lyricPos, position);
        result += `[${chord}]`;
        lyricPos = position;
      }
      result += line.lyrics.slice(lyricPos);
      parts.push(result);
    }
    parts.push("");
  }

  return parts.join("\n").trim();
}
