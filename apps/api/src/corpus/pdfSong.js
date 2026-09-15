/**
 * Convert a chord-chart PDF into ChordPro.
 *
 * Extraction is local (`pdfTextLocal.js`); the page layout (header, columns,
 * lines) is `features/songs/pdfToChordPro.js`. This module reads what each line
 * of the chart MEANS — section, chords, bars, a performance note, a lyric — and
 * assembles the document.
 */
import { basename } from "node:path";
import { assembleLines, detectColumns } from "../features/songs/pdfToChordPro.js";
import { isChordToken } from "@vpc-music/shared";
import { normalizeCredits } from "./artists.js";
import { charOffsets, coalesceRuns, extractPdfElements, readChartHeader, renderLine } from "./pdfTextLocal.js";

// Re-exported: these were defined here first, and the tests import them from here.
export { coalesceRuns, renderLine };

const SECTION_WORD =
  "intro|verse|chorus|pre[- ]?chorus|bridge|tag|outro|ending|end|interlude|instrumental|vamp|refrain|turnaround|breakdown|solo|hook|coda|reprise|channel";

/** Words that describe how a section is played, never what is sung. */
const ARRANGEMENT_WORD =
  "guitars?|keys|piano|organ|drums?|bass|band|synth|pads?|strings|choir|vocals?|voices?|riff(?:ing|s)?|only|solo|loop|click|build(?:ing)?|hits?|soft(?:ly)?|big|full|light|down|out|no|all|instrumental|a\\s?cappella|unison|parts|tacet|groove|feel|double|half|time|with|and|&";

