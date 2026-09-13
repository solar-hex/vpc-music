/**
 * Song title matching.
 *
 * Exact matching badly undercounts this library — measured: 22 of 450 UPCI
 * folders, 62 of 281 service-calendar songs, 13 of 187 BPM files. The misses
 * are nearly all cosmetic:
 *
 *   "All in Him"                 vs "Its All In Him"
 *   "Every Praise"               vs "Every Praise Is To Our God"
 *   "I'll Fly Away (Hank CRD)"   vs "Ill Fly Away"
 *   "10,000 Reasons"             vs "Ten Thousand Reasons"
 *
 * Naive substring matching then over-corrects ("I Want to Be Holy" -> "Holy"),
 * so short titles are guarded: the fewer tokens a title has, the closer the
 * match must be.
 *
 * Lives here rather than in shared/ because only the corpus tooling needs it
 * today. It should move to shared/ when the web app's duplicate check
 * (`normalizeComparableText` in features/songs/routes.js) consolidates onto it.
 */

const COMBINING_MARKS = /[̀-ͯ]/g;

/** Written-out forms for the numbers that actually appear in song titles. */
const NUMBER_WORDS = new Map([
  ["1", "one"], ["2", "two"], ["3", "three"], ["4", "four"], ["5", "five"],
  ["6", "six"], ["7", "seven"], ["8", "eight"], ["9", "nine"], ["10", "ten"],
  ["100", "hundred"], ["1000", "thousand"], ["10000", "ten thousand"],
]);

/** Noise that gets appended to filenames but is never part of a song's name. */
const SOURCE_MARKERS =
  /\b(crd|chrd|chords?|chart|charts|lyrics?|sheet|sheets|pdf|docx?|txt|copy|final|draft|new|old|v\d+|x\d+|rev\d*)\b/g;

/**
 * Lowercase, de-accented, punctuation-free. The conservative normalisation:
 * it only removes things that can never distinguish two songs.
 */
export function normalizeTitle(title) {
  let t = String(title || "")
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[‘’']/g, "")       // its / it's collapse together
    .replace(/&/g, " and ")
    .replace(/\b(\d+),(\d{3})\b/g, "$1$2"); // 10,000 -> 10000

  // Spell out numbers so "10000 Reasons" meets "Ten Thousand Reasons".
  t = t.replace(/\b\d+\b/g, (d) => NUMBER_WORDS.get(d) ?? d);

  return t.replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * The aggressive key used for bucketing: also drops a leading article,
 * parenthetical qualifiers, and filename noise.
 */
export function titleKey(title) {
  let t = String(title || "")
    .replace(/\([^)]*\)/g, " ")   // "(Hank Williams CRD)"
    .replace(/\[[^\]]*\]/g, " ");
  t = normalizeTitle(t).replace(SOURCE_MARKERS, " ");
  t = t.replace(/^(the|a|an)\s+/, "");
  t = t.replace(/\s+\d+$/, "");   // a trailing hymnal number
  return t.replace(/\s+/g, " ").trim();
}

/**
 * Medleys and alternates yield several candidate keys, so
 * "Victory Chant / He Is Exalted" can match either half.
 */
export function titleVariants(title) {
  const raw = String(title || "");
  const whole = titleKey(raw);
  const candidates = [];

  // Medleys and "A / B" alternates: either half should match.
  for (const part of raw.split(/\s*(?:\/|\bmedley\b|\bwith\b|\s-\s)\s*/i)) {
    candidates.push(titleKey(part));
  }

  // A parenthetical alternate title — "Amazing Grace (My Chains Are Gone)" is
  // findable by either name. titleKey strips parentheticals, so recover them.
  for (const m of raw.matchAll(/\(([^)]+)\)/g)) {
    candidates.push(titleKey(m[1]));
  }

  const extra = candidates.filter((p) => p && p !== whole && p.split(" ").length >= 2);
  return [whole, ...new Set(extra)].filter(Boolean);
}

function tokens(value) {
  return value ? value.split(" ").filter(Boolean) : [];
}

