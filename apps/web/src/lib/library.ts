import type { Song } from "@/lib/api-client";
import { matchesQuery, normalize } from "@/lib/song-search";
import {
  completenessBand,
  flagLabel,
  parseTagField,
  songCompleteness,
  tempoBand,
  themeLabel,
  COMPLETENESS_BANDS,
  COMPLETENESS_FIELDS,
  TEMPO_BANDS,
  type CompletenessBandId,
  type CompletenessField,
  type TempoBandId,
} from "@vpc-music/shared";

/**
 * The library seen as data rather than as a list of charts: how complete each
 * song is, what themes it carries, what tempo band it sits in — and the
 * filtering that turns any of those numbers into the songs behind it.
 *
 * Everything here runs over the library the app has already loaded, so it
 * works offline and needs no endpoint. The derivation itself lives in
 * `shared/utils/library.js`, which is also what the corpus scripts use, so the
 * percentages on screen are the same percentages the build reports.
 */

/** `none` is a real answer to "which tempo band?" and has to be filterable. */
export const NO_VALUE = "none";

export interface LibrarySong {
  song: Song;
  percent: number;
  band: CompletenessBandId;
  missing: CompletenessField["id"][];
  themes: string[];
  tags: string[];
  flags: string[];
  tempo: TempoBandId | typeof NO_VALUE;
  key: string;
  artist: string;
  /** Whether the sheet carries chords, or is lyrics only. */
  content: ContentKind;
}

/** `songs.status` is "missing_chords" on a complete lyrics sheet with no chords. */
export type ContentKind = "chords" | "lyrics";
export const CONTENT_KINDS: { id: ContentKind; label: string }[] = [
  { id: "chords", label: "With chords" },
  { id: "lyrics", label: "Lyrics only" },
];

/** Derive once per song; every facet count and filter reads these. */
export function decorate(songs: Song[]): LibrarySong[] {
  return songs.map((song) => {
    const completeness = songCompleteness(song);
    const { tags, themes, flags } = parseTagField(song.tags);
    return {
      song,
      percent: completeness.percent,
      band: completenessBand(completeness.percent),
      missing: completeness.missing,
      themes,
      tags,
      flags,
      tempo: tempoBand(song.tempo) ?? NO_VALUE,
      key: song.key?.trim() || NO_VALUE,
      artist: song.artist?.trim() || NO_VALUE,
      content: song.status === "missing_chords" ? "lyrics" : "chords",
    };
  });
}

/* ─── filtering ───────────────────────────────────────────────────────────── */

export type DraftMode = "hide" | "show" | "only";

export interface LibraryFilter {
  query: string;
  /** Facet selections: OR within a facet, AND across facets. */
  themes: string[];
  keys: string[];
  tempos: string[];
  artists: string[];
  /** Properties of the song: unlisted, secular. */
  flags: string[];
  /** Completeness fields a song must be MISSING — the "needs work" filter. */
  missing: string[];
  bands: string[];
  /** "chords" / "lyrics" — a lyrics sheet is complete, just chordless. */
  content: string[];
  drafts: DraftMode;
}

export const EMPTY_FILTER: LibraryFilter = {
  query: "",
  themes: [],
  keys: [],
  tempos: [],
  artists: [],
  flags: [],
  missing: [],
  bands: [],
  content: [],
  drafts: "show",
};

/** Each facet as its own predicate, so a facet can be left out when counting it. */
const FACET_TESTS = {
  query: (row: LibrarySong, f: LibraryFilter) => matchesQuery(row.song, f.query),
  drafts: (row: LibrarySong, f: LibraryFilter) =>
    f.drafts === "show" ? true : f.drafts === "only" ? Boolean(row.song.isDraft) : !row.song.isDraft,
  themes: (row: LibrarySong, f: LibraryFilter) => f.themes.some((t) => row.themes.includes(t)),
  keys: (row: LibrarySong, f: LibraryFilter) => f.keys.includes(row.key),
  tempos: (row: LibrarySong, f: LibraryFilter) => f.tempos.includes(row.tempo),
  artists: (row: LibrarySong, f: LibraryFilter) => f.artists.includes(row.artist),
  flags: (row: LibrarySong, f: LibraryFilter) => f.flags.some((flag) => row.flags.includes(flag)),
  missing: (row: LibrarySong, f: LibraryFilter) => f.missing.some((m) => row.missing.includes(m as CompletenessField["id"])),
  bands: (row: LibrarySong, f: LibraryFilter) => f.bands.includes(row.band),
  content: (row: LibrarySong, f: LibraryFilter) => f.content.includes(row.content),
} as const;

