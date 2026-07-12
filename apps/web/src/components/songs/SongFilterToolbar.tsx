import { useEffect, useRef, useState } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { ALL_KEYS } from "@vpc-music/shared";
import type { SongGroup, SongStatus } from "@/lib/api-client";
import { SONG_STATUS_CONFIGS } from "@/components/songs/SongStatusBadge";
import { cn } from "@/lib/utils";

export type SongSortMode = "lastEdited" | "title" | "recentlyAdded" | "mostUsed";

export interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

/** Encode the three status-ish filters into one <select> value. */
function statusSelectValue(statusFilter: SongStatus | "", favoritesOnly: boolean, showArchived: boolean): string {
  if (favoritesOnly) return "meta:favorites";
  if (showArchived) return "meta:archived";
  if (statusFilter) return `status:${statusFilter}`;
  return "";
}

interface SongFilterToolbarProps {
  q: string;
  onQChange: (value: string) => void;
  libraryScope: "organization" | "shared";
  onLibraryScopeChange: (value: "organization" | "shared") => void;
  statusFilter: SongStatus | "";
  favoritesOnly: boolean;
  showArchived: boolean;
  onStatusChange: (next: { statusFilter: SongStatus | ""; favoritesOnly: boolean; showArchived: boolean }) => void;
  sort: SongSortMode;
  onSortChange: (value: SongSortMode) => void;
  isSharedScope: boolean;
  groupFilter: string;
  onGroupFilterChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  keyFilter: string;
  onKeyFilterChange: (value: string) => void;
  tagFilter: string;
  onTagFilterChange: (value: string) => void;
  tempoMin: string;
  onTempoMinChange: (value: string) => void;
  tempoMax: string;
  onTempoMaxChange: (value: string) => void;
  onResetAdvanced: () => void;
  availableGroups: SongGroup[];
  availableCategories: string[];
  availableTags: string[];
  chips: FilterChip[];
  onClearAll: () => void;
}

/**
 * The Songs filter toolbar — 5 primary controls (Search, Organization, Status,
 * Sort, Advanced Filters) per the 80/20 principle: expose what's used daily,
 * tuck the rest behind one discoverable button. Advanced filters apply live
 * (same timing as before this redesign) — "Apply Filters" just closes the
 * panel; "Reset Filters" clears the five advanced fields.
 */
