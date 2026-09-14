/**
 * Derived facts about a song: what its tag field says, how complete its
 * metadata is, and what tempo band it sits in.
 *
 * All three are DERIVED, never stored. A completeness column would be a cache
 * of six fields in the same row, and every write path — the API, bulk edit,
 * three importers, the offline queue replay — would have to remember to
 * recompute it. One miss and the library lies about which songs need work,
 * which is the one thing this exists to tell the truth about.
 *
 * Pure and dependency-free, so it runs in the browser over the already-loaded
 * library, in the corpus scripts over files, and in Node over the database.
 */

/* ─── the tag field ───────────────────────────────────────────────────────── */

/**
 * `songs.tags` carries four kinds of value at once:
 *
 *   hymn             a plain tag someone typed
 *   theme:blood      a theme the lexicon detected
 *   !theme:blood     a human said "no, it isn't" — a tombstone, not an absence
 *   flag:unlisted    a property of the song, not a subject
 *
 * The negation has to be stored, because an absence is indistinguishable from
 * "not scanned yet", and the next detection pass would put the theme straight
 * back. Reading it is therefore never a plain `split(",")`.
 *
 * A flag is separated from a plain tag because it is not something a musician
 * browses by, and because it must not make a song look catalogued: a song
 * whose only "tag" is `flag:unlisted` still has no tags.
 *
 * @param {string|null|undefined} raw
 * @returns {{tags:string[], themes:string[], negated:string[], flags:string[]}}
 */
export function parseTagField(raw) {
  const parts = String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const tags = [];
  const themes = [];
  const negated = [];
  const flags = [];
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower.startsWith("!theme:")) negated.push(lower.slice(7));
    else if (lower.startsWith("theme:")) themes.push(lower.slice(6));
    else if (lower.startsWith("flag:")) flags.push(lower.slice(5));
    else tags.push(part);
  }
  return {
    tags,
    themes: [...new Set(themes)],
    negated: [...new Set(negated)],
    flags: [...new Set(flags)],
  };
}

/** The inverse of `parseTagField`, with a stable order so diffs stay readable. */
export function formatTagField({ tags = [], themes = [], negated = [], flags = [] }) {
  return [
    ...tags,
    ...[...new Set(flags)].sort().map((f) => `flag:${f}`),
    ...[...new Set(themes)].sort().map((t) => `theme:${t}`),
    ...[...new Set(negated)].sort().map((t) => `!theme:${t}`),
  ].join(", ");
}

/**
 * Flags a song can carry, and what they mean.
 *
 * `unlisted` is the old site's tilde: a `~` in front of the filename kept a
 * song out of the default list until you triple-clicked search for `show all`.
 * Here it is provenance only. Kevin decided the church songs behind the tilde
 * should be listed, so it hides nothing. `secular` is the `~z_` prefix, which
 * marked the handful of non-church songs, and it is the flag that hides one.
 * Neither is access control: a hidden song still opens from a direct link.
 */
export const SONG_FLAGS = [
  // Provenance now, not visibility: the old site hid tilde songs, but the
  // church ones are listed here (see the isDraft rule in corpus/loadCorpus.js).
  { id: "unlisted", label: "Old site tilde", description: "Hidden on the old site. Listed here, because it is a church song.", hides: false },
  { id: "secular", label: "Secular", description: "Not a church song. Kept out of the song list.", hides: true },
];

export function flagLabel(id) {
  return SONG_FLAGS.find((f) => f.id === id)?.label ?? themeLabel(id);
}

/** Whether a flag keeps a song out of the song list. Unknown flags do not. */
export function flagHides(id) {
  return SONG_FLAGS.find((f) => f.id === id)?.hides === true;
}

/**
 * How a song's rehearsal-readiness status reads on screen, or null when there
 * is nothing worth saying.
 *
 * Only `missing_chords` is in use: the corpus loader sets it on a sheet whose
 * lyrics are complete but which carries no chords (see `hasChords`). The other
 * four values the column allows are legacy and unused, so they return null
 * rather than rendering raw snake case at a musician. A null status — the
 * ordinary case, 695 of 889 songs — says nothing, because "this song is
 * normal" is not a badge.
 */
export function songStatusLabel(status) {
  return status === "missing_chords" ? "Lyrics only" : null;
}

/** Just the flags on a song. */
export function songFlags(song) {
  return parseTagField(song?.tags).flags;
}

/** Just the themes asserted on a song. */
export function songThemes(song) {
  return parseTagField(song?.tags).themes;
}

