/**
 * ChordPro parser and utilities.
 * Parse ChordPro text into a structured document object.
 */

/**
 * Parse a ChordPro string into sections of directives and lyric/chord lines.
 * @param {string} input — raw ChordPro source text
 * @returns {{ directives: Record<string, string>, sections: Array<{ name: string, lines: Array<{ chords: Array<{chord: string, position: number}>, lyrics: string }> }> }}
 */
export function parseChordPro(input) {
  const lines = input.split("\n");
  const directives = {};
  const sections = [];
  let currentSection = { name: "", lines: [] };

  for (const line of lines) {
    const trimmed = line.trim();

    // Directive: {key: value}
    const directiveMatch = trimmed.match(/^\{(\w+):\s*(.*?)\}$/);
    if (directiveMatch) {
      const [, key, value] = directiveMatch;
      // Section directives
      if (key === "comment" || key === "c") {
        if (currentSection.lines.length > 0) {
          sections.push(currentSection);
        }
        currentSection = { name: value, lines: [] };
      } else if (key === "start_of_chorus" || key === "soc") {
        if (currentSection.lines.length > 0) sections.push(currentSection);
        currentSection = { name: "Chorus", lines: [] };
      } else if (key === "end_of_chorus" || key === "eoc") {
        sections.push(currentSection);
        currentSection = { name: "", lines: [] };
      } else {
        directives[key] = value;
      }
      continue;
    }

    // Standalone directive: {directive}
    if (/^\{\w+\}$/.test(trimmed)) {
      const key = trimmed.slice(1, -1);
      if (key === "start_of_chorus" || key === "soc") {
        if (currentSection.lines.length > 0) sections.push(currentSection);
        currentSection = { name: "Chorus", lines: [] };
      } else if (key === "end_of_chorus" || key === "eoc") {
        sections.push(currentSection);
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
    let pos = 0;
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

  if (currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  return { directives, sections };
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
