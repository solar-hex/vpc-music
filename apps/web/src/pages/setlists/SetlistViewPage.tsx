import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  setlistsApi,
  songsApi,
  eventsApi,
  type Setlist,
  type SetlistSongItem,
  type Song,
} from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import {
  isOfflineRequestError,
  loadCachedSetlist,
  loadCachedSetlistPerformanceContents,
  saveCachedSetlist,
  saveCachedSetlistPerformanceContents,
} from "@/lib/offline-cache";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Music,
  X,
  CheckCircle2,
  RotateCcw,
  Radio,
  Wifi,
  WifiOff,
  Users,
  LogOut,
  Play,
  Tv,
  AlertTriangle,
  Download,
  ChevronDown,
  Settings2,
  Clock,
} from "lucide-react";
import { ALL_KEYS } from "@vpc-music/shared";
import { useConductor } from "@/hooks/useConductor";
import { PerformanceMode } from "@/components/setlists/PerformanceMode";
import { SetlistItemTools } from "@/components/setlists/SetlistItemTools";
import { FlowStrip } from "@/components/setlists/FlowStrip";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { getKeyDistance } from "@/utils/key-compat";

export function SetlistViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, activeOrg } = useAuth();
  const canEdit = user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician";
  const isAdmin = user?.role === "owner" || activeOrg?.role === "admin";
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [songs, setSongs] = useState<SetlistSongItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddSong, setShowAddSong] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingSetlist, setDeletingSetlist] = useState(false);
  const [availableSongs, setAvailableSongs] = useState<Song[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [draggedSongItemId, setDraggedSongItemId] = useState<string | null>(null);
  const [dragOverSongItemId, setDragOverSongItemId] = useState<string | null>(null);
  const [toolsItem, setToolsItem] = useState<SetlistSongItem | null>(null);
  // Flow-analysis context: the linked event's slot + the last event's songs
  const [flowTargetSeconds, setFlowTargetSeconds] = useState<number | null>(null);
  const [recentlyPlayed, setRecentlyPlayed] = useState<string[]>([]);

  // ── Performance mode state ─────────────────────
  const [performanceMode, setPerformanceMode] = useState(false);
  const [songContents, setSongContents] = useState<Map<string, { songId: string; content: string; key?: string | null; originalKey?: string | null; tempo?: number | null; durationSeconds?: number | null }>>(new Map());
  const [loadingContents, setLoadingContents] = useState(false);

  // ── Live mode state ────────────────────────────
  const [liveMode, setLiveMode] = useState<"off" | "conductor" | "member">("off");
  const songListRef = useRef<HTMLDivElement>(null);
  const scrollThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const conductor = useConductor(
    liveMode !== "off"
      ? { setlistId: id!, mode: liveMode }
      : { setlistId: "", mode: "member" }
  );

  // Disconnect when going back to off
  const handleLeaveLive = useCallback(() => {
    conductor.leave();
    setLiveMode("off");
  }, [conductor]);

  // Scroll to current song when it changes (member mode)
  useEffect(() => {
    if (liveMode !== "member" || !songListRef.current) return;
    const items = songListRef.current.querySelectorAll("[data-song-index]");
    const target = items[conductor.currentSong];
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [conductor.currentSong, liveMode]);

  // Member: sync scroll position from conductor
  useEffect(() => {
    if (liveMode !== "member" || !songListRef.current) return;
    songListRef.current.scrollTop = conductor.scrollTop;
  }, [conductor.scrollTop, liveMode]);

  // Conductor: broadcast scroll position (throttled)
  const handleScroll = useCallback(() => {
    if (liveMode !== "conductor" || !songListRef.current) return;
    if (scrollThrottleRef.current) return;
    scrollThrottleRef.current = setTimeout(() => {
      scrollThrottleRef.current = null;
      if (songListRef.current) {
        conductor.broadcastScroll(songListRef.current.scrollTop);
      }
    }, 100);
  }, [liveMode, conductor]);

  // Load setlist
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setlistsApi
      .get(id)
      .then((res) => {
        setSetlist(res.setlist);
        setSongs(res.songs);
        saveCachedSetlist(res);
      })
      .catch((error) => {
        const cached = loadCachedSetlist(id);
        if (cached && isOfflineRequestError(error)) {
          setSetlist(cached.response.setlist);
          setSongs(cached.response.songs);
          toast.info("Showing cached setlist while offline");
          return;
        }

        toast.error("Setlist not found");
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Load song contents when entering performance mode
  useEffect(() => {
    if (!performanceMode || songs.length === 0) return;
    setLoadingContents(true);
    const fetchAll = async () => {
      const map = new Map<string, { songId: string; content: string; key?: string | null; originalKey?: string | null; tempo?: number | null; durationSeconds?: number | null }>();
      await Promise.all(
        songs.map(async (item) => {
          if (!item.songId) return; // template slot without a song yet
          try {
            const res = await songsApi.get(item.songId);
            const song = res.song;
            const variation = item.variationId
              ? res.variations?.find((v) => v.id === item.variationId)
              : null;
            map.set(item.songId, {
              songId: item.songId,
              content: variation?.content || song.content,
              key: item.key || variation?.key || song.key,
              // Kept separately so a per-set key_override can transpose the
              // chart on render (transposition is a view concern)
              originalKey: variation?.key || song.key,
              tempo: song.tempo,
              durationSeconds: song.durationSeconds,
            });
          } catch {
            // Skip songs that fail to load
          }
        })
      );

      if (map.size === 0 && id) {
        const cachedMap = loadCachedSetlistPerformanceContents(id);
        if (cachedMap.size > 0) {
          setSongContents(cachedMap);
          setLoadingContents(false);
          toast.info("Using cached performance charts while offline");
          return;
        }
      }

      setSongContents(map);
      if (id && map.size > 0) {
        saveCachedSetlistPerformanceContents(id, map);
      }
      setLoadingContents(false);
    };
    fetchAll();
  }, [id, performanceMode, songs]);

  // Flow-analysis context (best-effort; the strip works without it)
  useEffect(() => {
    if (!id) return;
    eventsApi
      .list({ upcoming: false })
      .then(async (res) => {
        const linked = res.events.find((event) => event.setlistId === id && event.status !== "cancelled");
        setFlowTargetSeconds(linked?.targetSeconds ?? null);

        const lastCompleted = res.events
          .filter((event) => event.status === "completed" && event.setlistId && event.setlistId !== id)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        if (lastCompleted?.setlistId) {
          const lastSetlist = await setlistsApi.get(lastCompleted.setlistId).catch(() => null);
          setRecentlyPlayed(
            (lastSetlist?.songs ?? []).map((item) => item.songId).filter((songId): songId is string => Boolean(songId)),
          );
        }
      })
      .catch(() => {});
  }, [id]);

  // Load available songs for the add-song modal and slot fillers
  const hasEmptySlots = songs.some((item) => !item.songId);
  useEffect(() => {
    if (!showAddSong && !hasEmptySlots) return;
    songsApi.list({ q: searchQ || undefined, limit: hasEmptySlots ? 200 : 20 }).then((res) => {
      setAvailableSongs(res.songs);
    });
  }, [showAddSong, searchQ, hasEmptySlots]);

  const handleFillSlot = async (itemId: string, songId: string) => {
    if (!id) return;
    try {
      await setlistsApi.updateSong(id, itemId, { songId });
      // Reload to pick up the song's title/key/artist join fields
      const res = await setlistsApi.get(id);
      setSongs(res.songs);
      toast.success("Slot filled");
    } catch (err: any) {
      toast.error(err.message || "Failed to fill slot");
    }
  };

  const handleAddSong = async (songId: string) => {
    if (!id) return;
    try {
      const res = await setlistsApi.addSong(id, { songId });
      setSongs((prev) => [...prev, res.item]);
      toast.success("Song added");
      setShowAddSong(false);
      setSearchQ("");
    } catch (err: any) {
      toast.error(err.message || "Failed to add song");
    }
  };

  const handleRemoveSong = async (songItemId: string) => {
    if (!id) return;
    try {
      await setlistsApi.removeSong(id, songItemId);
      setSongs((prev) => prev.filter((s) => s.id !== songItemId));
      toast.success("Song removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove");
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0 || !id) return;
    const newSongs = [...songs];
    [newSongs[index - 1], newSongs[index]] = [newSongs[index], newSongs[index - 1]];
    await persistSongOrder(newSongs);
  };

  const handleMoveDown = async (index: number) => {
    if (index === songs.length - 1 || !id) return;
    const newSongs = [...songs];
    [newSongs[index], newSongs[index + 1]] = [newSongs[index + 1], newSongs[index]];
    await persistSongOrder(newSongs);
  };

  const persistSongOrder = async (nextSongs: SetlistSongItem[]) => {
    if (!id) return;
    const previousSongs = songs;
    const order = nextSongs.map((song, index) => ({ id: song.id, position: index }));
    setSongs(nextSongs);

    try {
      await setlistsApi.reorderSongs(id, order);
    } catch {
      setSongs(previousSongs);
      toast.error("Failed to reorder");
    }
  };

  const handleDragStart = (songItemId: string) => {
    setDraggedSongItemId(songItemId);
    setDragOverSongItemId(songItemId);
  };

  const handleDropReorder = async (targetSongItemId: string) => {
    if (!draggedSongItemId || draggedSongItemId === targetSongItemId) {
      setDraggedSongItemId(null);
      setDragOverSongItemId(null);
      return;
    }

    const sourceIndex = songs.findIndex((song) => song.id === draggedSongItemId);
    const targetIndex = songs.findIndex((song) => song.id === targetSongItemId);

    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggedSongItemId(null);
      setDragOverSongItemId(null);
      return;
    }

    const nextSongs = [...songs];
    const [movedSong] = nextSongs.splice(sourceIndex, 1);
    nextSongs.splice(targetIndex, 0, movedSong);
    setDraggedSongItemId(null);
    setDragOverSongItemId(null);
    await persistSongOrder(nextSongs);
  };

  const handleDeleteSetlist = async () => {
    if (!id) return;
    setDeletingSetlist(true);
    try {
      await setlistsApi.delete(id);
      toast.success("Setlist deleted");
      navigate("/setlists");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeletingSetlist(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleMarkComplete = async () => {
    if (!id) return;
    try {
      const res = await setlistsApi.markComplete(id);
      setSetlist(res.setlist);
      toast.success(`Setlist marked complete — ${res.usagesLogged} song usage(s) logged`);
    } catch (err: any) {
      toast.error(err.message || "Failed to mark complete");
    }
  };

  const handleReopen = async () => {
    if (!id) return;
    try {
      const res = await setlistsApi.reopen(id);
      setSetlist(res.setlist);
      toast.success("Setlist reopened");
    } catch (err: any) {
      toast.error(err.message || "Failed to reopen");
    }
  };

  const handleSubmitForReview = async () => {
    if (!id) return;
    try {
      const res = await setlistsApi.update(id, { status: "in_review" });
      setSetlist(res.setlist);
      toast.success("Submitted for review");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    try {
      const res = await setlistsApi.approve(id);
      setSetlist(res.setlist);
      toast.success("Setlist approved");
    } catch (err: any) {
      toast.error(err.message || "Failed to approve");
    }
  };

  const handleExportZip = async (format: "chordpro" | "onsong" | "text") => {
    if (!id || songs.length === 0) return;
    try {
      const res = await setlistsApi.exportZip(id, format);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${setlist?.name || "setlist"}-${format}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Setlist zip exported");
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    }
    setShowExportMenu(false);
  };

  // Soft set-analysis signals: advise, never block
  const SLOW_BPM = 75;
  const totalDurationSeconds = songs.reduce((sum, item) => sum + (item.duration ?? 0), 0);
  const totalDurationLabel =
    totalDurationSeconds > 0
      ? `${Math.floor(totalDurationSeconds / 60)}:${String(Math.round(totalDurationSeconds % 60)).padStart(2, "0")} total`
      : null;
  const isSlow = (item: SetlistSongItem) => item.songTempo != null && item.songTempo <= SLOW_BPM;
  const slowRunEndsAt = (index: number) =>
    index >= 2 && isSlow(songs[index]) && isSlow(songs[index - 1]) && isSlow(songs[index - 2]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner" />
      </div>
    );
  }

  if (!setlist) {
    return (
      <div className="card-empty space-y-4">
        <p className="text-[hsl(var(--muted-foreground))]">Setlist not found.</p>
        <Link to="/setlists" className="link-accent">
          Back to setlists
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/setlists"
          className="link-muted inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Setlists
        </Link>
        <div className="flex-1" />
        {canEdit && (
          <>
            {setlist.status === "draft" && (
              <button onClick={handleSubmitForReview} className="btn-outline btn-sm">
                Submit for review
              </button>
            )}
            {setlist.status === "in_review" && isAdmin && (
              <button onClick={handleApprove} className="btn-primary btn-sm">
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
              </button>
            )}
            {setlist.status === "complete" ? (
              <button
                onClick={handleReopen}
                className="btn-outline btn-sm"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reopen
              </button>
            ) : (
              <button
                onClick={handleMarkComplete}
                className="btn-success btn-sm"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark Complete
              </button>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="btn-destructive btn-sm"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </>
        )}
        {songs.length > 0 && (
          <button
            data-testid="enter-performance-mode"
            // In a live-sync session keep the in-page overlay (conductor
            // callbacks); otherwise use the full-bleed rehearsal route.
            onClick={() => (liveMode !== "off" ? setPerformanceMode(true) : navigate(`/setlists/${id}/perform`))}
            className="btn-primary btn-sm"
          >
            <Tv className="h-3.5 w-3.5" /> Perform
          </button>
        )}
      </div>

      {/* Setlist info */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="page-title">{setlist.name}</h2>
          {setlist.status === "complete" ? (
            <span className="badge-success">
              <CheckCircle2 className="h-3 w-3" /> Complete
            </span>
          ) : setlist.status === "approved" ? (
            <span className="badge-success">
              <CheckCircle2 className="h-3 w-3" /> Approved
            </span>
          ) : setlist.status === "in_review" ? (
            <span className="badge-warning">In review</span>
          ) : (
            <span className="badge-muted">
              Draft
            </span>
          )}
          {totalDurationLabel && (
            <span className="badge badge-muted" title="Running total of planned durations">
              <Clock className="h-3 w-3" /> {totalDurationLabel}
            </span>
          )}
        </div>
        {setlist.category && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{setlist.category}</p>
        )}
        {setlist.notes && (
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{setlist.notes}</p>
        )}
      </div>

      {/* ── Live Mode Panel ─────────────────────────── */}
      <div className="card card-body space-y-3">
        {liveMode === "off" ? (
          <div className="flex flex-wrap items-center gap-3">
            <Radio className="h-5 w-5 text-[hsl(var(--secondary))]" />
            <span className="text-sm font-medium text-[hsl(var(--foreground))]">Live Mode</span>
            <div className="flex-1" />
            <button
              data-testid="start-conductor"
              onClick={() => setLiveMode("conductor")}
              className="btn-primary btn-sm"
            >
              <Play className="h-3.5 w-3.5" /> Lead Session
            </button>
            <button
              data-testid="join-member"
              onClick={() => setLiveMode("member")}
              className="btn-outline btn-sm"
            >
              <Users className="h-3.5 w-3.5" /> Join Session
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <Radio className="h-5 w-5 text-[hsl(var(--secondary))] animate-pulse" />
              <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                {liveMode === "conductor" ? "Leading Session" : "Following Session"}
              </span>

              {/* Connection indicator */}
              <span
                data-testid="connection-status"
                className={`inline-flex items-center gap-1 text-xs ${
                  conductor.connected
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {conductor.connected ? (
                  <Wifi className="h-3.5 w-3.5" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5" />
                )}
                {conductor.connected ? "Connected" : "Disconnected"}
              </span>

              {/* Members count */}
              <span
                data-testid="members-count"
                className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]"
              >
                <Users className="h-3.5 w-3.5" />
                {conductor.roomState.members.length} member{conductor.roomState.members.length !== 1 ? "s" : ""}
              </span>

              <div className="flex-1" />
              <button
                data-testid="leave-session"
                onClick={handleLeaveLive}
                className="btn-destructive btn-sm"
              >
                <LogOut className="h-3.5 w-3.5" /> Leave
              </button>
            </div>

            {/* Conductor info */}
            {conductor.roomState.conductor && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Conductor: <span className="font-medium">{conductor.roomState.conductor.displayName}</span>
              </p>
            )}

            {/* Conductor left warning */}
            {liveMode === "member" && !conductor.roomState.conductor && (
              <div
                data-testid="conductor-left-warning"
                className="rounded-md bg-amber-100 p-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
              >
                The conductor has left the session. Waiting for a new conductor...
              </div>
            )}

            {/* Now playing banner */}
            {songs.length > 0 && (
              <div
                data-testid="now-playing"
                className="rounded-md bg-[hsl(var(--secondary))]/10 p-2 text-sm"
              >
                <span className="text-[hsl(var(--muted-foreground))]">Now playing:</span>{" "}
                <span className="font-medium text-[hsl(var(--foreground))]">
                  {songs[conductor.currentSong]?.songTitle || "—"}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title={setlist ? `Delete \"${setlist.name}\"?` : "Delete setlist?"}
        description="This permanently removes the setlist from your library."
        confirmLabel="Delete setlist"
        busy={deletingSetlist}
        onClose={() => {
          if (!deletingSetlist) {
            setShowDeleteConfirm(false);
          }
        }}
        onConfirm={handleDeleteSetlist}
      />

      {toolsItem && id && (
        <SetlistItemTools
          setlistId={id}
          item={toolsItem}
          onClose={() => setToolsItem(null)}
          onSaved={(updated) =>
            setSongs((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)))
          }
        />
      )}

      {/* Set flow strip — ambient, advisory, recomputed on every change */}
      <FlowStrip items={songs} targetSeconds={flowTargetSeconds} recentlyPlayed={recentlyPlayed} />

      {/* Song list */}
      <div className="space-y-2">
        <div className="section-header">
          <h3 className="section-title">
            Songs ({songs.length})
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {songs.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowExportMenu((value) => !value)}
                  className="btn-outline btn-sm"
                >
                  <Download className="h-3.5 w-3.5" /> Export ZIP <ChevronDown className="h-3.5 w-3.5" />
                </button>

                {showExportMenu && (
                  <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => handleExportZip("chordpro")}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                    >
                      ChordPro ZIP (.zip)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportZip("onsong")}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                    >
                      OnSong ZIP (.zip)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportZip("text")}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                    >
                      Plain Text ZIP (.zip)
                    </button>
                  </div>
                )}
              </div>
            )}

            {canEdit && (
              <button
                onClick={() => setShowAddSong(true)}
                className="btn-primary btn-sm"
              >
                <Plus className="h-3.5 w-3.5" /> Add Song
              </button>
            )}
          </div>
        </div>

        {songs.length === 0 ? (
          <div className="card-empty !p-8">
            <Music className="mx-auto h-10 w-10 mb-2 text-[hsl(var(--muted-foreground))]" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No songs in this setlist.
            </p>
            {canEdit && (
              <button
                onClick={() => setShowAddSong(true)}
                className="link-accent mt-2"
              >
                Add a song
              </button>
            )}
          </div>
        ) : (
          <div
            ref={songListRef}
            onScroll={handleScroll}
            className="list-container"
          >
            {songs.map((item, idx) => {
              // Key compatibility indicator for transition from previous song
              const prevSong = idx > 0 ? songs[idx - 1] : null;
              const prevKey = prevSong ? (prevSong.key || prevSong.songKey) : null;
              const curKey = item.key || item.songKey;
              const dist = prevKey && curKey ? getKeyDistance(prevKey, curKey) : null;
              const showKeyWarn = dist !== null && dist >= 5;

              return (
                <div key={item.id}>
                  {/* Key transition warning between songs */}
                  {showKeyWarn && (
                    <div
                      data-testid={`key-warning-${idx}`}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-y border-amber-200 dark:border-amber-800/40"
                    >
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span>
                        Distant key change: {prevKey} → {curKey} ({dist} semitones)
                      </span>
                    </div>
                  )}
                  {/* Pacing warning: three or more slow songs in a row */}
                  {slowRunEndsAt(idx) && !slowRunEndsAt(idx + 1) && (
                    <div
                      data-testid={`slow-run-warning-${idx}`}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-y border-amber-200 dark:border-amber-800/40"
                    >
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span>Three or more slow songs in a row (≤{SLOW_BPM} BPM) — consider varying the pace.</span>
                    </div>
                  )}
                  <div
                    data-song-index={idx}
                    className={`flex items-center gap-3 p-3 transition-colors ${
                      liveMode !== "off" && idx === conductor.currentSong
                        ? "bg-[hsl(var(--secondary))]/10 ring-1 ring-inset ring-[hsl(var(--secondary))]/30"
                        : ""
                    } ${dragOverSongItemId === item.id ? "bg-[hsl(var(--secondary))]/5" : ""}`}
                    onDragOver={(event) => {
                      if (!canEdit) return;
                      event.preventDefault();
                      setDragOverSongItemId(item.id);
                    }}
                    onDrop={(event) => {
                      if (!canEdit) return;
                      event.preventDefault();
                      void handleDropReorder(item.id);
                    }}
                    onDragEnd={() => {
                      setDraggedSongItemId(null);
                      setDragOverSongItemId(null);
                    }}
                  >
                {/* Reorder controls */}
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      draggable
                      onDragStart={() => handleDragStart(item.id)}
                      className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-grab active:cursor-grabbing"
                      title="Drag to reorder"
                      aria-label={`Drag ${item.songTitle} to reorder`}
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => void handleMoveUp(idx)}
                        disabled={idx === 0}
                        className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-30"
                        title="Move up"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => void handleMoveDown(idx)}
                        disabled={idx === songs.length - 1}
                        className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-30"
                        title="Move down"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                )}

                {/* Position number */}
                <span className="w-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
                  {idx + 1}
                </span>

                {/* Song info (or an unfilled template slot) */}
                {item.songId ? (
                  <Link
                    to={item.variationId ? `/songs/${item.songId}?variation=${item.variationId}` : `/songs/${item.songId}`}
                    className="flex-1 min-w-0 hover:text-[hsl(var(--secondary))]"
                  >
                    <div className="font-medium truncate text-[hsl(var(--foreground))]">
                      {item.songTitle}
                      {item.slotLabel && <span className="ml-2 text-xs font-normal text-[hsl(var(--muted-foreground))]">({item.slotLabel})</span>}
                    </div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {[
                        item.variationName ? `Variation: ${item.variationName}` : null,
                        item.key || item.songKey ? `Key: ${item.key || item.songKey}` : null,
                        item.songArtist,
                        item.songTempo ? `${item.songTempo} BPM` : null,
                        item.capo ? `Capo ${item.capo}` : null,
                        item.arrangement ? item.arrangement.replace("_", " ").toLowerCase() : null,
                        item.transitionCues?.length ? `${item.transitionCues.length} cue${item.transitionCues.length !== 1 ? "s" : ""}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </Link>
                ) : (
                  <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
                    <span className="badge badge-warning">{item.slotLabel || "Empty slot"}</span>
                    {canEdit && (
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) void handleFillSlot(item.id, e.target.value);
                        }}
                        className="input !py-1 text-xs w-auto max-w-[220px]"
                        aria-label={`Fill slot ${item.slotLabel || idx + 1}`}
                      >
                        <option value="">Choose a song…</option>
                        {availableSongs.map((song) => (
                          <option key={song.id} value={song.id}>
                            {song.title}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Per-song performance tools */}
                {canEdit && item.songId && (
                  <button
                    onClick={() => setToolsItem(item)}
                    className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                    title="Performance tools (capo, arrangement, transitions)"
                    aria-label={`Performance tools for ${item.songTitle}`}
                  >
                    <Settings2 className="h-4 w-4" />
                  </button>
                )}

                {/* Conductor: Go-to button */}
                {liveMode === "conductor" && idx !== conductor.currentSong && (
                  <button
                    onClick={() => conductor.goToSong(idx)}
                    className="btn-primary btn-xs"
                    title="Navigate to this song"
                  >
                    <Play className="h-3 w-3" /> Go
                  </button>
                )}

                {/* Now Playing indicator in live mode */}
                {liveMode !== "off" && idx === conductor.currentSong && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--secondary))]/20 px-2 py-0.5 text-xs font-medium text-[hsl(var(--secondary))]">
                    <Radio className="h-3 w-3 animate-pulse" /> Live
                  </span>
                )}

                {/* Remove */}
                {canEdit && (
                  <button
                    onClick={() => handleRemoveSong(item.id)}
                    className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                    title="Remove from setlist"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Song Modal */}
      {showAddSong && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-brand text-[hsl(var(--foreground))]">Add Song</h3>
              <button
                onClick={() => {
                  setShowAddSong(false);
                  setSearchQ("");
                }}
                className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search songs..."
              className="input mb-3"
              autoFocus
            />
            <div className="max-h-60 overflow-y-auto divide-y divide-[hsl(var(--border))]">
              {availableSongs.length === 0 ? (
                <p className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  No songs found
                </p>
              ) : (
                availableSongs.map((song) => (
                  <button
                    key={song.id}
                    onClick={() => handleAddSong(song.id)}
                    className="w-full text-left p-3 hover:bg-[hsl(var(--muted))] transition-colors"
                  >
                    <div className="font-medium text-sm text-[hsl(var(--foreground))]">
                      {song.title}
                    </div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {[song.key && `Key: ${song.key}`, song.artist]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {/* Performance Mode Overlay */}
      {performanceMode && (
        <PerformanceMode
          songs={songs}
          songContents={songContents}
          setlistName={setlist.name}
          initialSongIndex={liveMode === "conductor" ? conductor.currentSong : 0}
          onExit={() => setPerformanceMode(false)}
          onSongChange={liveMode === "conductor" ? (idx) => conductor.goToSong(idx) : undefined}
        />
      )}
    </div>
  );
}