export type FacetName = keyof typeof FACET_TESTS;

/** A facet with nothing selected constrains nothing. */
function isActive(name: FacetName, filter: LibraryFilter): boolean {
  if (name === "query") return filter.query.trim().length > 0;
  if (name === "drafts") return filter.drafts !== "show";
  return (filter[name] as string[]).length > 0;
}

export function filterSongs(rows: LibrarySong[], filter: LibraryFilter, options: { except?: FacetName } = {}): LibrarySong[] {
  const active = (Object.keys(FACET_TESTS) as FacetName[]).filter(
    (name) => name !== options.except && isActive(name, filter),
  );
  if (active.length === 0) return rows;
  return rows.filter((row) => active.every((name) => FACET_TESTS[name](row, filter)));
}

/** Is anything at all narrowing the list? Drives the "Clear all" affordance. */
export function isFiltered(filter: LibraryFilter): boolean {
  return (Object.keys(FACET_TESTS) as FacetName[]).some((name) => isActive(name, filter));
}

export function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

/* ─── facet counts ────────────────────────────────────────────────────────── */

export interface FacetOption {
  value: string;
  label: string;
  count: number;
  selected: boolean;
}

/**
 * Counts are computed with THIS facet's own selection lifted, which is what
 * makes a facet list usable: picking "Fast" must not collapse every other
 * tempo to zero, or you can never widen the selection again.
 */
function countFacet(
  rows: LibrarySong[],
  filter: LibraryFilter,
  name: Exclude<FacetName, "query" | "drafts">,
  valuesOf: (row: LibrarySong) => string[],
): Map<string, number> {
  const scoped = filterSongs(rows, filter, { except: name });
  const counts = new Map<string, number>();
  for (const row of scoped) {
    for (const value of valuesOf(row)) counts.set(value, (counts.get(value) || 0) + 1);
  }
  return counts;
}

function options(
  counts: Map<string, number>,
  selected: string[],
  label: (value: string) => string,
  sort: (a: FacetOption, b: FacetOption) => number,
): FacetOption[] {
  const values = new Set([...counts.keys(), ...selected]);
  return [...values]
    .map((value) => ({ value, label: label(value), count: counts.get(value) || 0, selected: selected.includes(value) }))
    .sort(sort);
}

const byCount = (a: FacetOption, b: FacetOption) => b.count - a.count || a.label.localeCompare(b.label);
/** Keys are a scale a musician scans, not a ranking — and "no key" belongs at the end. */
const byKey = (a: FacetOption, b: FacetOption) =>
  Number(a.value === NO_VALUE) - Number(b.value === NO_VALUE) || a.label.localeCompare(b.label);
/** Keep a fixed scale in its own order — a band list that reshuffles is unreadable. */
const byOrder = (order: string[]) => (a: FacetOption, b: FacetOption) => order.indexOf(a.value) - order.indexOf(b.value);

export interface LibraryFacets {
  flags: FacetOption[];
  themes: FacetOption[];
  keys: FacetOption[];
  tempos: FacetOption[];
  artists: FacetOption[];
  missing: FacetOption[];
  bands: FacetOption[];
  content: FacetOption[];
}

