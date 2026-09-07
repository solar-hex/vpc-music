import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Music, Plus, Search, Upload, X } from "lucide-react";
import { songsApi, type Song } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useSongLibrary } from "@/hooks/useSongLibrary";
import { groupByLetter, matchesQuery, sortForList } from "@/lib/song-search";
import { EmptyState } from "@/components/shared/EmptyState";
import { ImportSongsDialog } from "@/components/songs/ImportSongsDialog";
import { ALL_KEYS, normalizeEnharmonicKey, parseKeyRoot } from "@vpc-music/shared";

const LYRIC_SEARCH_MIN_LENGTH = 3;
const LYRIC_SEARCH_DEBOUNCE_MS = 300;

function carriedKeyFrom(value: string | null): string | null {
  const parsed = parseKeyRoot(value);
  if (!parsed) return null;
  const root = normalizeEnharmonicKey(parsed.root);
  return ALL_KEYS.includes(root) ? (parsed.isMinor ? `${root}m` : root) : null;
}

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  const tag = element?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(element?.isContentEditable);
}

/**
 * The old site's search page: one box that filters the whole library as you
 * type, an A to Z list underneath, drafts hidden until asked for, and a key
 * carried from the chart page into every link.
 */
export function SongListPage() {
  const { user, activeOrg } = useAuth();
  const canEdit = user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician";
  const [searchParams] = useSearchParams();
  const carriedKey = carriedKeyFrom(searchParams.get("key"));
  const { songs, loading, error, offline, refresh } = useSongLibrary();
  const [query, setQuery] = useState("");
  const [showDrafts, setShowDrafts] = useState(false);
  const [lyricMatches, setLyricMatches] = useState<Song[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" focuses the search box from anywhere on the page.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "/" && !isTypingTarget(event.target)) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // The list endpoint also searches lyrics; ask it once typing settles.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < LYRIC_SEARCH_MIN_LENGTH) {
      setLyricMatches([]);
      return;
    }
    const handle = setTimeout(() => {
      songsApi
        .list({ q: trimmed, limit: 25, sort: "title" })
        .then((res) => setLyricMatches(res.songs))
        .catch(() => setLyricMatches([]));
    }, LYRIC_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  const draftCount = useMemo(() => songs.filter((song) => song.isDraft).length, [songs]);
  const visible = useMemo(
    () => sortForList(songs.filter((song) => (showDrafts || !song.isDraft) && matchesQuery(song, query))),
    [songs, query, showDrafts],
  );
  const groups = useMemo(() => groupByLetter(visible), [visible]);
  const alsoInLyrics = useMemo(() => {
    const visibleIds = new Set(visible.map((song) => song.id));
    return sortForList(lyricMatches.filter((song) => !visibleIds.has(song.id) && (showDrafts || !song.isDraft)));
  }, [lyricMatches, visible, showDrafts]);

  const songHref = (songId: string) => (carriedKey ? `/songs/${songId}?key=${encodeURIComponent(carriedKey)}` : `/songs/${songId}`);

  const renderRow = (song: Song) => (
    <li key={song.id}>
      <Link to={songHref(song.id)} className="list-item flex min-h-[52px] items-center gap-3 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-[hsl(var(--foreground))]">{song.title}</span>
            {song.isDraft && <span className="badge-muted shrink-0">Draft</span>}
          </div>
          {song.artist && <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">{song.artist}</div>}
        </div>
        {song.key && <span className="badge-key shrink-0">{song.key}</span>}
      </Link>
    </li>
  );

  const noMatches = visible.length === 0 && alsoInLyrics.length === 0;

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-10 -mx-3 bg-[hsl(var(--background))] px-3 pb-2 pt-1 sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search songs"
              aria-label="Search songs"
              autoFocus
              autoComplete="off"
              className="input h-12 w-full pl-10 pr-10 text-base"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {canEdit && (
            <>
              <button type="button" onClick={() => setImportOpen(true)} className="btn-icon btn-outline h-12 w-12 shrink-0" title="Import files" aria-label="Import files">
                <Upload className="h-5 w-5" />
              </button>
              <Link to="/songs/new" className="btn-primary h-12 shrink-0 gap-1.5">
                <Plus className="h-4 w-4" /> New song
              </Link>
            </>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[hsl(var(--muted-foreground))]">
          <span>
            {songs.length} {songs.length === 1 ? "song" : "songs"}
            {offline ? " · offline copy" : ""}
          </span>
          {draftCount > 0 && (
            <button
              type="button"
              onClick={() => setShowDrafts((value) => !value)}
              aria-pressed={showDrafts}
              className="rounded-md px-2 py-1 hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
            >
              {showDrafts ? "Hide drafts" : `Show drafts (${draftCount})`}
            </button>
          )}
        </div>
        {carriedKey && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="badge-key">Opening songs in {carriedKey}</span>
            <Link to="/songs" className="text-[hsl(var(--muted-foreground))] underline hover:text-[hsl(var(--foreground))]">
              Clear
            </Link>
          </div>
        )}
      </div>

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
        <EmptyState
          icon={Music}
          message="No songs yet."
          action={
            canEdit ? (
              <div className="flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => setImportOpen(true)} className="btn-outline">
                  Import files
                </button>
                <Link to="/songs/new" className="btn-primary">
                  Add the first song
                </Link>
              </div>
            ) : undefined
          }
        />
      ) : noMatches ? (
        <EmptyState icon={Search} message={`No songs match "${query.trim()}".`} />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.letter} aria-label={`Songs starting with ${group.letter}`}>
              <h2 className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{group.letter}</h2>
              <ul className="space-y-1">{group.songs.map(renderRow)}</ul>
            </section>
          ))}
          {alsoInLyrics.length > 0 && (
            <section aria-label="Also found in lyrics">
              <h2 className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Also found in lyrics</h2>
              <ul className="space-y-1">{alsoInLyrics.map(renderRow)}</ul>
            </section>
          )}
        </div>
      )}

      <ImportSongsDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
