import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { songsApi, type Song } from "@/lib/api-client";
import { Search, Maximize2, CornerDownLeft, Clock } from "lucide-react";

/**
 * Global "jump to song" launcher (story 1). Opens from anywhere with Cmd/Ctrl+K
 * (or "/" when not typing). Searches title, tags AND lyrics, so "blood of Jesus"
 * pulls up the right song even when the phrase is only in the words.
 *
 * Keyboard: ↑/↓ move, Enter opens the song, Cmd/Ctrl+Enter opens full-screen focus.
 * Empty query shows the most-used songs for instant re-pull.
 */
export function SongQuickLauncher() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [isRecent, setIsRecent] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActive(0);
  }, []);

  // Global open shortcut: Cmd/Ctrl+K everywhere, "/" when not already typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "/" && !typing && !open) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    // Tappable entry point for touch devices (dispatched by the mobile top bar).
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("vpc:open-launcher", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("vpc:open-launcher", onOpenEvent);
    };
  }, [open]);

  // Focus the input when the panel opens.
  useEffect(() => {
    if (open) {
      // defer so the element exists
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Debounced search. Empty query → most-used songs (fast re-pull).
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(
      () => {
        const req = q
          ? songsApi.list({ q, limit: 8, sort: "title" })
          : songsApi.list({ sort: "mostUsed", limit: 8 });
        req
          .then((res) => {
            if (cancelled) return;
            setResults(res.songs);
            setIsRecent(!q);
            setActive(0);
          })
          .catch(() => {
            if (!cancelled) setResults([]);
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      },
      q ? 250 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, open]);

  // Keep the active row scrolled into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const openSong = (song: Song, focus: boolean) => {
    close();
    navigate(focus ? `/songs/${song.id}/focus` : `/songs/${song.id}`);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const song = results[active];
      if (song) openSong(song, e.metaKey || e.ctrlKey);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-start justify-center bg-black/40 p-3 pt-[10vh] backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Quick song search"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-3">
          <Search className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search songs by title, tag, or lyric…"
            className="w-full bg-transparent py-3.5 text-base outline-none placeholder:text-[hsl(var(--muted-foreground))]"
            aria-label="Search songs"
          />
        </div>

        <div ref={listRef} className="max-h-[55vh] overflow-y-auto py-1">
          {loading && results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
              {query.trim() ? "No songs match." : "No songs yet."}
            </div>
          ) : (
            <>
              {isRecent && (
                <div className="flex items-center gap-1.5 px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  <Clock className="h-3 w-3" /> Most used
                </div>
              )}
              {results.map((song, idx) => (
                <div
                  key={song.id}
                  data-idx={idx}
                  onMouseEnter={() => setActive(idx)}
                  className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 ${
                    active === idx ? "bg-[hsl(var(--muted))]" : ""
                  }`}
                  onClick={(e) => openSong(song, e.metaKey || e.ctrlKey)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[hsl(var(--foreground))]">{song.title}</div>
                    <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                      {[song.artist, song.key && `Key ${song.key}`, song.tempo && `${song.tempo} BPM`, song.tags]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openSong(song, true);
                    }}
                    className="btn-icon btn-ghost hidden h-9 w-9 shrink-0 sm:inline-flex"
                    title="Open full-screen focus view"
                    aria-label="Open full-screen focus view"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[hsl(var(--border))] px-4 py-2 text-[11px] text-[hsl(var(--muted-foreground))]">
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" /> open
          </span>
          <span className="inline-flex items-center gap-1">
            <Maximize2 className="h-3 w-3" /> ⌘↵ full screen
          </span>
          <span>↑↓ navigate · esc close</span>
        </div>
      </div>
    </div>
  );
}
