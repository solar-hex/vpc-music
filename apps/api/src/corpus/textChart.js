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
import { isChordToken } from "@vpc-music/shared";
import { normalizeArtist } from "./artists.js";
import { classifyChartLine } from "./pdfSong.js";

/** Decode UTF-16LE/BE or UTF-8, whichever the file actually is. */
export function decodeText(buffer) {
  const b = Buffer.from(buffer);
  if (b[0] === 0xff && b[1] === 0xfe) return b.toString("utf16le").replace(/^﻿/, "");
  if (b[0] === 0xfe && b[1] === 0xff) return b.swap16().toString("utf16le").replace(/^﻿/, "");
  return b.toString("utf8").replace(/^﻿/, "");
}

/** Every whitespace-separated token with the column it starts at. */
export function tokensWithColumns(line) {
  const out = [];
  for (const m of String(line).matchAll(/\S+/g)) out.push({ text: m[0], column: m.index });
  return out;
}

/** A line of nothing but chords. */
export function isChordOnlyLine(line) {
  const tokens = tokensWithColumns(line);
  if (tokens.length === 0) return false;
  return tokens.every((t) => isChordToken(t.text) || /^[A-G][b#]?[a-z0-9#/()+.-]*$/.test(t.text));
}

/**
 * Merge a chord line onto the lyric beneath it by character column — the
 * column a chord sits at is where it belongs, which is the whole convention
 * these charts are written in.
 */
export function mergeByColumn(chordLine, lyricLine) {
  const chords = tokensWithColumns(chordLine);
  if (chords.length === 0) return lyricLine;
  const lyric = String(lyricLine ?? "");
  let out = "";
  let cursor = 0;
  for (const chord of chords) {
    const at = Math.min(Math.max(chord.column, cursor), lyric.length);
    out += lyric.slice(cursor, at) + `[${chord.text}]`;
    cursor = at;
  }
  return (out + lyric.slice(cursor)).replace(/\s+$/, "");
}

/**
 * @param {string} filename
 * @param {Buffer|string} input
 * @returns {{title, chordProContent, metadata, warnings, confidence}}
 */
export function convertTextChartToChordPro(filename, input) {
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
    const t = lines[i].trim();
    if (!t) { if (title) { i += 1; break; } continue; }

    const k = t.match(/^key\s*[:\-]?\s*([A-G][b#]?m?(?:in)?)\b/i);
    if (k) { key = k[1]; continue; }
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
  const body = [];
  let chordLines = 0;
  let lyricLines = 0;
  let sections = 0;

  for (; i < lines.length; i += 1) {
    const raw = lines[i];
    const text = raw.trim();
    if (!text) continue;

    const kind = classifyChartLine(text);
    if (kind.type === "section") {
      if (body.length > 0) body.push("");
      body.push(`{comment: ${kind.name}}`);
      sections += 1;
      if (kind.note) body.push(`{ci: ${kind.note}}`);
      continue;
    }
    if (kind.type === "note") { body.push(`{ci: ${kind.text}}`); continue; }

    // "Intro     D  Bm7  A  G" — a heading with its chords on the same line.
    const inline = text.match(/^([A-Za-z][A-Za-z\s]*?)\s{2,}(.+)$/);
    if (inline && classifyChartLine(inline[1].trim()).type === "section" && isChordOnlyLine(inline[2])) {
      if (body.length > 0) body.push("");
      body.push(`{comment: ${classifyChartLine(inline[1].trim()).name}}`);
      body.push(tokensWithColumns(inline[2]).map((t) => `[${t.text}]`).join(" "));
      sections += 1;
      chordLines += 1;
      continue;
    }

    if (isChordOnlyLine(raw)) {
      // Attach to the next non-blank line when that line is a lyric.
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j += 1;
      const next = j < lines.length ? lines[j] : null;
      if (next && !isChordOnlyLine(next) && classifyChartLine(next.trim()).type === "lyric") {
        body.push(mergeByColumn(raw, next));
        chordLines += 1;
        lyricLines += 1;
        i = j;
        continue;
      }
      body.push(tokensWithColumns(raw).map((t) => `[${t.text}]`).join(" "));
      chordLines += 1;
      continue;
    }

    body.push(text);
    lyricLines += 1;
  }

  while (body.length > 0 && !body[body.length - 1].trim()) body.pop();

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