export function SongFilterToolbar({
  q,
  onQChange,
  libraryScope,
  onLibraryScopeChange,
  statusFilter,
  favoritesOnly,
  showArchived,
  onStatusChange,
  sort,
  onSortChange,
  isSharedScope,
  groupFilter,
  onGroupFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  keyFilter,
  onKeyFilterChange,
  tagFilter,
  onTagFilterChange,
  tempoMin,
  onTempoMinChange,
  tempoMax,
  onTempoMaxChange,
  onResetAdvanced,
  availableGroups,
  availableCategories,
  availableTags,
  chips,
  onClearAll,
}: SongFilterToolbarProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const advancedRef = useRef<HTMLDivElement>(null);

  const advancedCount = [groupFilter, categoryFilter, keyFilter, tagFilter, tempoMin || tempoMax].filter(Boolean).length;

  useEffect(() => {
    if (!advancedOpen) return;
    const handler = (e: MouseEvent) => {
      if (advancedRef.current && !advancedRef.current.contains(e.target as Node)) {
        setAdvancedOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAdvancedOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [advancedOpen]);

  const handleStatusSelect = (value: string) => {
    if (value === "meta:favorites") {
      onStatusChange({ statusFilter: "", favoritesOnly: true, showArchived: false });
    } else if (value === "meta:archived") {
      onStatusChange({ statusFilter: "", favoritesOnly: false, showArchived: true });
    } else if (value.startsWith("status:")) {
      onStatusChange({ statusFilter: value.slice("status:".length) as SongStatus, favoritesOnly: false, showArchived: false });
    } else {
      onStatusChange({ statusFilter: "", favoritesOnly: false, showArchived: false });
    }
  };

  return (
    <div className="space-y-3">
      {/* Primary toolbar — 5 controls, one row on desktop */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-50 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            placeholder="Search songs..."
            className="input pl-10 pr-9"
          />
          {q && (
            <button
              onClick={() => onQChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          aria-label="Song scope"
          value={libraryScope}
          onChange={(e) => onLibraryScopeChange(e.target.value as "organization" | "shared")}
          className="select w-auto"
        >
          <option value="organization">Current organization</option>
          <option value="shared">Shared with me</option>
        </select>

        <select
          aria-label="Filter by status"
          value={statusSelectValue(statusFilter, favoritesOnly, showArchived)}
          onChange={(e) => handleStatusSelect(e.target.value)}
          className="select w-auto"
        >
          <option value="">All statuses</option>
          {(Object.keys(SONG_STATUS_CONFIGS) as SongStatus[]).map((status) => (
            <option key={status} value={`status:${status}`}>
              {SONG_STATUS_CONFIGS[status].label}
            </option>
          ))}
          <option value="meta:favorites">Favorites</option>
          <option value="meta:archived">Archived</option>
        </select>

        <select
          aria-label="Sort songs"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SongSortMode)}
          className="select w-auto"
        >
          <option value="lastEdited">Last edited</option>
          <option value="recentlyAdded">Recently created</option>
          <option value="title">Alphabetical (A–Z)</option>
          <option value="mostUsed">Most used</option>
        </select>

        <div className="relative" ref={advancedRef}>
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-expanded={advancedOpen}
            aria-haspopup="true"
            className={cn("btn-outline btn-sm", advancedCount > 0 && "border-[hsl(var(--secondary))] text-[hsl(var(--secondary))]")}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Advanced Filters
            {advancedCount > 0 && (
              <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(var(--secondary))] px-1 text-[10px] font-semibold text-[hsl(var(--secondary-foreground))]">
                {advancedCount}
              </span>
            )}
          </button>

          {advancedOpen && (
            <div
              className="fixed inset-0 z-40 flex items-end justify-center sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:z-20 sm:mt-2 sm:block sm:w-80 bg-black/40 sm:bg-transparent"
              role="dialog"
              aria-label="Advanced filters"
            >
              <div className="max-h-[85vh] w-full space-y-4 overflow-y-auto rounded-t-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-lg sm:max-h-[70vh] sm:rounded-xl">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[hsl(var(--foreground))]">Advanced Filters</h4>
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen(false)}
                    className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] sm:hidden"
                    aria-label="Close advanced filters"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Group</span>
                  <select
                    aria-label="Filter by group"
                    value={groupFilter}
                    onChange={(e) => onGroupFilterChange(e.target.value)}
                    className="select w-full"
                    disabled={isSharedScope}
                  >
                    <option value="">All groups</option>
                    {availableGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Category</span>
                  <select
                    aria-label="Filter by category"
                    value={categoryFilter}
                    onChange={(e) => onCategoryFilterChange(e.target.value)}
                    className="select w-full"
                  >
                    <option value="">All categories</option>
                    {availableCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Tags</span>
                  <select
                    aria-label="Filter by tag"
                    value={tagFilter}
                    onChange={(e) => onTagFilterChange(e.target.value)}
                    className="select w-full"
                  >
                    <option value="">All tags</option>
                    {availableTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Key</span>
                  <select
                    aria-label="Filter by key"
                    value={keyFilter}
                    onChange={(e) => onKeyFilterChange(e.target.value)}
                    className="select w-full"
                  >
                    <option value="">All keys</option>
                    {ALL_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="space-y-1">
                  <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">BPM Range</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      aria-label="Minimum BPM"
                      value={tempoMin}
                      onChange={(e) => onTempoMinChange(e.target.value)}
                      placeholder="Min BPM"
                      className="input w-full"
                    />
                    <span className="text-[hsl(var(--muted-foreground))]">–</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      aria-label="Maximum BPM"
                      value={tempoMax}
                      onChange={(e) => onTempoMaxChange(e.target.value)}
                      placeholder="Max BPM"
                      className="input w-full"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-[hsl(var(--border))] pt-3">
                  <button type="button" onClick={onResetAdvanced} className="btn-outline btn-sm">
                    Reset Filters
                  </button>
                  <button type="button" onClick={() => setAdvancedOpen(false)} className="btn-primary btn-sm">
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] px-2.5 py-0.5 text-xs font-medium text-[hsl(var(--muted-foreground))]"
              data-testid={`filter-chip-${chip.key}`}
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                aria-label={`Remove ${chip.label} filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-medium text-[hsl(var(--secondary))] hover:underline"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}
