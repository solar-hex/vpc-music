/**
 * Convert a chord-chart PDF into ChordPro.
 *
 * Extraction is local (`pdfTextLocal.js`); the geometry work is the existing
 * pipeline in `features/songs/pdfToChordPro.js`, reused unchanged. This module
 * is the joining piece: it reads the header properly, normalises the credits,
 * and assembles the document.
 */
import { basename } from "node:path";
import { assembleLines, detectColumns } from "../features/songs/pdfToChordPro.js";
import { isChordToken } from "@vpc-music/shared";
import { normalizeCredits } from "./artists.js";
import { coalesceRuns, extractPdfElements, readChartHeader, renderLine } from "./pdfTextLocal.js";

// Re-exported: these were defined here first, and the tests import them from here.
export { coalesceRuns, renderLine };

const SECTION_WORD =
  "intro|verse|chorus|pre[- ]?chorus|bridge|tag|outro|ending|end|interlude|instrumental|vamp|refrain|turnaround|breakdown|solo|hook|coda|reprise|channel";

/**
 * Classify one assembled line.
 *
 * The generic classifier misses how these charts are actually written:
 * "Chorus (2x)", "Verse 1 & 2" and "Verse 3 & Verse 4 (same as Verse 1 & 2)"
 * are all section headers, and treating them as lyrics lets the chord line
 * above merge into them.
 */