/** Every bracketed group in a string, unwrapped: "(Key Change) (Parts)" → both. */
function parenthesised(text) {
  return [...String(text).matchAll(/\(((?:[^()]|\([^()]*\))*)\)/g)].map((m) => m[1].trim()).filter(Boolean);
}

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
   * A section header, with any repeat counts, parts or cross-references it
   * carries — as many as the chart gives: "Verse 2 (Key Change) (Parts)".
   *
   * What may follow the section word is deliberately narrow: a number, a roman
   * numeral, a joining word, or another section word. Allowing arbitrary text
   * would swallow lyrics that happen to open with one — "Bridge over troubled
   * water carries me home" is a line, not a heading.
   */
  // "&" and "," may sit against the number ("Vamp 1& 2"), so they take their
  // own branch; keeping them out of `tail` leaves one way to match each, and a
  // line of repeated "& & &" cannot send the match exponential.
  // The number may sit against the "&" too ("Verse 1&2"); only with no space,
  // so " & 2" still has exactly one way to match.
  const name = `(?:${SECTION_WORD})(?:\\s*[&,](?:\\d+[a-z]?)?|\\s+(?:\\d+[a-z]?|[ivx]+|and|to|[-–—]|${SECTION_WORD}))*`;
  const notesGroup = `((?:\\s*\\((?:[^()]|\\([^()]*\\))*\\))*)`;
  const nameOf = (raw) =>
    raw.replace(/\s*&\s*/g, " & ").replace(/\s+/g, " ").replace(/[\s,&–—-]+$/, "").trim();

  const section = t.match(new RegExp(`^(${name})${notesGroup}\\s*:?$`, "i"));
  if (section) {
    // "Intro – (loop only)": the dash introduces the note, it is not the name.
    const sectionName = nameOf(section[1]);
    if (sectionName.length > 0 && sectionName.length <= 48) {
      const notes = parenthesised(section[2]);
      return { type: "section", name: sectionName, note: notes.length > 0 ? notes.join(", ") : null };
    }
  }

  /*
   * A section with how to play it written after the name: "Interlude Guitars
   * riffing", "Intro (2x) Keys only", "Vamp 1 & 2 same as Chorus". Only
   * arrangement words or a cross-reference may follow, so "Bridge over troubled
   * water" still reads as a lyric.
   */
  // "1st time: 2x 2nd time: 1x" — which pass does what.
  const passes = `(?:(?:\\d+(?:st|nd|rd|th)|first|second|third|last)\\s+time:?(?:\\s+\\d+\\s?xs?)?)(?:\\s+(?:\\d+(?:st|nd|rd|th)|first|second|third|last)\\s+time:?(?:\\s+\\d+\\s?xs?)?)*`;
  const description = `(?:${ARRANGEMENT_WORD})(?:\\s+(?:${ARRANGEMENT_WORD}))*|same\\s+as\\s+${name}|${passes}`;
  const described = t.match(new RegExp(`^(${name})${notesGroup}\\s*[-–—:]?\\s+(${description})$`, "i"));
  if (described) {
    const sectionName = nameOf(described[1]);
    if (sectionName.length > 0 && sectionName.length <= 48) {
      const notes = [...parenthesised(described[2]), described[3].replace(/\s+/g, " ").trim()];
      return { type: "section", name: sectionName, note: notes.join(", ") };
    }
  }

  // The road map: "Pre-Chorus → Chorus". The arrow is a symbol-font glyph that
  // arrives as "à", so both are read.
  if (new RegExp(`^(?:${SECTION_WORD})(?:\\s+\\d+)?(?:\\s*(?:→|->|>|à)\\s*(?:${SECTION_WORD})(?:\\s+\\d+)?)+$`, "i").test(t)) {
    return { type: "note", text: t.replace(/\s*(?:->|>|à)\s*/g, " → ") };
  }

  // Performance directions: "1st time only:", "(2x)", "a cappella", "Key change".
  if (/^\*?(\d+(st|nd|rd|th)\s+time|repeat|last time|a\s?cappella|slowly|rit\.?|key\s+change)\b/i.test(t) || /^\(.*\)$/.test(t)) {
    return { type: "note", text: t.replace(/^\(|\)$/g, "").trim() };
  }

  const tokens = t.split(/\s+/).filter(Boolean);
  const chordish = tokens.filter((x) => isChordToken(x) || /^[A-G][b#]?([a-z0-9#/()+-]*)$/.test(x));
  if (tokens.length > 0 && chordish.length === tokens.length) return { type: "chord" };

  return { type: "lyric" };
}

/* ─── reading a row as tokens ─────────────────────────────────────────────── */

/**
 * A chord as these charts print it: DbM7, Em7(b5), G7(#5#9), Ab2/C, C#°7, E7sus4.
 * Tighter than "starts with A to G", because a lyric row is only music when
 * EVERY token is — and "Be", "God" and "Amen" all start with a note name.
 */
const CHORD_SHAPE =
  /^\*?[A-G][b#]?(?:maj|min|dim|aug|sus|add|m|M|°|º|ø|Ø|Δ|\+)?\d{0,2}(?:\((?:no|omit|add|sus)?[#b]?\d{0,2}(?:[/,]?(?:no|omit|add|sus)?[#b]?\d{1,2})*\)|(?:sus|add|maj|[#b])\d{1,2})*(?:\/[A-G][b#]?)?$/;

/**
 * A chord written the way the transposer reads it, so a chart in another key
 * still moves every chord. The charts write diminished three ways ("G#o7",
 * "Dº", "D°") and the engine knows only "°"; a lowercase o counts only with an
 * accidental or a number after it, because "Go" and "Do" are words.
 */
function chordSpelling(token) {
  return String(token)
    .trim()
    .replace(/^(\*?[A-G])(?:([b#])o(?=\d|\/|$)|o(?=\d))/, (m, root, accidental) => `${root}${accidental ?? ""}°`)
    .replace(/º/g, "°")
    .replace(/Ø/g, "ø")
    // "C7(b9/#5)": a slash between alterations, never a bass note in brackets like "(B/D#)"
    .replace(/\(([#b\d/,]+)\)/g, (m, inner) => `(${inner.replace(/[/,]/g, "")})`)
    .replace(/[–—]/g, "-");
}

/**
 * A chord, loosely enough for the charts and tightly enough for lyrics: a
 * CHORD_SHAPE, a new bass note alone ("/Ab"), or quick chords joined by
 * dashes with no brackets ("Cm-G7", "E2/G#-A").
 */
function isChordish(token) {
  const t = chordSpelling(token);
  const single = (part) => CHORD_SHAPE.test(part) || isChordToken(part);
  if (single(t) || /^N\.?C\.?$/i.test(t) || /^\/[A-G][b#]?$/.test(t)) return true;
  const run = t.split(/[-–—]/);
  return run.length > 1 && run.every((part) => part.length > 0 && single(part));
}

/** A cue that belongs to the chord it follows: "Dm7 (hits)", "F(cut)". */
const CUE_WORDS = "cut|hits?|hold|stop|push|choke|staccato|accent";
const CHORD_CUE = new RegExp(`^\\((?:${CUE_WORDS})\\)$`, "i");
const CHORD_WITH_CUE = new RegExp(`^(.+?)\\s*(\\((?:${CUE_WORDS})\\))$`, "i");

/** Bar-line furniture: "|", "||:", ":||", "/" for a beat, "%" for a repeat. */
const BAR_TOKEN = /^(?:\|{1,2}:?|:?\|{1,2}|\/|%)$/;

/** An instruction worth lifting off the end of a lyric: "(repeat)", "(2x)". */
const INSTRUCTION =
  /\b(?:repeat|\d+\s*xs?|x\s*\d+|\d+(?:st|nd|rd|th)\s+time|last\s+(?:time|x)|key\s+change|build|cut|hold|a\s?cappella|unison|parts|solo|slow(?:ly)?|rit|return|to\s+end|as\s+(?:desired|dir)|loop|hits|tacet|ad\s?lib)\b/i;

/**
 * "(Ab – G)", "(D-C-Bb-A)", "(C C B B G)": a run of passing chords, written the
 * one way the transposer reads, "(Ab-G)". Null when the brackets hold words.
 */
function chordRun(text) {
  const inner = String(text).replace(/^\(|\)$/g, "").trim();
  const parts = inner.split(/\s*[-–—]\s*|\s+/).filter(Boolean);
  if (parts.length === 0 || !parts.every(isChordish)) return null;
  return `(${parts.join("-")})`;
}

/**
 * The tokens of one row, each with its x and a kind: chord, bar, note or word.
 *
 * Bracketed groups are rejoined first ("(cut" + "music)"), a cue is glued to
 * the chord before it, and passing-chord runs are normalised.
 */
export function readChartRow(elements) {
  const pieces = coalesceRuns(elements).filter((t) => t.text.trim());

  const grouped = [];
  for (let i = 0; i < pieces.length; i += 1) {
    const start = pieces[i];
    if (start.text.startsWith("(") && !start.text.includes(")")) {
      let j = i;
      while (j + 1 < pieces.length && !pieces[j].text.includes(")")) j += 1;
      if (pieces[j].text.includes(")")) {
        const end = pieces[j];
        grouped.push({ ...start, text: pieces.slice(i, j + 1).map((p) => p.text).join(" "), width: end.x + end.width - start.x });
        i = j;
        continue;
      }
    }
    grouped.push(start);
  }

  // Directions written among the chords: "To Verse", "2nd time", "repeat".
  // Punctuation rides along: "To Verse:", "To Verse 2, first time only:".
  const sectionWord = new RegExp(`^(?:${SECTION_WORD})[:,]?$`, "i");
  const directed = [];
  for (let i = 0; i < grouped.length; i += 1) {
    const here = grouped[i].text;
    const next = grouped[i + 1]?.text ?? "";
    const after = grouped[i + 2]?.text ?? "";
    let span = 0;
    if (/^to$/i.test(here) && sectionWord.test(next)) span = /^\d+[a-z]?[:,]?$/i.test(after) ? 3 : 2;
    else if (/^(?:\d+(?:st|nd|rd|th)|first|second|third|last)$/i.test(here) && /^time[:,]?$/i.test(next)) span = /^only[:,]?$/i.test(after) ? 3 : 2;
    else if (/^repeat[:,]?$/i.test(here)) span = 1;
    if (span === 0) {
      directed.push(grouped[i]);
      continue;
    }
    const end = grouped[i + span - 1];
    directed.push({
      ...grouped[i],
      text: grouped.slice(i, i + span).map((p) => p.text).join(" "),
      width: end.x + end.width - grouped[i].x,
      direction: true,
    });
    i += span - 1;
  }

  // "C#/E# - D#m - C#" and "G#m- Eb/G": a dash links quick chords. Peel one
  // off a chord it is stuck to, so the chord still reads as a chord.
  const unlinked = [];
  for (const whole of directed) {
    if (whole.direction) {
      unlinked.push(whole);
      continue;
    }
    // "G#11(2x)": brackets stuck to a chord that are not part of it. Split them
    // off; the loop below makes a cue part of the chord and a count a note.
    const bracketed = whole.text.match(/^(.+?)(\([^()]*\))$/);
    const parts =
      bracketed && isChordish(bracketed[1]) && !isChordish(whole.text)
        ? (() => {
            const offsets = charOffsets(whole);
            const cut = bracketed[1].length;
            return [
              { ...whole, text: bracketed[1], width: offsets[cut] - offsets[0] },
              { ...whole, text: bracketed[2], x: offsets[cut], width: offsets[whole.text.length] - offsets[cut] },
            ];
          })()
        : [whole];
    for (const piece of parts) {
      const stuck = piece.text.match(/^([-–—]*)(.*?)([-–—]*)$/);
      if (!stuck[2] || (!stuck[1] && !stuck[3]) || !isChordish(stuck[2])) {
        unlinked.push(piece);
        continue;
      }
      const offsets = charOffsets(piece);
      const from = stuck[1].length;
      const to = from + stuck[2].length;
      if (stuck[1]) unlinked.push({ ...piece, text: stuck[1], width: offsets[from] - offsets[0] });
      unlinked.push({ ...piece, text: stuck[2], x: offsets[from], width: offsets[to] - offsets[from] });
      if (stuck[3]) unlinked.push({ ...piece, text: stuck[3], x: offsets[to], width: offsets[piece.text.length] - offsets[to] });
    }
  }

  const tokens = [];
  for (const piece of unlinked) {
    const text = piece.text.trim();
    const previous = tokens[tokens.length - 1];
    const withCue = text.match(CHORD_WITH_CUE);

    if (piece.direction) tokens.push({ ...piece, text: text.replace(/[:,]$/, ""), kind: "note" });
    else if (BAR_TOKEN.test(text)) tokens.push({ ...piece, text, kind: "bar" });
    // A linking dash, or an "x" marking a hit between chords.
    else if (/^[-–—]+$/.test(text) || /^x$/i.test(text)) tokens.push({ ...piece, text: /^x$/i.test(text) ? "x" : "-", kind: "dash" });
    else if (CHORD_CUE.test(text) && previous?.kind === "chord") {
      previous.text += text;
      previous.width = piece.x + piece.width - previous.x;
    } else if (isChordish(text)) tokens.push({ ...piece, text: chordSpelling(text), kind: "chord" });
    else if (/^(?:x\s?\d+|\d+\s?xs?)$/i.test(text)) tokens.push({ ...piece, text, kind: "note" });
    else if (withCue && isChordish(withCue[1])) tokens.push({ ...piece, text: `${chordSpelling(withCue[1])}${withCue[2]}`, kind: "chord" });
    else if (/^\(.*\)$/.test(text)) {
      const run = chordRun(text);
      tokens.push(run ? { ...piece, text: run, kind: "chord" } : { ...piece, text: text.slice(1, -1).trim(), kind: "note" });
    } else tokens.push({ ...piece, text, kind: "word" });
  }
  return tokens;
}

/** Chords and bars, with nothing a singer would sing. */
function isMusic(tokens) {
  return tokens.length > 0 && tokens.every((t) => t.kind !== "word") && tokens.some((t) => t.kind === "chord" || t.kind === "bar");
}

/**
 * A row of music, with its notes placed where they are read: a note ahead of
 * the chords is read first ("(cut music)  Cm7  Cm7"), one after them is read
 * after the line they sit over ("Bb  Cm7  (build)").
 */
function musicItem(tokens) {
  const firstMusic = tokens.findIndex((t) => t.kind !== "note");
  let lastMusic = tokens.length - 1;
  while (lastMusic > 0 && tokens[lastMusic].kind === "note") lastMusic -= 1;
  const middle = tokens.slice(firstMusic, lastMusic + 1);
  const music = middle.filter((t) => t.kind !== "note");
  // A dash at either end links nothing: "Interlude – (C-D-F-G) F" is a name,
  // punctuation, then chords.
  while (music.length > 0 && music[0].kind === "dash" && music[0].text === "-") music.shift();
  while (music.length > 0 && music[music.length - 1].kind === "dash" && music[music.length - 1].text === "-") music.pop();
  return {
    type: music.some((t) => t.kind === "bar") ? "bars" : "chords",
    tokens: music,
    notesBefore: [...tokens.slice(0, firstMusic), ...middle.filter((t) => t.kind === "note")].map((t) => t.text),
    notesAfter: tokens.slice(lastMusic + 1).map((t) => t.text),
  };
}

/**
 * What one line of the chart is, as one or more items. Most lines are one; a
 * section name with its chords on the same row ("Intro  D  Bm7  A  G") is two.
 */
export function interpretChartLine(line) {
  const rendered = renderLine(line.elements);
  const text = rendered.text.replace(/\s+/g, " ").trim();
  if (!text) return [];

  const tokens = readChartRow(line.elements);
  if (isMusic(tokens)) return [musicItem(tokens)];

  /*
   * A section name with its music on the same row: "Intro  D  Bm7  A  G".
   * Checked before the whole line, and the SHORTEST name wins, because a
   * passing-chord run right after the name ("Intro (Ab - G) DbM7") also reads
   * as a note in brackets — and as a note it would never transpose.
   */
  for (let k = 1; k < tokens.length; k += 1) {
    const rest = tokens.slice(k);
    if (!isMusic(rest)) continue;
    const head = classifyChartLine(tokens.slice(0, k).map((t) => t.text).join(" "));
    if (head.type === "section") return [head, musicItem(rest)];
  }

  const whole = classifyChartLine(text);
  if (whole.type === "section" || whole.type === "note") return [whole];

  // "Reign, reign, reign. (repeat)" and "…worship You.    2x": the lyric, then
  // the instruction as a note.
  const trailing =
    rendered.text.match(/^(.*\S)\s*\(([^()]+)\)\s*$/) ?? rendered.text.match(/^(.*\S)\s+(\d+\s?xs?|x\s?\d+)\s*$/i);
  if (trailing && INSTRUCTION.test(trailing[2])) {
    const keep = trailing[1].length;
    return [
      { type: "lyric", text: trailing[1].replace(/\s+/g, " ").trim(), rendered: { text: rendered.text.slice(0, keep), xs: rendered.xs.slice(0, keep) } },
      { type: "note", text: trailing[2].trim() },
    ];
  }

  return [{ type: "lyric", text, rendered }];
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
 *
 * The nearest letter is deliberately all there is. Publishers set a chord over
 * a particular letter, often the vowel ("unw[G]orthy", "surre[Bb2]nder"), and
 * scored against the 20 songs that also have a chart a person typed, snapping
 * chords to word starts or off spaces put fewer on the right word (73%), not
 * more (81%). One correction does hold: a chord printed after the last word
 * goes after it.
 *
 * `chordLine.tokens` (from readChartRow) is used when present, so cues and
 * passing-chord runs arrive already joined; otherwise the runs are coalesced.
 */
export function mergeByPosition(chordLine, lyricLine) {
  const rendered = lyricLine.rendered ?? renderLine(lyricLine.elements || []);
  const text = rendered.text;
  if (!text.trim()) return null;

  const positions = rendered.xs.map((x, idx) => ({ idx, x }));
  const lastX = rendered.xs[rendered.xs.length - 1] ?? 0;
  const charWidth = rendered.xs.length > 1 ? (lastX - rendered.xs[0]) / (rendered.xs.length - 1) : 5;

  const chords = (chordLine.tokens ?? coalesceRuns(chordLine.elements || [])).filter((e) => e.text.trim());

  // Several chords printed before the words begin come before them, across the
  // gap they were printed over: "[B11]   [E]   [A]   oh oh", not
  // "[B11]o[E]h[A] oh". One chord just left of the first word stays on it,
  // which is where a musician reads it.
  const firstX = rendered.xs[0] ?? 0;
  const early = chords.filter((chord) => chord.x < firstX - charWidth * 1.5);
  const lead = early.length >= 2 ? early : [];
  let prefix = "";
  lead.forEach((chord, n) => {
    const name = chord.text.trim();
    const until = lead[n + 1]?.x ?? firstX;
    prefix += `[${name}]${" ".repeat(Math.max(1, Math.round((until - chord.x) / charWidth) - name.length))}`;
  });

  let out = text;
  let shift = 0;
  let last = -1;
  for (const chord of chords.filter((c) => !lead.includes(c))) {
    let best = 0;
    let dist = Infinity;
    for (const p of positions) {
      const d = Math.abs(p.x - chord.x);
      if (d < dist) { dist = d; best = p.idx; }
    }
    // Printed after the words end, it goes after them: "the Lamb.[Bb/D]", not
    // on the last letter.
    if (chord.x > lastX + charWidth * 1.5) best = text.length;
    if (best <= last) best = last + 1;   // never place two chords on one character
    if (best > text.length) best = text.length;
    last = best;
    const token = `[${chord.text.trim()}]`;
    const at = Math.min(best + shift, out.length);
    out = out.slice(0, at) + token + out.slice(at);
    shift += token.length;
  }
  return prefix + out;
}

/**
 * The older charts space a lyric out on tab stops ("Oh,              oh."),
 * which on a phone is a line of air that pushes the words onto a second row.
 * Four spaces still reads as a held beat, and still leaves a chord room to
 * sit over the gap, since the chart never prints two chords touching.
 */
function closeUp(line) {
  return String(line).replace(/ {5,}/g, "    ");
}

/** A bar row as the renderer's bar grid reads it: always opening on a bar. */
function barText(tokens) {
  const text = tokens.map((t) => t.text).join(" ");
  return /^\|/.test(text) ? text : `| ${text}`;
}

/** Lines that belong to the letterhead, not the song. */
const CHROME = /^(upci music ministry|www\.|copyright|©|ccli|page \d+|all rights reserved)/i;
/** The credit line we already parsed into directives. */
const CREDIT = /(key\s*:|tempo\s*:|written\s+by)/i;

/**
 * The ChordPro body of a chart, from its assembled lines.
 *
 * @param {Array} lines from assembleLines(detectColumns(elements))
 * @param {{title?: string|null, artist?: string|null}} [known] already read into directives
 * @returns {{body: string[], dropped: number, derived: number}}
 */
export function chartBody(lines, { title = null, artist = null } = {}) {
  const titleLower = String(title || "").toLowerCase();
  const artistLower = String(artist || "").toLowerCase();

  const items = [];
  let dropped = 0;
  let page = null;
  let pageStarted = false;
  for (const whole of lines) {
    if (whole.pageIndex !== page) {
      page = whole.pageIndex;
      pageStarted = false;
    }
    // The header is read into directives, on every page it repeats on.
    if (whole.elements.length > 0 && whole.elements.every((e) => e.region === "header")) { dropped += 1; continue; }
    // The footer ("UPCI Music Ministry") can share a baseline with the last
    // row of music, and then a chord row reads as a lyric. Drop the footer's
    // own run, not just a line that is nothing but footer.
    const line = { ...whole, elements: whole.elements.filter((e) => !CHROME.test(String(e.text).trim())) };
    if (line.elements.length === 0) { dropped += 1; continue; }
    const text = renderLine(line.elements).text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (CHROME.test(text) || CREDIT.test(text)) { dropped += 1; continue; }
    // The title and artist are letterhead only above the music. A chorus that
    // sings the title ("Speak the Name") is a lyric, and dropping it anywhere
    // on the page cost the line its chords, which then stood alone above the
    // next lyric.
    if (!pageStarted && titleLower && text.toLowerCase() === titleLower) { dropped += 1; continue; }
    if (!pageStarted && artistLower && text.toLowerCase() === artistLower) { dropped += 1; continue; }
    const read = interpretChartLine(line);
    if (read.length > 0) pageStarted = true;
    items.push(...read);
  }

  const body = [];
  let derived = 0;
  const note = (text) => body.push(`{ci: ${text}}`);

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const next = items[i + 1];

    // A name at the foot of one column, carried on at the head of the next,
    // is one section: "Chorus" … "Chorus (lyrics)".
    if (item.type === "section" && !item.note && next?.type === "section" && next.name.toLowerCase() === item.name.toLowerCase()) {
      continue;
    }

    if (item.type === "section") {
      if (body.length > 0) body.push("");
      body.push(`{comment: ${item.name}}`);
      if (item.note) {
        // "(2x)" and "(same as Verse 1 & 2)" are real instructions — keep them
        // visible as notes rather than dropping or silently expanding them.
        if (/same as/i.test(item.note)) derived += 1;
        note(item.note);
      }
      continue;
    }

    if (item.type === "note") { note(item.text); continue; }

    if (item.type === "chords" || item.type === "bars") {
      item.notesBefore.forEach(note);
      // Chords ahead of the first bar line sit over the lyric below:
      // "Cm7  Bb/D  | / / / Bb/C" is two chords on "the Lamb.", then a bar.
      const firstBar = item.tokens.findIndex((t) => /\|/.test(t.text));
      // Over a lyric, a linking dash has done its job: the chords' positions
      // already say how quickly they come.
      const overLyric = (item.type === "chords" ? item.tokens : item.tokens.slice(0, Math.max(firstBar, 0))).filter(
        (t) => t.kind !== "dash",
      );
      const merged =
        next?.type === "lyric" && overLyric.length > 0 && overLyric.every((t) => t.kind === "chord")
          ? mergeByPosition({ tokens: overLyric }, next)
          : null;
      if (merged) {
        body.push(closeUp(merged));
        if (item.type === "bars") body.push(barText(item.tokens.slice(firstBar)));
        i += 1;
      } else if (item.type === "bars") {
        body.push(barText(item.tokens));
      } else {
        body.push(item.tokens.map((t) => (t.kind === "chord" ? `[${t.text}]` : t.text)).join(" "));
      }
      item.notesAfter.forEach(note);
      continue;
    }

    body.push(closeUp(item.text));
  }

  while (body.length > 0 && !body[0].trim()) body.shift();
  while (body.length > 0 && !body[body.length - 1].trim()) body.pop();
  return { body, dropped, derived };
}

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

  const { body, dropped, derived } = chartBody(assembleLines(detectColumns(elements)), {
    title: header.title,
    artist: rawArtist,
  });

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
