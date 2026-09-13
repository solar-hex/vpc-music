import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, Music, Search, SlidersHorizontal, X } from "lucide-react";
import { useSongLibrary } from "@/hooks/useSongLibrary";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  decorate,
  filterSongs,
  isFiltered,
  libraryFacets,
  libraryStats,
  needsLabels,
  sortRows,
  toggleValue,
  EMPTY_FILTER,
  SORTS,
  type DraftMode,
  type FacetOption,
  type LibraryFilter,
  type LibrarySong,
  type SortId,
} from "@/lib/library";
import { flagLabel, songStatusLabel, tempoBandLabel } from "@vpc-music/shared";

/** Filters live in the URL so a view of the library is a link you can send. */
const PARAMS: Record<string, keyof LibraryFilter> = {
  theme: "themes",
  key: "keys",
  tempo: "tempos",
  artist: "artists",
  flag: "flags",
  missing: "missing",
  band: "bands",
  content: "content",
};

function readFilter(params: URLSearchParams): LibraryFilter {
  const list = (name: string) => (params.get(name) || "").split(",").map((s) => s.trim()).filter(Boolean);
  const drafts = params.get("drafts");
  const filter: LibraryFilter = {
    ...EMPTY_FILTER,
    query: params.get("q") || "",
    drafts: drafts === "hide" || drafts === "only" ? (drafts as DraftMode) : "show",
  };
  // Driven by the same PARAMS map that writes the URL. Listing the facets
  // here by hand is how a new one gets written to the URL and then silently
  // dropped on the way back in.
  for (const [name, field] of Object.entries(PARAMS)) {
    (filter[field] as string[]) = list(name);
  }
  return filter;
}

function writeFilter(filter: LibraryFilter, sort: SortId): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.query.trim()) params.set("q", filter.query.trim());
  for (const [name, field] of Object.entries(PARAMS)) {
    const values = filter[field] as string[];
    if (values.length > 0) params.set(name, values.join(","));
  }
  if (filter.drafts !== "show") params.set("drafts", filter.drafts);
  if (sort !== "needsWork") params.set("sort", sort);
  return params;
}

/** A count plus what it counts — the top of the page, readable at a glance. */
function StatTile({ value, label, hint }: { value: string | number; label: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2">
      <div className="text-xl font-semibold tabular-nums text-[hsl(var(--foreground))]">{value}</div>
      <div className="text-xs text-[hsl(var(--muted-foreground))]">{label}</div>
      {hint && <div className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{hint}</div>}
    </div>
  );
}

/**
 * One field's coverage. The bar is the statistic; the button is the point —
 * tapping it shows the songs that are missing that field, which is the only
 * reason to know the number.
 */
function CoverageRow({
  label,
  have,
  total,
  selected,
  onSelect,
}: {
  label: string;
  have: number;
  total: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const percent = total === 0 ? 0 : Math.round((have / total) * 100);
  const missing = total - have;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      disabled={missing === 0}
      className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors disabled:cursor-default ${
        selected ? "bg-[hsl(var(--muted))]" : "hover:bg-[hsl(var(--muted))]"
      }`}
      title={missing === 0 ? `Every song has a ${label.toLowerCase()}` : `Show the ${missing} songs with no ${label.toLowerCase()}`}
    >
      <span className="w-16 shrink-0 text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
        <span className="block h-full rounded-full bg-[hsl(var(--secondary))]" style={{ width: `${percent}%` }} />
      </span>
      <span className="w-24 shrink-0 text-right text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
        {missing === 0 ? (
          <span className="opacity-60">all {total}</span>
        ) : (
          <>
            {missing}
            <span className="opacity-60"> to go</span>
          </>
        )}
      </span>
    </button>
  );
}

function Chip({ option, onToggle }: { option: FacetOption; onToggle: (value: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(option.value)}
      aria-pressed={option.selected}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
        option.selected
          ? "border-[hsl(var(--secondary))] bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"
          : "border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
      }`}
    >
      <span>{option.label}</span>
      <span className="tabular-nums opacity-70">{option.count}</span>
    </button>
  );
}

const COLLAPSED = 10;