export function classifyChartLine(text) {
  const t = String(text || "").trim();
  if (!t) return { type: "blank" };

  /*
   * A section header, with any repeat count or cross-reference it carries.
   *
   * What may follow the section word is deliberately narrow: a number, a roman
   * numeral, a joining word, or another section word. Allowing arbitrary text
   * would swallow lyrics that happen to open with one — "Bridge over troubled
   * water carries me home" is a line, not a heading.
   */
  const tail = `(?:\\d+[a-z]?|[ivx]+|&|and|,|-|${SECTION_WORD})`;
  const section = t.match(
    new RegExp(
      `^((?:${SECTION_WORD})(?:\\s+${tail})*)\\s*(\\((?:[^()]|\\([^()]*\\))*\\))?\\s*:?$`,
      "i",
    ),
  );
  if (section && section[1].trim().length <= 48) {
    const name = section[1].replace(/\s+/g, " ").trim();
    const note = section[2] ? section[2].replace(/^\(|\)$/g, "").trim() : null;
    return { type: "section", name, note };
  }

  // Performance directions: "1st time only:", "(2x)", "a cappella".
  if (/^(\d+(st|nd|rd|th)\s+time|repeat|last time|a\s?cappella|slowly|rit\.?)\b/i.test(t) || /^\(.*\)$/.test(t)) {
    return { type: "note", text: t.replace(/^\(|\)$/g, "").trim() };
  }

  const tokens = t.split(/\s+/).filter(Boolean);
  const chordish = tokens.filter((x) => isChordToken(x) || /^[A-G][b#]?([a-z0-9#/()+-]*)$/.test(x));
  if (tokens.length > 0 && chordish.length === tokens.length) return { type: "chord" };

  return { type: "lyric" };
}

/**
 * The line under the title on an older chart is usually the performer — but
 * not always, and a wrong artist is worse than none.
 *
 * The charts with no credit line start straight into the arrangement, so this
 * was reading "Intro F G C" and "Intro Chorus (Parts) (2x)" as artists. Two
 * rules settle it: an artist never opens with a section word, and a name never
 * contains a chord.
 *
 * @returns {string|null} the performer, or null if the line is not one
 */
export function artistFromLine(text) {
  let line = String(text || "").trim();
  if (!line) return null;
  if (/key\s*:|tempo\s*:|time\s*:|written\s+by/i.test(line)) return null;
  if (new RegExp(`^(?:${SECTION_WORD})\\b`, "i").test(line)) return null;
  if (/[|[\]]/.test(line)) return null;

  // 'Eddie James – "Magnify"' is a performer and an album; keep the performer.
  line = line.split(/\s+[–—-]\s+/)[0].replace(/[“"][^”"]*[”"]/g, "").trim();
  if (!line || !/^[A-Z]/.test(line)) return null;
  if (line.length > 40 || line.split(/\s+/).length > 5) return null;

  const tokens = line.split(/\s+/).filter(Boolean);
  if (tokens.some((t) => isChordToken(t.replace(/[(),.]/g, "")))) return null;
  return line;
}

/**
 * Put each chord at the lyric character nearest its x position — the same rule
 * the `.chrd` converter uses, because alignment is meaning.
 */
export function mergeByPosition(chordLine, lyricLine) {
  const rendered = renderLine(lyricLine.elements || []);
  const text = rendered.text;
  if (!text.trim()) return null;

  const positions = rendered.xs.map((x, idx) => ({ idx, x }));

  const chords = coalesceRuns(chordLine.elements || []).filter((e) => e.text.trim());

  let out = text;
  let shift = 0;
  let last = -1;
  for (const chord of chords) {
    let best = 0;
    let dist = Infinity;
    for (const p of positions) {
      const d = Math.abs(p.x - chord.x);
      if (d < dist) { dist = d; best = p.idx; }
    }
    if (best <= last) best = last + 1;   // never place two chords on one character
    if (best > text.length) best = text.length;
    last = best;
    const token = `[${chord.text.trim()}]`;
    const at = Math.min(best + shift, out.length);
    out = out.slice(0, at) + token + out.slice(at);
    shift += token.length;
  }
  return out;
}

/** Lines that belong to the letterhead, not the song. */
const CHROME = /^(upci music ministry|www\.|copyright|©|ccli|page \d+|all rights reserved)/i;
/** The credit line we already parsed into directives. */
const CREDIT = /(key\s*:|tempo\s*:|written\s+by)/i;

/**
 * @param {Buffer|Uint8Array} buffer
 * @param {string} filename
 * @returns {Promise<{title, chordProContent, metadata, warnings, confidence}>}
 */
export async function convertPdfChartToChordPro(filename, buffer) {
  const warnings = [];
  const elements = await extractPdfElements(buffer);

  if (elements.length < 15) {
    const error = new Error("No text layer — this is engraved notation, not a chart with text.");
    error.code = "NO_TEXT";
    throw error;
  }

  const header = readChartHeader(elements, { filename: basename(String(filename)) });
  let rawArtist = header.artist;
  if (!rawArtist) {
    // Older charts carry no credit line — just a short name under the title.
    const p1 = elements.filter((e) => e.pageIndex === 0).sort((a, b) => a.y - b.y);
    const lines = [];
    for (const e of p1.slice(0, 30)) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.y - e.y) < 4) last.parts.push(e);
      else lines.push({ y: e.y, parts: [e] });
    }
    const rendered = lines
      .map((l) => ({ size: Math.max(...l.parts.map((p) => p.fontSize)), text: renderLine(l.parts).text.replace(/\s+/g, " ").trim() }))
      .filter((l) => l.text);
    const max = Math.max(...rendered.map((l) => l.size), 0);
    const titleAt = rendered.findIndex((l) => l.size >= max * 0.95);
    for (const l of rendered.slice(titleAt + 1, titleAt + 3)) {
      const candidate = artistFromLine(l.text);
      if (candidate) { rawArtist = candidate; break; }
    }
  }
  const credits = normalizeCredits({ artist: rawArtist, writers: header.writers });

  // Geometry from the existing pipeline; classification and merging are tuned
  // to how these charts are actually written.
  const assembled = assembleLines(detectColumns(elements));

  const titleLower = (header.title || "").toLowerCase();
  const artistLower = String(rawArtist || "").toLowerCase();
  const kept = [];
  let dropped = 0;
  for (const line of assembled) {
    const text = renderLine(line.elements).text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (CHROME.test(text) || CREDIT.test(text)) { dropped += 1; continue; }
    if (titleLower && text.toLowerCase() === titleLower) { dropped += 1; continue; }
    if (artistLower && text.toLowerCase() === artistLower) { dropped += 1; continue; }
    kept.push({ ...line, text, kind: classifyChartLine(text) });
  }

  const body = [];
  let derived = 0;
  for (let i = 0; i < kept.length; i += 1) {
    const line = kept[i];
    if (line.kind.type === "section") {
      if (body.length > 0) body.push("");
      body.push(`{comment: ${line.kind.name}}`);
      if (line.kind.note) {
        // "(2x)" and "(same as Verse 1 & 2)" are real instructions — keep them
        // visible as notes rather than dropping or silently expanding them.
        if (/same as/i.test(line.kind.note)) derived += 1;
        body.push(`{ci: ${line.kind.note}}`);
      }
      continue;
    }
    if (line.kind.type === "note") { body.push(`{ci: ${line.kind.text}}`); continue; }

    if (line.kind.type === "chord") {
      // Attach to the next lyric line, if the next line is one.
      const next = kept[i + 1];
      if (next && next.kind.type === "lyric") {
        const merged = mergeByPosition(line, next);
        if (merged) { body.push(merged); i += 1; continue; }
      }
      body.push(coalesceRuns(line.elements).map((t) => `[${t.text}]`).join(" "));
      continue;
    }

    body.push(line.text);
  }
  while (body.length > 0 && !body[0].trim()) body.shift();
  while (body.length > 0 && !body[body.length - 1].trim()) body.pop();

  const sections = body.filter((l) => /^\{comment:/.test(String(l).trim())).length;
  const chordTokens = body.reduce((n, l) => n + (String(l).match(/\[[^\]]+\]/g) || []).length, 0);
  const lyricLines = body.filter((l) => String(l).trim() && !/^\{/.test(String(l).trim())).length;

  if (sections === 0) warnings.push("No sections detected");
  if (chordTokens === 0) warnings.push("No chords found in the extracted text");
  if (dropped === 0) warnings.push("Header lines were not recognised, so they may remain in the body");
  if (derived > 0) warnings.push(`${derived} section(s) reference another section rather than repeating it`);

  const directives = [`{title: ${header.title || basename(String(filename)).replace(/\.[^.]+$/, "")}}`];
  if (credits.artist) directives.push(`{artist: ${credits.artist}}`);
  if (header.key) directives.push(`{key: ${header.key}}`);
  if (header.tempo) directives.push(`{tempo: ${header.tempo}}`);
  if (header.time) directives.push(`{time: ${header.time}}`);
  if (header.album) directives.push(`{x_album: ${header.album}}`);
  if (credits.writers) directives.push(`{x_writers: ${credits.writers}}`);

  /*
   * Confidence is deliberately capped below the non-draft threshold. Chord
   * placement here comes from geometry, not from a human aligning columns, so
   * every one of these lands as a draft for review however clean it looks.
   */
  let score = 0.8;
  const reasons = [];
  if (sections === 0) { score -= 0.25; reasons.push("no sections"); }
  if (chordTokens === 0) { score -= 0.35; reasons.push("no chords"); }
  else if (chordTokens < 6) { score -= 0.1; reasons.push("very few chords"); }
  if (lyricLines < 4) { score -= 0.15; reasons.push("almost no lyrics"); }
  if (!credits.artist) { score -= 0.05; reasons.push("no artist"); }
  score = Math.max(0, Math.round(score * 100) / 100);

  return {
    title: header.title,
    chordProContent: `${[...directives, "", ...body].join("\n")}\n`,
    metadata: {
      title: header.title,
      artist: credits.artist,
      key: header.key,
      tempo: header.tempo,
      year: null,
      // Geometry-derived chord positions always need a human look.
      isDraft: true,
      album: header.album,
      writers: credits.writers,
      time: header.time,
    },
    warnings,
    confidence: { score, band: score >= 0.85 ? "high" : score >= 0.6 ? "medium" : "low", reasons },
  };
}
