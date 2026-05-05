/**
 * Legacy `.chrd` → ChordPro conversion helpers.
 *
 * The legacy format is documented in README.md and uses:
 * - first line: title
 * - second line: key (optional)
 * - header metadata lines: author/year/notes
 * - `#` primary chord lines
 * - `^` secondary chord lines
 * - `@` lyric lines
 * - `*` comments/annotations
 * - blank line + first line of next block as a section header
 */

const KEY_PATTERN = /^[A-G](?:b|#)?(?:m|min)?$/i;

const HEADER_DIRECTIVE_MAP = {
  artist: "artist",
  author: "artist",
  composer: "artist",
  writer: "artist",
  "written by": "artist",
  "music by": "artist",
  "words by": "artist",
  key: "key",
  tempo: "tempo",
  bpm: "tempo",
  year: "year",
  copyright: "copyright",
  ccli: "ccli",
  capo: "capo",
  time: "time",
};

function stripBom(input) {
  return String(input || "").replace(/^\uFEFF/, "");
}

function normalizeLineEndings(input) {
  return stripBom(input).replace(/\r\n?/g, "\n");
}

function sanitizeDirectiveValue(value) {
  return String(value || "").replace(/[{}]/g, "").trim();
}

function isPrefixedLine(line) {
  return /^\s*[#@^*]/.test(line);
}

function stripLinePrefix(line, prefix) {
  return line.replace(new RegExp(`^\\s*\\${prefix}`), "");
}

function deriveTitleFromFilename(filename) {
  return String(filename || "")
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.chrd$/i, "")
    ?.trim() || "Untitled";
}

function normalizeDraftTitle(rawTitle) {
  const trimmed = String(rawTitle || "Untitled").trim();
  if (trimmed.startsWith("~")) {
    return {
      title: trimmed.slice(1).trim() || "Untitled",
      isDraft: true,
    };
  }

  return {
    title: trimmed || "Untitled",
    isDraft: false,
  };
}

function isLikelySongKey(value) {
  return KEY_PATTERN.test(String(value || "").trim());
}

function parseHeaderLine(line) {
  const match = String(line || "").trim().match(/^([^:]+):\s*(.+)$/);
  if (!match) return null;

  const [, rawKey, rawValue] = match;
  const normalizedKey = rawKey.trim().toLowerCase();
  const directive = HEADER_DIRECTIVE_MAP[normalizedKey];
  if (!directive) return null;

  return {
    key: directive,
    value: sanitizeDirectiveValue(rawValue),
  };
}

function parseTempo(value) {
  if (!value) return null;
  return /^\d+$/.test(String(value).trim()) ? Number(value) : null;
}

function mergeChordLineWithLyrics(chordLine, lyricLine) {
  const positions = [];
  for (const match of chordLine.matchAll(/\S+/g)) {
    positions.push({ chord: match[0], col: match.index || 0 });
  }

  let lyric = lyricLine;
  let offset = 0;
  for (const { chord, col } of positions) {
    const insertAt = Math.min(col + offset, lyric.length);
    lyric = lyric.slice(0, insertAt) + `[${chord}]` + lyric.slice(insertAt);
    offset += chord.length + 2;
  }

  return lyric.trimEnd();
}

function convertChordOnlyLine(chordLine) {
  return chordLine
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => (token === "|" ? token : `[${token}]`))
    .join(" ");
}

function buildSecondaryChordComment(line) {
  const content = stripLinePrefix(line, "^").trimEnd();
  if (!content.trim()) return "";
  return `{comment: Secondary chords: ${sanitizeDirectiveValue(content)}}`;
}