function FacetGroup({
  title,
  options,
  onToggle,
}: {
  title: string;
  options: FacetOption[];
  onToggle: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (options.length === 0) return null;
  const shown = expanded ? options : options.slice(0, COLLAPSED);
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((option) => (
          <Chip key={option.value} option={option} onToggle={onToggle} />
        ))}
        {options.length > COLLAPSED && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded-full px-2.5 py-1 text-xs text-[hsl(var(--muted-foreground))] underline hover:text-[hsl(var(--foreground))]"
          >
            {expanded ? "Show fewer" : `${options.length - COLLAPSED} more`}
          </button>
        )}
      </div>
    </div>
  );
}

function SongRow({ row }: { row: LibrarySong }) {
  const { song } = row;
  const needs = needsLabels(row);
  const tone = row.percent >= 70 ? "bg-green-500" : row.percent >= 45 ? "bg-amber-500" : "bg-red-500";
  return (
    <li>
      <Link to={`/songs/${song.id}`} className="list-item flex min-h-[56px] items-center gap-3 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-[hsl(var(--foreground))]">{song.title}</span>
            {song.isDraft && <span className="badge-muted shrink-0">Draft</span>}
            {songStatusLabel(song.status) && <span className="badge-muted shrink-0">{songStatusLabel(song.status)}</span>}
            {/* The old site's tilde. Kept out of the default list — not access control. */}
            {row.flags.map((flag) => (
              <span key={flag} className="badge-warning shrink-0">
                {flagLabel(flag)}
              </span>
            ))}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[hsl(var(--muted-foreground))]">
            {song.artist && <span>{song.artist}</span>}
            {song.tempo ? <span>{tempoBandLabel(song.tempo)}</span> : null}
            {row.themes.length > 0 && <span className="truncate">{row.themes.slice(0, 3).join(", ")}</span>}
          </div>
          {/* What to do about the percentage, which is the only reason to know it. */}
          {needs.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <span className="text-[11px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">needs</span>
              {needs.map((label) => (
                <span
                  key={label}
                  className="rounded px-1.5 py-0.5 text-[11px] text-amber-800 dark:text-amber-300"
                  style={{ backgroundColor: "hsl(var(--muted))" }}
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {song.key && <span className="badge-key">{song.key}</span>}
          <span className="flex w-12 flex-col items-end gap-1">
            <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">{row.percent}%</span>
            <span className="h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]">
              <span className={`block h-full rounded-full ${tone}`} style={{ width: `${row.percent}%` }} />
            </span>
          </span>
        </div>
      </Link>
    </li>
  );
}

const PAGE = 100;

/**
 * The library as numbers, and every number as a way into the songs behind it.
 *
 * Same derivation the corpus build reports (`shared/utils/library.js`), run
 * over the copy of the library already on the device — so it needs no endpoint
 * and works offline, and the percentages here are the percentages there.
 */
export function LibraryPage() {
  const { songs, loading, error, offline, refresh } = useSongLibrary();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = useMemo(() => readFilter(searchParams), [searchParams]);
  const sort = (searchParams.get("sort") as SortId) || "needsWork";
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const inputRef = useRef<HTMLInputElement>(null);

  const apply = useCallback(
    (next: LibraryFilter, nextSort: SortId = sort) => {
      setSearchParams(writeFilter(next, nextSort), { replace: true });
    },
    [setSearchParams, sort],
  );

  const rows = useMemo(() => decorate(songs), [songs]);
  const stats = useMemo(() => libraryStats(rows), [rows]);
  const matched = useMemo(() => filterSongs(rows, filter), [rows, filter]);
  const facets = useMemo(() => libraryFacets(rows, filter), [rows, filter]);
  const visible = useMemo(() => sortRows(matched, sort).slice(0, limit), [matched, sort, limit]);

  // A narrower filter should show its top matches, not keep yesterday's scroll.
  useEffect(() => setLimit(PAGE), [searchParams]);

  const toggle = (field: keyof LibraryFilter) => (value: string) =>
    apply({ ...filter, [field]: toggleValue(filter[field] as string[], value) });

  const filtered = isFiltered(filter);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="page-title">Every song</h1>
          <Link to="/songs" className="text-sm text-[hsl(var(--muted-foreground))] underline hover:text-[hsl(var(--foreground))]">
            Ready list
          </Link>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Drafts included, and what each one still needs. The song list shows the ready ones.
        </p>
      </header>

      {loading && songs.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="spinner" />
        </div>
      ) : error ? (
        <EmptyState
          icon={Music}
          message={error}
          action={
            <button type="button" onClick={() => void refresh()} className="btn-outline">
              Try again
            </button>
          }
        />
      ) : songs.length === 0 ? (
        <EmptyState icon={Music} message="No songs yet, so there is nothing to measure." />
      ) : (
        <>
          <section aria-label="Library at a glance" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile value={stats.songs} label="songs" hint={offline ? "offline copy" : undefined} />
            <StatTile value={`${stats.medianPercent}%`} label="median complete" />
            <StatTile value={stats.ready} label="title + artist" hint="findable by name" />
            <StatTile value={stats.themed} label="themed" hint={`${stats.labels} labels`} />
          </section>

          <section aria-label="Field coverage" className="card card-body space-y-0.5">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">What songs still need</h2>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">tap a row to list them</span>
            </div>
            {stats.coverage.map((field) => (
              <CoverageRow
                key={field.id}
                label={field.label}
                have={field.have}
                total={stats.songs}
                selected={filter.missing.includes(field.id)}
                onSelect={() => apply({ ...filter, missing: toggleValue(filter.missing, field.id) })}
              />
            ))}
          </section>

          <section aria-label="Find songs" className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                <input
                  ref={inputRef}
                  type="search"
                  value={filter.query}
                  onChange={(event) => apply({ ...filter, query: event.target.value })}
                  placeholder="Search title, artist or tag"
                  aria-label="Search the library"
                  autoComplete="off"
                  className="input h-12 w-full pl-10 pr-10 text-base"
                />
                {filter.query && (
                  <button
                    type="button"
                    onClick={() => {
                      apply({ ...filter, query: "" });
                      inputRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowFilters((value) => !value)}
                aria-expanded={showFilters}
                className="btn-outline h-12 shrink-0 gap-1.5"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
              </button>
            </div>

            {showFilters && (
              <div className="card card-body space-y-4">
                <FacetGroup title="Missing" options={facets.missing} onToggle={toggle("missing")} />
                <FacetGroup title="Chords" options={facets.content} onToggle={toggle("content")} />
                <FacetGroup title="Flags" options={facets.flags} onToggle={toggle("flags")} />
                <FacetGroup title="Completeness" options={facets.bands} onToggle={toggle("bands")} />
                <FacetGroup title="Tempo" options={facets.tempos} onToggle={toggle("tempos")} />
                <FacetGroup title="Key" options={facets.keys} onToggle={toggle("keys")} />
                <FacetGroup title="Theme" options={facets.themes} onToggle={toggle("themes")} />
                <FacetGroup title="Artist" options={facets.artists} onToggle={toggle("artists")} />
                <div className="flex flex-wrap items-center gap-2 border-t border-[hsl(var(--border))] pt-3">
                  <label className="text-xs text-[hsl(var(--muted-foreground))]" htmlFor="library-drafts">
                    Drafts
                  </label>
                  <select
                    id="library-drafts"
                    value={filter.drafts}
                    onChange={(event) => apply({ ...filter, drafts: event.target.value as DraftMode })}
                    className="select h-9 text-xs"
                  >
                    <option value="show">Include</option>
                    <option value="hide">Exclude</option>
                    <option value="only">Only drafts</option>
                  </select>
                  <label className="ml-2 text-xs text-[hsl(var(--muted-foreground))]" htmlFor="library-sort">
                    Sort
                  </label>
                  <select
                    id="library-sort"
                    value={sort}
                    onChange={(event) => apply(filter, event.target.value as SortId)}
                    className="select h-9 text-xs"
                  >
                    {SORTS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 text-xs text-[hsl(var(--muted-foreground))]">
              <span>
                {matched.length} of {stats.songs} {stats.songs === 1 ? "song" : "songs"}
                {filter.drafts === "hide" ? " · drafts hidden" : filter.drafts === "only" ? " · drafts only" : ""}
              </span>
              {filtered && (
                <button
                  type="button"
                  onClick={() => apply(EMPTY_FILTER)}
                  className="rounded-md px-2 py-1 hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                >
                  Clear all
                </button>
              )}
            </div>
          </section>

          {matched.length === 0 ? (
            <EmptyState icon={Search} message="Nothing matches those filters." />
          ) : (
            <>
              <ul className="space-y-1">
                {visible.map((row) => (
                  <SongRow key={row.song.id} row={row} />
                ))}
              </ul>
              {matched.length > visible.length && (
                <div className="flex justify-center">
                  <button type="button" onClick={() => setLimit((value) => value + PAGE)} className="btn-outline">
                    Show {Math.min(PAGE, matched.length - visible.length)} more
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