export function libraryFacets(rows: LibrarySong[], filter: LibraryFilter): LibraryFacets {
  const tempoOrder = [...TEMPO_BANDS.map((b) => b.id as string), NO_VALUE];
  const tempoLabels = new Map(TEMPO_BANDS.map((b) => [b.id as string, b.label]));
  const bandLabels = new Map(COMPLETENESS_BANDS.map((b) => [b.id as string, b.label]));
  const fieldLabels = new Map(COMPLETENESS_FIELDS.map((f) => [f.id as string, f.label]));
  const contentLabels = new Map(CONTENT_KINDS.map((k) => [k.id as string, k.label]));

  return {
    flags: options(
      countFacet(rows, filter, "flags", (r) => r.flags),
      filter.flags,
      (value) => flagLabel(value),
      byCount,
    ),
    themes: options(
      countFacet(rows, filter, "themes", (r) => r.themes),
      filter.themes,
      (value) => themeLabel(value),
      byCount,
    ),
    keys: options(
      countFacet(rows, filter, "keys", (r) => [r.key]),
      filter.keys,
      (value) => (value === NO_VALUE ? "No key" : value),
      byKey,
    ),
    tempos: options(
      countFacet(rows, filter, "tempos", (r) => [r.tempo]),
      filter.tempos,
      (value) => (value === NO_VALUE ? "No tempo" : tempoLabels.get(value) || value),
      byOrder(tempoOrder),
    ),
    artists: options(
      countFacet(rows, filter, "artists", (r) => [r.artist]),
      filter.artists,
      (value) => (value === NO_VALUE ? "No artist" : value),
      byCount,
    ),
    missing: options(
      countFacet(rows, filter, "missing", (r) => r.missing),
      filter.missing,
      (value) => fieldLabels.get(value) || value,
      byCount,
    ),
    bands: options(
      countFacet(rows, filter, "bands", (r) => [r.band]),
      filter.bands,
      (value) => bandLabels.get(value) || value,
      byOrder(COMPLETENESS_BANDS.map((b) => b.id as string)),
    ),
    content: options(
      countFacet(rows, filter, "content", (r) => [r.content]),
      filter.content,
      (value) => contentLabels.get(value) || value,
      byOrder(CONTENT_KINDS.map((k) => k.id as string)),
    ),
  };
}

/**
 * What a song still needs, in words — "artist", "tempo", "year".
 *
 * The percentage says how far along a song is; this says what to do about it,
 * which is the only reason anyone looks at the percentage.
 */
const FIELD_LABELS = new Map(COMPLETENESS_FIELDS.map((f) => [f.id as string, f.label.toLowerCase()]));

export function needsLabels(row: LibrarySong): string[] {
  return row.missing.map((id) => FIELD_LABELS.get(id as string) ?? String(id));
}

/* ─── the roll-up ─────────────────────────────────────────────────────────── */

export interface LibraryStats {
  songs: number;
  drafts: number;
  medianPercent: number;
  /** Songs carrying at least one of each field, in COMPLETENESS_FIELDS order. */
  coverage: { id: string; label: string; have: number; missing: number }[];
  themed: number;
  labels: number;
  ready: number;
}

export function libraryStats(rows: LibrarySong[]): LibraryStats {
  const percents = rows.map((r) => r.percent).sort((a, b) => a - b);
  const mid = Math.floor(percents.length / 2);
  const median = percents.length === 0 ? 0 : percents.length % 2 ? percents[mid] : Math.round((percents[mid - 1] + percents[mid]) / 2);

  return {
    songs: rows.length,
    drafts: rows.filter((r) => r.song.isDraft).length,
    medianPercent: median,
    coverage: COMPLETENESS_FIELDS.map((field) => {
      const have = rows.filter((r) => !r.missing.includes(field.id)).length;
      return { id: field.id as string, label: field.label, have, missing: rows.length - have };
    }),
    themed: rows.filter((r) => r.themes.length > 0).length,
    labels: rows.reduce((sum, r) => sum + r.themes.length, 0),
    // Title AND artist — the two fields you actually search a song by.
    ready: rows.filter((r) => !r.missing.includes("title") && !r.missing.includes("artist")).length,
  };
}

/* ─── sorting ─────────────────────────────────────────────────────────────── */

export type SortId = "needsWork" | "title" | "complete" | "recent";

export const SORTS: { id: SortId; label: string }[] = [
  { id: "needsWork", label: "Needs work first" },
  { id: "complete", label: "Most complete first" },
  { id: "title", label: "A to Z" },
  { id: "recent", label: "Recently updated" },
];

export function sortRows(rows: LibrarySong[], sort: SortId): LibrarySong[] {
  const byTitle = (a: LibrarySong, b: LibrarySong) =>
    normalize(a.song.title).localeCompare(normalize(b.song.title), undefined, { numeric: true });
  const copy = [...rows];
  switch (sort) {
    case "title":
      return copy.sort(byTitle);
    case "complete":
      return copy.sort((a, b) => b.percent - a.percent || byTitle(a, b));
    case "recent":
      return copy.sort((a, b) => String(b.song.updatedAt || "").localeCompare(String(a.song.updatedAt || "")) || byTitle(a, b));
    case "needsWork":
    default:
      return copy.sort((a, b) => a.percent - b.percent || byTitle(a, b));
  }
}
