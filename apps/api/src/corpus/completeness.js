/**
 * How complete is a song's metadata, and what tempo band is it in?
 *
 * Both are DERIVED, never stored. A completeness column would be a cache of
 * six fields in the same row, and every write path — the API, bulk edit, three
 * importers, the offline queue replay — would have to remember to recompute
 * it. One miss and the list lies about which songs need work, which is the one
 * thing this exists to tell the truth about.
 *
 * Pure and dependency-free. It belongs in shared/ the moment the web app's
 * "needs work" filter consumes it; there is no consumer there yet.
 */

/**
 * Weighted because not all metadata is equally useful for finding a song.
 * Title + artist = 60: those are the two Kevin named as essential.
 */
export const COMPLETENESS_FIELDS = [
  { id: "title", label: "Title", weight: 30, essential: true },
  { id: "artist", label: "Artist", weight: 30, essential: true },
  { id: "key", label: "Key", weight: 15, essential: false },
  { id: "tempo", label: "Tempo", weight: 10, essential: false },
  { id: "tags", label: "Tags", weight: 10, essential: false },
  { id: "year", label: "Year", weight: 5, essential: false },
];

function isPresent(field, song) {
  const value = song?.[field.id];
  if (field.id === "tempo") return Number.isFinite(Number(value)) && Number(value) > 0;
  if (field.id === "tags") {
    // `!theme:x` is a rejection, not a tag — it must not count as populated.
    return String(value || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !s.toLowerCase().startsWith("!theme:")).length > 0;
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
