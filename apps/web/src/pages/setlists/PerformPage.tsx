import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { setlistsApi, songsApi, type Setlist, type SetlistSongItem } from "@/lib/api-client";
import {
  loadCachedSetlist,
  loadCachedSetlistPerformanceContents,
  saveCachedSetlist,
  saveCachedSetlistPerformanceContents,
} from "@/lib/offline-cache";
import { PerformanceMode } from "@/components/setlists/PerformanceMode";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";
import { toast } from "sonner";

type ContentsMap = Map<
  string,
  { songId: string; content: string; key?: string | null; originalKey?: string | null; tempo?: number | null; durationSeconds?: number | null }
>;

/**
 * Rehearsal mode — /setlists/:id/perform. Full-bleed, no shell, no chrome.
 * Cache-first so the whole set works with no signal at the venue; the
 * network refresh is a best-effort background upgrade.
 */
export function PerformPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [songs, setSongs] = useState<SetlistSongItem[]>([]);
  const [contents, setContents] = useState<ContentsMap>(new Map());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // End-of-set logging: offer a one-tap "mark as played" when the user
  // reached the final song and then exits (stats without ceremony).
  const reachedEndRef = useRef(false);
  const [showEndPrompt, setShowEndPrompt] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    // 1. Cache first — a stale chart beats a blank screen at the venue
    const cachedSetlist = loadCachedSetlist(id);
    const cachedContents = loadCachedSetlistPerformanceContents(id);
    if (cachedSetlist && cachedContents.size > 0) {
      setSetlist(cachedSetlist.response.setlist);
      setSongs(cachedSetlist.response.songs);
      setContents(cachedContents);
      setReady(true);
    }

    // 2. Network refresh
    const refresh = async () => {
      try {
        const res = await setlistsApi.get(id);
        if (cancelled) return;
        setSetlist(res.setlist);
        setSongs(res.songs);
        saveCachedSetlist(res);

        const map: ContentsMap = new Map();
        await Promise.all(
          res.songs.map(async (item) => {
            if (!item.songId) return;
            try {
              const songRes = await songsApi.get(item.songId);
              const variation = item.variationId
                ? songRes.variations?.find((v) => v.id === item.variationId)
                : null;
              map.set(item.songId, {
                songId: item.songId,
                content: variation?.content || songRes.song.content,
                key: item.key || variation?.key || songRes.song.key,
                originalKey: variation?.key || songRes.song.key,
                tempo: songRes.song.tempo,
                durationSeconds: songRes.song.durationSeconds,
              });
            } catch {
              // Keep whatever the cache had for this song
            }
          }),
        );
        if (cancelled) return;
        if (map.size > 0) {
          setContents((prev) => {
            const merged = new Map(prev);
            for (const [songId, value] of map) merged.set(songId, value);
            saveCachedSetlistPerformanceContents(id, merged);
            return merged;
          });
        }
        setReady(true);
      } catch {
        if (!cancelled && !cachedSetlist) setFailed(true);
      }
    };
    void refresh();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (failed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          This set list isn't cached yet and the network is unreachable.
        </p>
        <Link to={`/setlists/${id}`} className="btn-primary">
          Back to the set list
        </Link>
      </div>
    );
  }

  if (!ready || !setlist) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
        <div className="spinner" />
      </div>
    );
  }

  const filledSongCount = songs.filter((s) => s.songId).length;

  const exitToSetlist = () => navigate(`/setlists/${id}`);

  const handleExit = () => {
    // Only offer to log when the set was actually played through and the
    // setlist isn't already complete. A one-song set counts as played through.
    const playedThrough = reachedEndRef.current || songs.length === 1;
    if (playedThrough && setlist.status !== "complete" && filledSongCount > 0) {
      setShowEndPrompt(true);
    } else {
      exitToSetlist();
    }
  };

  const handleMarkPlayed = async () => {
    if (!id) return;
    setCompleting(true);
    try {
      const res = await setlistsApi.markComplete(id, undefined, "perform");
      toast.success(`Set marked as played — ${res.usagesLogged} play${res.usagesLogged === 1 ? "" : "s"} logged`);
    } catch (err: any) {
      toast.error(err?.message || "Couldn't mark the set as played — you can complete it from the set list page.");
    } finally {
      setCompleting(false);
      exitToSetlist();
    }
  };

  return (
    <>
      <PerformanceMode
        songs={songs}
        songContents={contents}
        setlistName={setlist.name}
        onExit={handleExit}
        onSongChange={(idx) => {
          if (idx === songs.length - 1) reachedEndRef.current = true;
        }}
      />
      <ResponsiveModal
        open={showEndPrompt}
        onClose={exitToSetlist}
        title="Mark this set as played?"
        description={`Logs ${filledSongCount} play${filledSongCount === 1 ? "" : "s"} to your song statistics and marks "${setlist.name}" complete.`}
        showCloseButton={false}
      >
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={exitToSetlist} className="btn-outline" disabled={completing}>
            Not now
          </button>
          <button type="button" onClick={handleMarkPlayed} className="btn-primary" disabled={completing}>
            {completing ? "Logging…" : "Mark as played"}
          </button>
        </div>
      </ResponsiveModal>
    </>
  );
}
