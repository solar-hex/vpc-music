/**
 * Derive song themes ("blood", "cross", "heaven", "jubilee", …) from lyrics.
 *
 * Deterministic lexicon rather than an LLM pass, because this has to be
 * reviewable (it reports the matched word and the line it came from), free to
 * re-run, identical every time, and workable offline — an LLM pass fails at
 * exactly the church with no internet that tranche 2 exists for.
 *
 * The merge rule is the part that matters most: a re-run may only ever ADD.
 * A human's "no" is stored as data (`!theme:x`) rather than as an absence, so
 * broadening the lexicon next month never silently undoes a correction.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatTagField, parseChordPro, parseTagField } from "@vpc-music/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_LEXICON = resolve(__dirname, "../../../../corpus/themes.json");

let cached = null;

/** Load (and cache) the committed lexicon. */
export function loadThemes(path = DEFAULT_LEXICON) {
  if (cached && cached.path === path) return cached.data;
  const data = JSON.parse(readFileSync(path, "utf8"));
  cached = { path, data };
  return data;
}

/**
 * Lyrics only. Nothing else may contribute a match: not the title, not the
 * `{key:}` directive, not section headers like "Chorus", not `{ci:}` notes,
 * and not chord tokens. Parsing and taking only the lyric text is the only
 * reliable way — a plain-text render still carries headers and directives.
 */
export function lyricsOf(chordProSource) {
  const doc = parseChordPro(String(chordProSource || ""));
  const parts = [];
  for (const section of doc.sections || []) {
    for (const line of section.lines || []) {
      if (line.note) continue; // an italic performance note, not lyrics
      if (line.lyrics) parts.push(line.lyrics);
    }
  }
  return parts
    .join(" ")
    .toLowerCase()
    .replace(/[‘’']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countTerm(haystack, term) {
  // Whole-word (or whole-phrase) match, so "bloodline" never triggers "blood".
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Single words also match their plural, so "new mercies" meets "mercy" and
  // "his compassions" meets "compassion". Phrases stay exact.
  const body = term.includes(" ")
    ? escaped
    : `${escaped.replace(/y$/, "(?:y|ies)")}(?:e?s)?`;
  const re = new RegExp(`(^|\\s)${body}(\\s|$)`, "g");
  let n = 0;
  while (re.exec(haystack) !== null) n += 1;
  return n;
}

/**
 * Themes present in a chart's lyrics.
 *
 * Scores by DISTINCT terms matched, not occurrences, so a repeated chorus
 * cannot inflate a theme on its own.
 *
 * @returns {Array<{id, label, score, strong, hits: string[]}>} sorted, strongest first
 */
export function detectThemes(chordProSource, options = {}) {
  const lexicon = options.lexicon ?? loadThemes(options.lexiconPath);
  const text = ` ${lyricsOf(chordProSource)} `;
  if (!text.trim()) return [];

  const found = [];
  for (const theme of lexicon.themes) {
    if ((theme.exclude || []).some((phrase) => countTerm(text, phrase.toLowerCase()) > 0)) continue;

    const hits = [];
    let strong = 0;
    for (const term of theme.strongTerms || []) {
      if (countTerm(text, term.toLowerCase()) > 0) { hits.push(term); strong += 1; }
    }
    for (const term of theme.terms || []) {
      if (countTerm(text, term.toLowerCase()) > 0) hits.push(term);
    }

    const threshold = theme.threshold ?? lexicon.defaultThreshold ?? 2;
    // One strong term asserts the theme; weak terms need to agree with each other.
    if (strong > 0 || hits.length >= threshold) {
      found.push({ id: theme.id, label: theme.label, score: hits.length, strong: strong > 0, hits });
    }
  }
  return found.sort((a, b) => Number(b.strong) - Number(a.strong) || b.score - a.score || a.id.localeCompare(b.id));
}

/* ─── storing themes in songs.tags ───────────────────────────────────────── */

/*
 * Reading and writing the tags column lives in `shared/utils/library.js`: the
 * web app has to understand `theme:blood` and `!theme:blood` exactly the way
 * this pass writes them, and two copies of that rule would drift. Re-exported
 * here so the theme pipeline still reads as one module.
 */
export { formatTagField, parseTagField };

/**
 * Additive merge. The rule, in full:
 *
 *   add `theme:x`  ⟺  detected(x) ∧ `theme:x` ∉ tags ∧ `!theme:x` ∉ tags
 *   never remove anything
 *
 * So it is idempotent — merge(merge(t, d), d) === merge(t, d) — and a human's
 * rejection survives every future run and every lexicon edit.
 */
export function mergeThemes(existingTags, detectedThemeIds) {
  const { tags, themes, negated, flags } = parseTagField(existingTags);
  const negatedSet = new Set(negated);
  const next = new Set(themes);
  for (const id of detectedThemeIds) {
    if (!negatedSet.has(id)) next.add(id);
  }
  // `flags` rides through untouched. A theme pass that dropped it would delete
  // an unlisted marking the next time anyone re-ran the lexicon.
  return formatTagField({ tags, themes: [...next], negated, flags });
}

/**
 * Strip every asserted theme while PRESERVING every human rejection, so a
 * clean re-derivation still honours each "no". The escape hatch, never the
 * default.
 */
export function resetThemes(existingTags) {
  const { tags, negated, flags } = parseTagField(existingTags);
  return formatTagField({ tags, themes: [], negated, flags });
}

/** Record that a human removed a theme. */
export function rejectTheme(existingTags, themeId) {
  const { tags, themes, negated, flags } = parseTagField(existingTags);
  return formatTagField({
    tags,
    themes: themes.filter((t) => t !== themeId),
    negated: [...new Set([...negated, themeId])],
    flags,
  });
}