function flushBlock(blockLines, convertedLines, warnings) {
  if (blockLines.length === 0) return;

  let index = 0;
  const hasPrefixedContent = blockLines.some((line) => isPrefixedLine(line));

  if (hasPrefixedContent && !isPrefixedLine(blockLines[0])) {
    const sectionHeader = blockLines[0].trim();
    if (sectionHeader) {
      convertedLines.push(`{comment: ${sanitizeDirectiveValue(sectionHeader)}}`);
    }
    index = 1;
  }

  while (index < blockLines.length) {
    const rawLine = blockLines[index];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (!isPrefixedLine(rawLine)) {
      convertedLines.push(trimmed);
      index += 1;
      continue;
    }

    const prefix = trimmed[0];

    if (prefix === "*") {
      const comment = sanitizeDirectiveValue(stripLinePrefix(rawLine, "*"));
      if (comment) {
        convertedLines.push(`{comment: ${comment}}`);
      }
      index += 1;
      continue;
    }

    if (prefix === "^") {
      const secondaryComment = buildSecondaryChordComment(rawLine);
      if (secondaryComment) {
        convertedLines.push(secondaryComment);
      }
      index += 1;
      continue;
    }

    if (prefix === "@") {
      convertedLines.push(stripLinePrefix(rawLine, "@").trimEnd());
      index += 1;
      continue;
    }

    if (prefix === "#") {
      const primaryChordLine = stripLinePrefix(rawLine, "#");
      let lookahead = index + 1;
      const secondaryComments = [];

      while (lookahead < blockLines.length && blockLines[lookahead].trim().startsWith("^")) {
        const secondaryComment = buildSecondaryChordComment(blockLines[lookahead]);
        if (secondaryComment) {
          secondaryComments.push(secondaryComment);
        }
        lookahead += 1;
      }

      if (secondaryComments.length > 0) {
        convertedLines.push(...secondaryComments);
      }

      if (lookahead < blockLines.length && blockLines[lookahead].trim().startsWith("@")) {
        const lyricLine = stripLinePrefix(blockLines[lookahead], "@");
        convertedLines.push(mergeChordLineWithLyrics(primaryChordLine, lyricLine));
        index = lookahead + 1;
        continue;
      }

      const chordOnlyLine = convertChordOnlyLine(primaryChordLine);
      if (chordOnlyLine) {
        convertedLines.push(chordOnlyLine);
      }
      index = lookahead;
      continue;
    }

    convertedLines.push(trimmed);
    index += 1;
  }
}

/**
 * Convert one legacy `.chrd` song into ChordPro.
 * @param {string} filename
 * @param {string} rawContent
 * @returns {{ title: string, chordProContent: string, metadata: { title: string, artist: string | null, key: string | null, tempo: number | null, year: string | null, isDraft: boolean }, warnings: string[] }}
 */
export function convertChrdToChordPro(filename, rawContent) {
  const normalized = normalizeLineEndings(rawContent);
  const sourceLines = normalized.split("\n");
  const warnings = [];

  const rawTitle = sourceLines[0]?.trim() || deriveTitleFromFilename(filename);
  const { title, isDraft } = normalizeDraftTitle(rawTitle || deriveTitleFromFilename(filename));
  const directives = new Map();
  directives.set("title", title);

  const metadataComments = [];
  let index = sourceLines[0]?.trim() ? 1 : 0;

  while (index < sourceLines.length) {
    const trimmed = sourceLines[index].trim();

    if (!trimmed) {
      index += 1;
      break;
    }

    if (isPrefixedLine(sourceLines[index])) {
      break;
    }

    if (!directives.has("key") && isLikelySongKey(trimmed)) {
      directives.set("key", trimmed);
      index += 1;
      continue;
    }

    const parsedHeader = parseHeaderLine(trimmed);
    if (parsedHeader) {
      if (!directives.has(parsedHeader.key) && parsedHeader.value) {
        directives.set(parsedHeader.key, parsedHeader.value);
      }
    } else {
      metadataComments.push(trimmed);
    }

    index += 1;
  }

  const convertedLines = [];
  for (const comment of metadataComments) {
    convertedLines.push(`{comment: ${sanitizeDirectiveValue(comment)}}`);
  }

  const currentBlock = [];
  const remainingLines = sourceLines.slice(index);
  for (const line of [...remainingLines, ""]) {
    if (line.trim() === "") {
      flushBlock(currentBlock, convertedLines, warnings);
      if (currentBlock.length > 0 && convertedLines.at(-1) !== "") {
        convertedLines.push("");
      }
      currentBlock.length = 0;
      continue;
    }

    currentBlock.push(line);
  }

  while (convertedLines[convertedLines.length - 1] === "") {
    convertedLines.pop();
  }

  const directiveLines = [...directives.entries()].map(([key, value]) => `{${key}: ${sanitizeDirectiveValue(value)}}`);
  const chordProContent = [...directiveLines, "", ...convertedLines].join("\n").trim();

  return {
    title,
    chordProContent,
    metadata: {
      title,
      artist: directives.get("artist") || null,
      key: directives.get("key") || null,
      tempo: parseTempo(directives.get("tempo")),
      year: directives.get("year") || null,
      isDraft,
    },
    warnings,
  };
}