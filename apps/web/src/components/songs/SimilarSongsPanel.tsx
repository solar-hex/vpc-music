import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { songsApi, type SimilarSong } from "@/lib/api-client";
import { getKeyDistance, keyTransitionLabel } from "@/utils/key-compat";
import { Shuffle, ChevronDown } from "lucide-react";

/**
 * "Switch to…" suggestions for a song (story 2): other songs with a close tempo
 * and/or shared tags, ranked. Key compatibility from the current song is shown so
 * a leader can judge the transition at a glance.
 */
export function SimilarSongsPanel({ songId, songKey }: { songId: string; songKey?: string | null }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [songs, setSongs] = useState<SimilarSong[]>([]);
  const [tolerance, setTolerance] = useState(12);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    songsApi
      .similar(songId, { tempoTolerance: tolerance, limit: 12 })
      .then((res) => {
        if (!cancelled) setSongs(res.songs);
      })
      .catch(() => {
        if (!cancelled) setSongs([]);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, songId, tolerance]);

  return (
    <div className="space-y-2 print-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="section-title w-full text-left"
        aria-expanded={open}
      >
        <Shuffle className="section-title-icon" /> Switch to…
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            <span>Tempo within</span>
            <select
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value))}
              className="select btn-sm w-auto"
              aria-label="Tempo tolerance"
            >
              {[6, 12, 20, 30].map((t) => (
                <option key={t} value={t}>
                  ±{t} BPM
                </option>
              ))}
            </select>
            <span>or a shared tag</span>
          </div>

          {loading && !loaded ? (
            <div className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">Finding songs…</div>
          ) : songs.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              No close matches yet. Widen the tempo range, or add tags to your songs.
            </p>
          ) : (
            <div className="list-container">
              {songs.map((s) => {
                const dist = songKey && s.key ? getKeyDistance(songKey, s.key) : null;
                const keyInfo = keyTransitionLabel(dist);
                const levelClass =
                  keyInfo.level === "good"
                    ? "badge-success"
                    : keyInfo.level === "warn"
                      ? "badge-warning"
                      : "badge-muted";
                return (
                  <Link
                    key={s.id}
                    to={`/songs/${s.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[hsl(var(--muted))] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[hsl(var(--foreground))]">{s.title}</div>
                      <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                        {[
                          s.key && `Key ${s.key}`,
                          s.tempo != null && `${s.tempo} BPM`,
                          s.tempoDiff != null && s.tempoDiff > 0 && `(+${s.tempoDiff})`,
                          s.sharedTags.length > 0 && `#${s.sharedTags.join(" #")}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    {s.key && songKey && (
                      <span className={`${levelClass} shrink-0`} title="Key transition from the current song">
                        {keyInfo.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
