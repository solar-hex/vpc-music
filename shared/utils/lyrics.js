/**
 * Whether two charts are the same song, judged by their words.
 *
 * A shared title proves nothing ("Thank You" is two songs by two writers), and
 * a different title proves nothing either: the church's Word lyric sheets are
 * named by their first line, so "Press On" and "We press on" are one song.
 * The sung words, with the chords stripped, are what two copies share.
 *
 * Measured on the library (842 songs, 2026-09-15): pairs sharing 60% or more
 * of the shorter song's three-word runs are nearly all the same song (70
 * pairs). Below that they are the same song mostly when the titles also agree
 * ("Breath On Me" at 32%, "Satan Your Kingdom Must Come Down" at 38%), and
 * otherwise are two songs quoting one line. Together: 98 pairs for a person.
 *
 * The corpus tools and the app's duplicate review both read this, so a
 * percentage means one thing everywhere.
 */
import { readDirective } from "./directives.js";

/** Most of the shorter song's words appear in the other: the same song. */
export const SAME_SONG_OVERLAP = 0.6;
/** With titles that agree, this much shared is still worth a look. */
export const SIMILAR_TITLE_OVERLAP = 0.25;
/** A few shared lines of a short sheet prove nothing on their own. */
export const MIN_SHARED_RUNS = 8;

/** Songs a person has said are not copies of this one. */
export const DISTINCT_DIRECTIVE = "x_distinct";
/** The song a copy was merged into. */
export const MERGED_INTO_DIRECTIVE = "x_merged_into";

/** The sung words of a chart, in order: no directives, chords or bar rows. */
export function lyricWords(content) {
  return String(content ?? "")
    .split("\n")
    .filter((line) => !/^\s*\{/.test(line) && !/^\s*\|/.test(line))
    .map((line) => line.replace(/\[[^\]]*\]/g, ""))
    .join(" ")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z]+/g, " ")
    .split(" ")
    .filter((word) => word.length > 1);
}

/** Every run of three words, so word order counts but line breaks do not. */
export function lyricShingles(content) {
  const words = lyricWords(content);
  const set = new Set();
  for (let i = 0; i + 3 <= words.length; i += 1) set.add(words.slice(i, i + 3).join(" "));
  return set;
}

/**
 * How much of the shorter lyric appears in the longer one: 1 is all of it.
 * Containment rather than similarity, because a lyrics sheet that prints the
 * chorus once is still the same song as a chart that prints it three times.
 */
export function lyricOverlap(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let common = 0;
  for (const shingle of small) if (large.has(shingle)) common += 1;
  return common / small.size;
}

const TITLE_FILLER = new Set(["a", "an", "the", "of", "in", "on", "to", "and", "for", "is", "it", "i", "me", "my", "you", "your", "oh", "o", "be"]);

/** The words of a title that can tell two songs apart. */
export function titleWords(title) {
  return String(title ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word && !TITLE_FILLER.has(word));
}

/** How much of the shorter title's words the other title has: 1 is all of them. */
export function titleAgreement(a, b) {
  const left = new Set(titleWords(a));
  const right = new Set(titleWords(b));
  if (left.size === 0 || right.size === 0) return 0;
  let common = 0;
  for (const word of left) if (right.has(word)) common += 1;
  return common / Math.min(left.size, right.size);
}

/** Ids from a `{x_distinct: id; id}` directive. */
export function distinctIds(content) {
  return readDirective(content, DISTINCT_DIRECTIVE)
    .split(/[;,\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * Pairs of songs that may be copies of one song, most alike first.
 *
 * A copy already merged into another song is left out, and so is a pair a
 * person has marked as two different songs.
 *
 * @param {Array<{id: string, title: string, content: string}>} songs
 * @returns {Array<{a: string, b: string, overlap: number, shared: number, titlesAgree: boolean}>}
 */
export function findDuplicatePairs(songs) {
  const items = [];
  for (const song of songs) {
    if (readDirective(song.content, MERGED_INTO_DIRECTIVE).trim()) continue;
    items.push({ id: song.id, title: song.title, runs: lyricShingles(song.content), distinct: new Set(distinctIds(song.content)) });
  }

  // Only songs sharing at least one run can be alike, so an index keeps this
  // near-linear instead of comparing every song with every other.
  const index = new Map();
  items.forEach((item, i) => {
    for (const run of item.runs) {
      if (!index.has(run)) index.set(run, []);
      index.get(run).push(i);
    }
  });

  const pairs = [];
  items.forEach((left, i) => {
    const shared = new Map();
    for (const run of left.runs) {
      for (const j of index.get(run)) if (j > i) shared.set(j, (shared.get(j) ?? 0) + 1);
    }
    for (const [j, count] of shared) {
      const right = items[j];
      if (left.distinct.has(right.id) || right.distinct.has(left.id)) continue;
      const overlap = count / Math.min(left.runs.size, right.runs.size);
      const titlesAgree = titleAgreement(left.title, right.title) >= 0.5;
      const alike =
        (overlap >= SAME_SONG_OVERLAP && count >= MIN_SHARED_RUNS) ||
        (titlesAgree && overlap >= SIMILAR_TITLE_OVERLAP && count >= 4);
      if (!alike) continue;
      const [a, b] = left.id < right.id ? [left.id, right.id] : [right.id, left.id];
      pairs.push({ a, b, overlap, shared: count, titlesAgree });
    }
  });
  return pairs.sort((x, y) => y.overlap - x.overlap || y.shared - x.shared || x.a.localeCompare(y.a) || x.b.localeCompare(y.b));
}