/**
 * 0..1 similarity. 1 is an exact key match; a containment counts high but is
 * capped so a one-word title cannot swallow a longer one.
 */
export function titleSimilarity(a, b) {
  const ka = titleKey(a);
  const kb = titleKey(b);
  if (!ka || !kb) return 0;
  if (ka === kb) return 1;

  const ta = tokens(ka);
  const tb = tokens(kb);
  const shorter = Math.min(ta.length, tb.length);
  const shorterKey = ta.length <= tb.length ? ka : kb;

  // A one-word title must match exactly. This is the guard that stops
  // "Holy" swallowing "I Want to Be Holy" or "Bless His Holy Name".
  if (shorter <= 1) return 0;
  // Two-word titles are legitimate ("Every Praise", "Glorious Day"), but a very
  // short string like "he is" would match far too much.
  if (shorter === 2 && shorterKey.length < 8) return 0;

  const setA = new Set(ta);
  const setB = new Set(tb);
  let shared = 0;
  for (const t of setA) if (setB.has(t)) shared += 1;
  const jaccard = shared / (setA.size + setB.size - shared);

  // One title fully contained in the other: strong, but scaled by how much of
  // the longer title is explained by the shorter.
  const contained = ka.includes(kb) || kb.includes(ka);
  if (contained) {
    const ratio = Math.min(ta.length, tb.length) / Math.max(ta.length, tb.length);
    return Math.max(jaccard, 0.7 + 0.3 * ratio);
  }

  // All of the shorter title's words appear in the longer one.
  if (shared === shorter) return Math.max(jaccard, 0.75);

  return jaccard;
}

/**
 * Match a list of wanted titles against a library.
 *
 * @param {string[]} wanted
 * @param {Array<{id?:string, title:string, aka?:string|string[]|null}>} have
 * @param {{ strong?: number, weak?: number }} [thresholds]
 * @returns {{ matched: Array, probable: Array, missing: Array }}
 *   matched  — confident, use it
 *   probable — a human should confirm; resolving one by writing the wanted
 *              title into `songs.aka` fixes it permanently for future runs
 *   missing  — genuinely absent
 */
/**
 * Every name a song answers to: its title plus its aliases.
 *
 * `aka` is a single string on a database row and a list in the corpus, because
 * a song can carry several alternate titles. Both shapes are accepted so the
 * matcher works against either side.
 */
export function namesOf(song) {
  const aka = Array.isArray(song?.aka) ? song.aka : String(song?.aka || "").split(";");
  return [song?.title, ...aka].map((n) => String(n || "").trim()).filter(Boolean);
}

export function matchTitles(wanted, have, thresholds = {}) {
  const strong = thresholds.strong ?? 0.92;
  const weak = thresholds.weak ?? 0.72;

  // Index the library by every key it answers to, including `aka`.
  const index = new Map();
  for (const song of have) {
    for (const name of namesOf(song)) {
      for (const key of titleVariants(name)) {
        if (!index.has(key)) index.set(key, []);
        if (!index.get(key).includes(song)) index.get(key).push(song);
      }
    }
  }

  const matched = [];
  const probable = [];
  const missing = [];

  for (const title of wanted) {
    let hit = null;
    for (const key of titleVariants(title)) {
      const exact = index.get(key);
      if (exact && exact.length > 0) {
        hit = { song: exact[0], score: 1, others: exact.slice(1) };
        break;
      }
    }

    if (hit) {
      matched.push({ title, ...hit });
      continue;
    }

    // Fall back to scoring against the whole library.
    let best = null;
    for (const song of have) {
      const score = Math.max(...namesOf(song).map((name) => titleSimilarity(title, name)), 0);
      if (!best || score > best.score) best = { song, score };
    }

    if (best && best.score >= strong) matched.push({ title, ...best, others: [] });
    else if (best && best.score >= weak) probable.push({ title, ...best, others: [] });
    else missing.push({ title, best: best && best.score > 0 ? best : null });
  }

  return { matched, probable, missing };
}
