import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { CalendarPlus, Download, Edit, Share2, Trash2 } from "lucide-react";
import { songsApi, songUsageApi, type Song, type SongVariation } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { isOfflineRequestError, loadCachedSong, saveCachedSong } from "@/lib/offline-cache";
import { ChartView } from "@/components/songs/ChartView";
import { LogPlayDialog } from "@/components/songs/LogPlayDialog";
import { ShareSongDialog } from "@/components/songs/ShareSongDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import type { ActionMenuEntry } from "@/components/ui/ActionMenu";
import { songStatusLabel } from "@vpc-music/shared";

/**
 * A member's chart: the lead sheet (see ChartView) with what only a member can
 * do around it — search the library, download, share, log a play, edit and
 * delete. Rendered outside the app shell.
 */
export function SongChartPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, activeOrg } = useAuth();

  const [song, setSong] = useState<Song | null>(null);
  const [variations, setVariations] = useState<SongVariation[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [logPlayOpen, setLogPlayOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canEdit = user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician";

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    songsApi
      .get(id)
      .then((res) => {
        setSong(res.song);
        setVariations(res.variations || []);
        saveCachedSong(res);
      })
      .catch((error) => {
        const cached = loadCachedSong(id);
        if (cached && isOfflineRequestError(error)) {
          setSong(cached.response.song);
          setVariations(cached.response.variations || []);
          toast.info("Showing the cached chart while offline");
          return;
        }
        toast.error("Song not found");
      })
      .finally(() => setLoading(false));
  }, [id]);

  // A curated default variation is the chart people should see; the
  // variation editing UI itself is not part of this tranche.
  const defaultVariation = song?.defaultVariationId
    ? variations.find((variation) => variation.id === song.defaultVariationId) ?? null
    : null;
  const content = defaultVariation?.content ?? song?.content ?? "";
  const originalKey = defaultVariation?.key ?? song?.key ?? null;

  const download = async (fetcher: () => Promise<Response>, extension: string) => {
    if (!song) return;
    try {
      const res = await fetcher();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${song.title || "song"}.${extension}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    }
  };

  const handleLogPlay = async (data: { usedAt: string; notes?: string }) => {
    if (!id) return;
    try {
      await songUsageApi.log(id, data);
      toast.success("Play logged");
    } catch (error: any) {
      toast.error(error?.message || "Failed to log the play");
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await songsApi.delete(id);
      toast.success("Song deleted");
      navigate("/songs");
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete the song");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const downloads: ActionMenuEntry[] = [
    { label: "Download ChordPro (.cho)", icon: <Download />, onSelect: () => download(() => songsApi.exportChordPro(id!, defaultVariation?.id), "cho") },
    { label: "Download OnSong (.onsong)", icon: <Download />, onSelect: () => download(() => songsApi.exportOnSong(id!, defaultVariation?.id), "onsong") },
    { label: "Download text (.txt)", icon: <Download />, onSelect: () => download(() => songsApi.exportText(id!, defaultVariation?.id), "txt") },
    { label: "Download PDF", icon: <Download />, onSelect: () => window.open(songsApi.exportPdf(id!, defaultVariation?.id), "_blank") },
  ];

  const editing: ActionMenuEntry[] = canEdit
    ? [
        { label: "Share chart", icon: <Share2 />, onSelect: () => setShareOpen(true) },
        { label: "Log a play", icon: <CalendarPlus />, onSelect: () => setLogPlayOpen(true) },
        "separator",
        { label: "Edit", icon: <Edit />, onSelect: () => navigate(`/songs/${id}/edit`) },
        { label: "Delete", icon: <Trash2 />, onSelect: () => setConfirmDelete(true), destructive: true },
      ]
    : [];

  if (loading) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-[hsl(var(--background))]">
        <div className="spinner" />
      </div>
    );
  }

  if (!song || !id) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
        <p className="text-[hsl(var(--muted-foreground))]">Song not found.</p>
        <button type="button" onClick={() => navigate("/songs")} className="btn-primary">
          Back to songs
        </button>
      </div>
    );
  }

  const statusLabel = songStatusLabel(song.status);

  return (
    <ChartView
      chartId={id}
      title={song.title}
      artist={song.artist}
      year={song.year}
      tempo={song.tempo}
      badges={
        <>
          {song.isDraft && <span className="badge-muted">Draft</span>}
          {statusLabel && <span className="badge-muted">{statusLabel}</span>}
        </>
      }
      content={content}
      originalKey={originalKey}
      showSearch
      showDropbox
      mediaHref={(directive) => songsApi.mediaHref(id, directive)}
      menuBefore={downloads}
      menuAfter={editing}
      hostModalOpen={shareOpen || logPlayOpen || confirmDelete}
      banner={<OfflineBanner />}
    >
      {canEdit && <ShareSongDialog open={shareOpen} onClose={() => setShareOpen(false)} songId={id} songTitle={song.title} />}
      <LogPlayDialog open={logPlayOpen} onClose={() => setLogPlayOpen(false)} onSubmit={handleLogPlay} />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this song?"
        description="The song moves to the trash and disappears from the list."
        confirmLabel="Delete song"
        busy={deleting}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </ChartView>
  );
}