/** A theme id as a person reads it: `holy-spirit` → `Holy Spirit`. */
export function themeLabel(id) {
  return String(id || "")
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/* ─── completeness ────────────────────────────────────────────────────────── */

/**
 * Weighted because not all metadata is equally useful for finding a song.
 * Title + artist = 60: those are the two the church named as essential — you
 * search for a song by what it is called and who sings it.
 *
 * NO YEAR. It was worth 5 here, and 888 of 889 songs have none — the legacy
 * library records a year for exactly one song (Amazing Grace, 1779) and there
 * is no source for the rest. A field nobody can fill docks every song five
 * points forever, which makes the whole score read five points too harsh and
 * puts a permanent "needs year" on every row. A measure of what is worth doing
 * should not include what cannot be done.
 */
export const COMPLETENESS_FIELDS = [
  { id: "title", label: "Title", weight: 30, essential: true },
  { id: "artist", label: "Artist", weight: 35, essential: true },
  { id: "key", label: "Key", weight: 15, essential: false },
  { id: "tempo", label: "Tempo", weight: 10, essential: false },
  { id: "tags", label: "Tags", weight: 10, essential: false },
];

function isPresent(field, song) {
  const value = song?.[field.id];
  if (field.id === "tempo") return Number.isFinite(Number(value)) && Number(value) > 0;
  if (field.id === "tags") {
    // A rejection (`!theme:x`) and a flag (`flag:unlisted`) are both data, but
    // neither is a tag: a song marked unlisted is not thereby catalogued.
    const { tags, themes } = parseTagField(value);
    return tags.length + themes.length > 0;
  }
  return String(value ?? "").trim().length > 0;
}

/**
 * @param {{title?, artist?, key?, tempo?, tags?, year?}} song
 * @returns {{percent:number, missing:string[], present:string[], hasEssentials:boolean, fields:Array}}
 */
export function songCompleteness(song, options = {}) {
  const defs = options.fields ?? COMPLETENESS_FIELDS;
  const fields = defs.map((f) => ({ ...f, present: isPresent(f, song) }));
  const percent = Math.round(fields.reduce((sum, f) => (f.present ? sum + f.weight : sum), 0));
  const missing = fields
    .filter((f) => !f.present)
    .sort((a, b) => Number(b.essential) - Number(a.essential) || b.weight - a.weight)
    .map((f) => f.id);
  return {
    percent,
    missing,
    present: fields.filter((f) => f.present).map((f) => f.id),
    hasEssentials: fields.every((f) => !f.essential || f.present),
    fields,
  };
}

/** The bands the library page groups by, worst first. */
export const COMPLETENESS_BANDS = [
  { id: "90-100", label: "90–100%", min: 90, max: 100 },
  { id: "70-89", label: "70–89%", min: 70, max: 89 },
  { id: "50-69", label: "50–69%", min: 50, max: 69 },
  { id: "30-49", label: "30–49%", min: 30, max: 49 },
  { id: "0-29", label: "Under 30%", min: 0, max: 29 },
];

/** @returns {"90-100"|"70-89"|"50-69"|"30-49"|"0-29"} */
export function completenessBand(percent) {
  const n = Number(percent) || 0;
  const band = COMPLETENESS_BANDS.find((b) => n >= b.min && n <= b.max);
  return band ? band.id : "0-29";
}

/* ─── tempo bands ─────────────────────────────────────────────────────────── */

/**
 * Worship-specific boundaries. `shout` is not padding — `songs.shout` already
 * exists on the table, which is the church telling you the category is real.
 *
 * NOTE there are two other BPM scales in this repo (`songEnergy` in
 * shared/utils/flow.js, and the stats route's SQL). They answer different
 * questions but should be consolidated onto this one.
 */
export const TEMPO_BANDS = [
  { id: "slow", label: "Slow", min: null, max: 75 },
  { id: "medium", label: "Medium", min: 76, max: 105 },
  { id: "fast", label: "Fast", min: 106, max: 139 },
  { id: "shout", label: "Shout", min: 140, max: null },
];

/** @returns {"slow"|"medium"|"fast"|"shout"|null} */
export function tempoBand(bpm) {
  const n = Number(bpm);
  if (!Number.isFinite(n) || n <= 0) return null;
  for (const band of TEMPO_BANDS) {
    if ((band.min === null || n >= band.min) && (band.max === null || n <= band.max)) return band.id;
  }
  return null;
}

/** Band id -> the inclusive params `GET /songs` already accepts. */
export function tempoBandRange(bandId) {
  const band = TEMPO_BANDS.find((b) => b.id === bandId);
  if (!band) return null;
  return {
    ...(band.min !== null ? { tempoMin: band.min } : {}),
    ...(band.max !== null ? { tempoMax: band.max } : {}),
  };
}

/**
 * BPM is ambiguous by a factor of two — 6/8 songs get written either way — so
 * the band is advisory and the number is always shown beside it.
 */
export function tempoBandLabel(bpm) {
  const id = tempoBand(bpm);
  if (!id) return null;
  const band = TEMPO_BANDS.find((b) => b.id === id);
  return `${band.label} · ${bpm} BPM`;
}

/* ─── chords ──────────────────────────────────────────────────────────────── */

/** Does this chart carry any chords at all? Drives `status = missing_chords`. */
export function hasChords(chordProSource) {
  const text = String(chordProSource || "");
  for (const m of text.matchAll(/\[([^\]]*)\]/g)) {
    const token = m[1].trim();
    if (!token) continue;
    if (/^[A-G]/.test(token)) return true;
  }
  return false;
}
