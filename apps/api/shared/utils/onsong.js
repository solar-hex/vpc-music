/**
 * Convert ChordPro source to OnSong format.
 *
 * OnSong format:
 *   - Metadata at top as "Key: Value" lines
 *   - Section labels as "Section Name:" on their own line
 *   - Chords inline in square brackets (same as ChordPro)
 *   - Blank lines separate sections
 */

import { parseChordPro } from "./chordpro.js";

/**
 * Map of ChordPro directive keys → OnSong metadata labels.
 */
const DIRECTIVE_MAP = {
  title: "Title",
  t: "Title",
  artist: "Artist",
  a: "Artist",
  key: "Key",
  k: "Key",
  tempo: "Tempo",
  time: "Time",
  capo: "Capo",
  year: "Year",
  copyright: "Copyright",
  ccli: "CCLI",
};

/**
 * Convert a parsed ChordPro document to OnSong format string.
 * @param {{ directives: Record<string, string>, sections: Array<{ name: string, lines: Array<{ chords: Array<{chord: string, position: number}>, lyrics: string }> }> }} doc
 * @returns {string}
 */
export function docToOnSong(doc) {
  const parts = [];

  // Metadata header
  for (const [key, value] of Object.entries(doc.directives)) {
    const label = DIRECTIVE_MAP[key] || key.charAt(0).toUpperCase() + key.slice(1);
    parts.push(`${label}: ${value}`);
  }

  if (parts.length > 0) {
    parts.push(""); // blank line after metadata
  }

  // Sections
  for (const section of doc.sections) {
    if (section.name) {
      parts.push(`${section.name}:`);
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

    parts.push(""); // blank line between sections
  }

  return parts.join("\n").trim() + "\n";
}

/**
 * Convert raw ChordPro source text to OnSong format.
 * @param {string} chordProSource
 * @returns {string}
 */
export function chordProToOnSong(chordProSource) {
  const doc = parseChordPro(chordProSource);
  return docToOnSong(doc);
}

const ONSONG_TO_DIRECTIVE_MAP = {
  title: "title",
  artist: "artist",
  author: "artist",
  key: "key",
  tempo: "tempo",
  time: "time",
  capo: "capo",
  year: "year",
  copyright: "copyright",
  ccli: "ccli",
};

const OPSONG_SECTION_MAP = {
  v: "Verse",
  verse: "Verse",
  c: "Chorus",
  chorus: "Chorus",
  b: "Bridge",
  bridge: "Bridge",
  p: "Pre-Chorus",
  prechorus: "Pre-Chorus",
  pre_chorus: "Pre-Chorus",
  t: "Tag",
  tag: "Tag",
  i: "Intro",
  intro: "Intro",
  o: "Outro",
  outro: "Outro",
  m: "Misc",
  misc: "Misc",
};

function decodeXmlEntities(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripBom(input) {
  return input.replace(/^\uFEFF/, "");
}

function isLikelySectionHeader(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.includes("[") || !trimmed.endsWith(":")) return false;
  const name = trimmed.slice(0, -1).trim();
  return /^[A-Za-z][A-Za-z0-9 #'()/_-]*$/.test(name);
}

function normalizeSectionName(token) {
  const cleaned = token.trim();
  if (!cleaned) return "";

  const match = cleaned.match(/^([A-Za-z_]+)\s*(\d+)?$/);
  if (!match) return cleaned;

  const [, rawName, rawNumber] = match;
  const key = rawName.toLowerCase().replace(/[\s-]+/g, "_");
  const base = OPSONG_SECTION_MAP[key] || rawName.charAt(0).toUpperCase() + rawName.slice(1);
  return rawNumber ? `${base} ${rawNumber}` : base;
}

function parseMetadataLine(line) {
  const match = line.match(/^([A-Za-z][A-Za-z0-9 _-]*):\s*(.*?)\s*$/);
  if (!match) return null;
  const [, label, value] = match;
  const key = label.toLowerCase().trim();
  const directive = ONSONG_TO_DIRECTIVE_MAP[key];
  if (!directive) return null;
  return { key: directive, value };
}

function buildChordProFromParts(directives, bodyLines) {
  const parts = [];

  for (const [key, value] of directives) {
    if (value !== "") {
      parts.push(`{${key}: ${value}}`);
    }
  }

  if (parts.length > 0 && bodyLines.length > 0) {
    parts.push("");
  }

  parts.push(...bodyLines);
  return parts.join("\n").trim();
}

function parseOnSongText(input) {
  const lines = stripBom(input).replace(/\r\n/g, "\n").split("\n");
  const directives = [];
  const bodyLines = [];
  let contentStarted = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!contentStarted) {
      const metadata = parseMetadataLine(trimmed);
      if (metadata) {
        directives.push([metadata.key, metadata.value]);
        continue;
      }
      if (trimmed === "") {
        if (directives.length > 0) {
          contentStarted = true;
        }
        continue;
      }
    }

    contentStarted = true;

    if (isLikelySectionHeader(trimmed)) {
      bodyLines.push(`{comment: ${trimmed.slice(0, -1).trim()}}`);
    } else {
      bodyLines.push(line);
    }
  }

  return buildChordProFromParts(directives, bodyLines);
}

function extractXmlTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${escapeRegExp(tagName)}>([\\s\\S]*?)</${escapeRegExp(tagName)}>`, "i"));
  return match ? decodeXmlEntities(match[1].trim()) : "";
}

function parseOpenSongXml(input) {
  const xml = stripBom(input).trim();
  const directives = [];

  const title = extractXmlTag(xml, "title");
  const artist = extractXmlTag(xml, "author") || extractXmlTag(xml, "artist");
  const key = extractXmlTag(xml, "key");
  const tempo = extractXmlTag(xml, "tempo");
  const ccli = extractXmlTag(xml, "ccli") || extractXmlTag(xml, "ccliNo");
  const copyright = extractXmlTag(xml, "copyright");

  if (title) directives.push(["title", title]);
  if (artist) directives.push(["artist", artist]);
  if (key) directives.push(["key", key]);
  if (tempo) directives.push(["tempo", tempo]);
  if (ccli) directives.push(["ccli", ccli]);
  if (copyright) directives.push(["copyright", copyright]);

  const lyrics = extractXmlTag(xml, "lyrics");
  const lines = lyrics ? lyrics.replace(/\r\n/g, "\n").split("\n") : [];
  const bodyLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const sectionMarker = trimmed.match(/^\[([^\]]+)\]$/);

    if (sectionMarker) {
      const sectionName = normalizeSectionName(sectionMarker[1]);
      if (sectionName) {
        bodyLines.push(`{comment: ${sectionName}}`);
        continue;
      }
    }

    bodyLines.push(decodeXmlEntities(line));
  }

  return buildChordProFromParts(directives, bodyLines);
}

/**
 * Convert OnSong plain text or OpenSong XML to ChordPro.
 * @param {string} input
 * @returns {string}
 */
export function onSongToChordPro(input) {
  const normalized = stripBom(input).trim();
  if (!normalized) return "";
  if (normalized.startsWith("<")) {
    return parseOpenSongXml(normalized);
  }
  return parseOnSongText(normalized);
}
