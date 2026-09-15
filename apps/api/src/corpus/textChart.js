/**
 * Convert a plain-text chord chart into ChordPro.
 *
 * The UPCI tree carries 22 of these next to their PDF twins, which makes them
 * doubly useful: they are songs in their own right, and they are ground truth
 * for the PDF pipeline — the same chart, authored by the same person, in a
 * format that needs no geometry at all.
 *
 *   A Place of Healing
 *   Jina McCool
 *   Key: D
 *
 *   Intro     D   Bm7   A   G
 *   Verse I
 *   D      A        D  A/C     Bm    G          D   A/C#
 *   Broken we draw near        Jesus meet us   here
 */
import { basename, extname } from "node:path";
import { normalizeArtist } from "./artists.js";
import { chartBody, classifyChartLine } from "./pdfSong.js";

/** Decode UTF-16LE/BE or UTF-8, whichever the file actually is. */
export function decodeText(buffer) {
  const b = Buffer.from(buffer);
  if (b[0] === 0xff && b[1] === 0xfe) return b.toString("utf16le").replace(/^﻿/, "");
  if (b[0] === 0xfe && b[1] === 0xff) return b.swap16().toString("utf16le").replace(/^﻿/, "");
  return b.toString("utf8").replace(/^﻿/, "");
}

/** Typed charts line chords up with tab stops as well as spaces. */
export const TAB_WIDTH = 8;

/** A line with its tabs expanded to the columns they reach. */
export function expandTabs(line, tabWidth = TAB_WIDTH) {
  let out = "";
  for (const ch of String(line)) {
    if (ch === "\t") out +=" ".repeat(tabWidth - (out.length % tabWidth));
    else out += ch;
  }
  return out;
}

/**
 * One typed line as the chart reader sees a line of a PDF: a run per
 * character, at its column. The column a chord is typed at is where it
 * belongs, which is the whole convention these charts are written in, and
 * reading them through the same reader as the PDFs means a passing-chord run,
 * a cue or a section name with its chords reads the same in both.
 */
export function textLineElements(line, lineIndex = 0, tabWidth = TAB_WIDTH) {
  const elements = [];
  [...expandTabs(line, tabWidth)].forEach((ch, column) => {
    if (ch.trim()) elements.push({ text: ch, x: column, y: lineIndex, width: 1, fontSize: 1, pageIndex: 0 });
  });
  return elements;
}

/**
 * @param {string} filename
 * @param {Buffer|string} input
 * @param {{tabWidth?: number}} [options]
 * @returns {{title, chordProContent, metadata, warnings, confidence}}
 */
export function convertTextChartToChordPro(filename, input, { tabWidth = TAB_WIDTH } = {}) {
  const warnings = [];
  const lines = (typeof input === "string" ? input : decodeText(input))
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""));

  // ── header ────────────────────────────────────────────────────────────────
  let title = null;
  let artist = null;
  let key = null;
  let tempo = null;
  let i = 0;
  for (; i < lines.length && i < 8; i += 1) {
    let t = lines[i].trim();
    if (!t) { if (title) { i += 1; break; } continue; }

    // "Key: C#", "Key of E", or the key at the end of the artist's line
    // ("Phase II        Key: Cm"). A word boundary after "C#" would fall back
    // to "C", so the key must end where the letters and sharps do.
    const k = t.match(/(?:^|\s)key(?:\s+of)?\s*[:\-]?\s*([A-G][b#]?m?(?:in)?)(?![A-Za-z0-9#])/i);
    if (k) {
      key = key ?? k[1];
      t = t.slice(0, k.index).trim();
      if (!t) continue;
    }
    const bpm = t.match(/^(?:tempo|bpm)\s*[:\-]?\s*(\d{2,3})/i) || t.match(/(\d{2,3})\s*bpm/i);
    if (bpm) { tempo = Number(bpm[1]); continue; }

    // The first line is the title; a short second line is the artist.
    if (!title) { title = t; continue; }
    if (!artist && classifyChartLine(t).type === "lyric" && t.length <= 48 && t.split(/\s+/).length <= 6) {
      artist = t;
      continue;
    }
    break;
  }
  if (!title) {
    title = basename(String(filename), extname(String(filename)))
      .replace(/[-_]+/g, " ")
      .replace(/\bchord\s*chart\b|\btxt\b|\bfile\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    warnings.push("Title taken from the filename");
  }

  // ── body ──────────────────────────────────────────────────────────────────
  const read = lines.slice(i).map((line, n) => ({ pageIndex: 0, y: n, elements: textLineElements(line, n, tabWidth) }));
  const { body } = chartBody(read, { title, artist });
  const sections = body.filter((l) => /^\{comment:/.test(l)).length;
  const chordLines = body.filter((l) => /\[[^\]]+\]/.test(l) || /^\|/.test(l)).length;
  const lyricLines = body.filter((l) => l.trim() && !/^\{/.test(l) && /[a-z]{2}/i.test(l.replace(/\[[^\]]*\]/g, ""))).length;

  if (chordLines === 0) warnings.push("No chord lines found");
  if (sections === 0) warnings.push("No sections detected");

  const credited = normalizeArtist(artist);
  const directives = [`{title: ${title}}`];
  if (credited) directives.push(`{artist: ${credited}}`);
  if (key) directives.push(`{key: ${key}}`);
  if (tempo) directives.push(`{tempo: ${tempo}}`);

  // Columns here were typed by a person, so this is more trustworthy than the
  // geometry-derived PDF path — but it is still an import, so still a draft.
  let score = 0.9;
  const reasons = [];
  if (chordLines === 0) { score -= 0.4; reasons.push("no chords"); }
  if (sections === 0) { score -= 0.2; reasons.push("no sections"); }
  if (!key) { score -= 0.1; reasons.push("no key"); }
  if (lyricLines < 4) { score -= 0.15; reasons.push("almost no lyrics"); }
  score = Math.max(0, Math.round(score * 100) / 100);

  return {
    title,
    chordProContent: `${[...directives, "", ...body].join("\n")}\n`,
    metadata: { title, artist: credited, key, tempo, year: null, isDraft: true },
    warnings,
    confidence: { score, band: score >= 0.85 ? "high" : score >= 0.6 ? "medium" : "low", reasons },
  };
}
