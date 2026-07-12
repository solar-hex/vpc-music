import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { songsApi, shareApi, songUsageApi, songHistoryApi, variationsApi, stickyNotesApi, setlistsApi, type Song, type SongUsage, type SongVariation, type SongEdit, type StickyNote, type Setlist } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ChordProRenderer, AutoScroll, type ChordProRendererHandle } from "@/components/songs/ChordProRenderer";
import { SongCollaborationPanel } from "@/components/songs/SongCollaborationPanel";
import { ShareManageDialog } from "@/components/songs/ShareManageDialog";
import { TempoIndicator } from "@/components/songs/TempoIndicator";
import { SongStatusBadge } from "@/components/songs/SongStatusBadge";
import { SongActionsMenu } from "@/components/songs/SongActionsMenu";
import { StaffNotation } from "@/components/songs/StaffNotation";
import { MetronomeWidget } from "@/components/songs/MetronomeWidget";
import { useAuth } from "@/contexts/AuthContext";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { isOfflineRequestError, loadCachedSong, saveCachedSong } from "@/lib/offline-cache";
import { ALL_KEYS, composeTranspose } from "@vpc-music/shared";
import { toast } from "sonner";
import { ArrowLeft, Edit, Trash2, Download, Eye, EyeOff, Share2, Check, Copy, CalendarPlus, History, X, Printer, Settings2, Hash, ChevronDown, Layers, Plus, Pencil, FileText, StickyNote as StickyNoteIcon, Music2 } from "lucide-react";

const ENHARMONIC_KEY_MAP: Record<string, string> = {
  "B#": "C",
  "C#": "Db",
  "D#": "Eb",
  "E#": "F",
  "F#": "Gb",
  "G#": "Ab",
  "A#": "Bb",
  Cb: "B",
  Fb: "E",
};

function normalizeSongKey(key: string | null | undefined) {
  if (!key) return null;
  const trimmed = key.trim();
  return ENHARMONIC_KEY_MAP[trimmed] ?? trimmed;
}

interface ConfirmState {
  title: string;
  description: string;
  confirmLabel: string;
  action: () => Promise<void>;
}

export function SongViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, activeOrg } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChords, setShowChords] = useState(true);
  const [nashville, setNashville] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chordProRef = useRef<ChordProRendererHandle>(null);
  const [usages, setUsages] = useState<SongUsage[]>([]);
  const [showUsageForm, setShowUsageForm] = useState(false);
  const [usageDate, setUsageDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [usageNotes, setUsageNotes] = useState("");
  const [loggingUsage, setLoggingUsage] = useState(false);
  const [showShareManage, setShowShareManage] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showMusicianTools, setShowMusicianTools] = useState(false);
  const [showSetlistPicker, setShowSetlistPicker] = useState(false);
  const [availableSetlists, setAvailableSetlists] = useState<Setlist[]>([]);
  const [loadingSetlists, setLoadingSetlists] = useState(false);
  const [addingToSetlistId, setAddingToSetlistId] = useState<string | null>(null);
  const [editHistory, setEditHistory] = useState<SongEdit[]>([]);
  const [showEditHistory, setShowEditHistory] = useState(false);

  // Sticky notes state
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>([]);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editingNote, setEditingNote] = useState<StickyNote | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [noteColor, setNoteColor] = useState("yellow");
  const [savingNote, setSavingNote] = useState(false);

  // Variation state
  const [variations, setVariations] = useState<SongVariation[]>([]);
  const [activeVariationId, setActiveVariationId] = useState<string | null>(null);
  const [showVariationForm, setShowVariationForm] = useState(false);
  const [editingVariation, setEditingVariation] = useState<SongVariation | null>(null);
  const [varName, setVarName] = useState("");
  const [varKey, setVarKey] = useState("");
  const [varContent, setVarContent] = useState("");
  const [savingVariation, setSavingVariation] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmingAction, setConfirmingAction] = useState(false);
  const requestedVariationId = searchParams.get("variation");
  const canSetDefaultVariation =
    user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician";
  const canEdit = canSetDefaultVariation; // same permission level

  const selectVariation = (variationId: string | null) => {
    setActiveVariationId(variationId);
    const next = new URLSearchParams(searchParams);
    if (variationId) {
      next.set("variation", variationId);
    } else if (song?.defaultVariationId) {
      next.set("variation", "original");
    } else {
      next.delete("variation");
    }
    setSearchParams(next, { replace: true });
  };

  // Keyboard shortcuts & foot pedal support (PageDown/Up, Arrow keys, etc.)
  const isModalOpen = showUsageForm || showShareManage || showVariationForm || Boolean(confirmState);
  useKeyboardShortcuts({
    scrollRef,
    onTransposeUp: () => chordProRef.current?.transposeUp(),
    onTransposeDown: () => chordProRef.current?.transposeDown(),
    enabled: !isModalOpen,
  });

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
          toast.info("Showing cached song while offline");
          return;
        }

        toast.error("Song not found");
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (requestedVariationId === "original") {
      setActiveVariationId(null);
    } else if (requestedVariationId && variations.some((variation) => variation.id === requestedVariationId)) {
      setActiveVariationId(requestedVariationId);
    } else if (!requestedVariationId && song?.defaultVariationId && variations.some((variation) => variation.id === song.defaultVariationId)) {
      setActiveVariationId(song.defaultVariationId);
    } else {
      setActiveVariationId(null);
    }
  }, [requestedVariationId, song?.defaultVariationId, variations]);

  useEffect(() => {
    if (!showSetlistPicker) return;
    setLoadingSetlists(true);
    setlistsApi
      .list()
      .then((res) => setAvailableSetlists(res.setlists))
      .catch(() => toast.error("Failed to load setlists"))
      .finally(() => setLoadingSetlists(false));
  }, [showSetlistPicker]);

  // Load usage history
  useEffect(() => {
    if (!id) return;
    songUsageApi.list(id).then((res) => setUsages(res.usages)).catch(() => {});
  }, [id]);

  // Load edit history
  useEffect(() => {
    if (!id) return;
    songHistoryApi.list(id).then((res) => setEditHistory(res.history)).catch(() => {});
  }, [id]);

  // Load sticky notes
  useEffect(() => {
    if (!id) return;
    stickyNotesApi.list(id).then((res) => setStickyNotes(res.notes)).catch(() => {});
  }, [id]);

  const handleSaveNote = async () => {
    if (!id || !noteContent.trim()) return;
    setSavingNote(true);
    try {
      if (editingNote) {
        const res = await stickyNotesApi.update(id, editingNote.id, {
          content: noteContent.trim(),
          color: noteColor,
        });
        setStickyNotes((prev) => prev.map((n) => (n.id === editingNote.id ? res.note : n)));
        toast.success("Note updated");
      } else {
        const res = await stickyNotesApi.create(id, {
          content: noteContent.trim(),
          color: noteColor,
        });
        setStickyNotes((prev) => [...prev, res.note]);
        toast.success("Note added");
      }
      setShowNoteForm(false);
      setEditingNote(null);
      setNoteContent("");
      setNoteColor("yellow");
    } catch (err: any) {
      toast.error(err.message || "Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!id) return;
    setConfirmState({
      title: "Delete this note?",
      description: "This note will be permanently removed.",
      confirmLabel: "Delete note",
      action: async () => {
        await stickyNotesApi.delete(id, noteId);
        setStickyNotes((prev) => prev.filter((n) => n.id !== noteId));
        toast.success("Note deleted");
      },
    });
  };

  const openEditNote = (note: StickyNote) => {
    setEditingNote(note);
    setNoteContent(note.content);
    setNoteColor(note.color);
    setShowNoteForm(true);
  };

  const handleLogUsage = async () => {
    if (!id || !usageDate) return;
    setLoggingUsage(true);
    try {
      const res = await songUsageApi.log(id, {
        usedAt: usageDate,
        notes: usageNotes.trim() || undefined,
      });
      setUsages((prev) => [res.usage, ...prev]);
      toast.success("Usage logged");
      setShowUsageForm(false);
      setUsageNotes("");
    } catch (err: any) {
      toast.error(err.message || "Failed to log usage");
    } finally {
      setLoggingUsage(false);
    }
  };

  const handleDeleteUsage = async (usageId: string) => {
    if (!id) return;
    try {
      await songUsageApi.remove(id, usageId);
      setUsages((prev) => prev.filter((u) => u.id !== usageId));
      toast.success("Usage record removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove");
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setConfirmState({
      title: "Delete this song permanently?",
      description: "This removes the song and its saved variations from the library.",
      confirmLabel: "Delete song",
      action: async () => {
        await songsApi.delete(id);
        toast.success("Song deleted");
        navigate("/songs");
      },
    });
  };

  const handleAddToSetlist = async (setlistId: string) => {
    if (!id) return;
    setAddingToSetlistId(setlistId);
    try {
      await setlistsApi.addSong(setlistId, {
        songId: id,
        variationId: activeVariation?.id,
        key: displayKey || undefined,
        notes: activeVariation ? `Variation: ${activeVariation.name}` : undefined,
      });
      toast.success(
        activeVariation
          ? `Added ${song?.title} (${activeVariation.name}) to the setlist`
          : `Added ${song?.title} to the setlist`,
      );
      setShowSetlistPicker(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add to setlist");
    } finally {
      setAddingToSetlistId(null);
    }
  };

  const handleExport = async () => {
    if (!id) return;
    try {
      const res = await songsApi.exportChordPro(id, activeVariation?.id);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeVariation ? `${song?.title || "song"} - ${activeVariation.name}` : song?.title || "song"}.cho`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    }
    setShowExportMenu(false);
  };

  const handleExportOnSong = async () => {
    if (!id) return;
    try {
      const res = await songsApi.exportOnSong(id, activeVariation?.id);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeVariation ? `${song?.title || "song"} - ${activeVariation.name}` : song?.title || "song"}.onsong`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    }
    setShowExportMenu(false);
  };

  const handleExportText = async () => {
    if (!id) return;
    try {
      const res = await songsApi.exportText(id, activeVariation?.id);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeVariation ? `${song?.title || "song"} - ${activeVariation.name}` : song?.title || "song"}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    }
    setShowExportMenu(false);
  };

  const handleExportPdf = () => {
    if (!id) return;
    window.open(songsApi.exportPdf(id, activeVariation?.id), "_blank");
    setShowExportMenu(false);
  };

  const handleShare = async () => {
    if (!id) return;
    setSharing(true);
    try {
      const { shareUrl: url } = await shareApi.create(id);
      const fullUrl = `${window.location.origin}${url}`;
      setShareUrl(fullUrl);
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success("Share link copied to clipboard");
      setTimeout(() => setCopied(false), 3000);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate share link");
    } finally {
      setSharing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 3000);
  };

  // ── Variation handlers ───────────────────────────
  const activeVariation = activeVariationId
    ? variations.find((v) => v.id === activeVariationId) ?? null
    : null;
  const defaultVariation = song?.defaultVariationId
    ? variations.find((v) => v.id === song.defaultVariationId) ?? null
    : null;
  const displayContent = activeVariation ? activeVariation.content : song?.content ?? "";
  const originalKey = activeVariation?.key ?? song?.key;
  const requestedSearchKey = normalizeSongKey(searchParams.get("key"));
  const displayKey = requestedSearchKey && ALL_KEYS.includes(requestedSearchKey) ? requestedSearchKey : originalKey;
  const baseTranspose = composeTranspose({ sourceKey: originalKey, overrideKey: displayKey }).semis;

  const openNewVariation = () => {
    setEditingVariation(null);
    setVarName("");
    setVarKey(song?.key || "");
    setVarContent(song?.content || "");
    setShowVariationForm(true);
  };

  const openEditVariation = (v: SongVariation) => {
    if (!id) return;
    navigate(`/songs/${id}/edit?variation=${v.id}`);
  };

  const handleSaveVariation = async () => {
    if (!id || !varName.trim() || !varContent.trim()) {
      toast.error("Name and content are required");
      return;
    }
    setSavingVariation(true);
    try {
      if (editingVariation) {
        const res = await variationsApi.update(id, editingVariation.id, {
          name: varName.trim(),
          content: varContent,
          key: varKey || undefined,
        });
        setVariations((prev) =>
          prev.map((v) => (v.id === editingVariation.id ? res.variation : v))
        );
        toast.success("Variation updated");
      } else {
        const res = await variationsApi.create(id, {
          name: varName.trim(),
          content: varContent,
          key: varKey || undefined,
        });
        setVariations((prev) => [...prev, res.variation]);
        selectVariation(res.variation.id);
        toast.success("Variation created");
      }
      setShowVariationForm(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save variation");
    } finally {
      setSavingVariation(false);
    }
  };

  const handleDeleteVariation = async (varId: string) => {
    if (!id) return;
    setConfirmState({
      title: "Delete this variation?",
      description: "The variation will be permanently removed from this song.",
      confirmLabel: "Delete variation",
      action: async () => {
        await variationsApi.delete(id, varId);
        setVariations((prev) => prev.filter((v) => v.id !== varId));
        if (activeVariationId === varId) selectVariation(null);
        toast.success("Variation deleted");
      },
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmState) return;
    setConfirmingAction(true);
    try {
      await confirmState.action();
      setConfirmState(null);
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setConfirmingAction(false);
    }
  };

  const handleSetDefaultVariation = async (variationId: string | null) => {
    if (!id) return;
    try {
      const res = await variationsApi.setDefault(id, variationId);
      setSong(res.song);
      toast.success(
        variationId
          ? "Default variation updated"
          : "Original version is now the default"
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update default variation");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner" />
      </div>
    );
  }

  if (!song) {
    return (
      <div className="card-empty space-y-4">
        <p className="text-[hsl(var(--muted-foreground))]">Song not found.</p>
        <Link to="/songs" className="link-accent">
          Back to songs
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 print-hidden">
        <Link
          to="/songs"
          className="link-muted inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Songs
        </Link>
        <div className="flex-1" />
        <AutoScroll containerRef={scrollRef} />
        <button
          onClick={() => setShowChords((v) => !v)}
          className="btn-outline btn-sm"
          title={showChords ? "Hide chords" : "Show chords"}
        >
          {showChords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          Chords
        </button>
        {showChords && displayKey && (
          <button
            onClick={() => setNashville((v) => !v)}
            className={`btn-sm ${
              nashville
                ? "btn-primary"
                : "btn-outline"
            }`}
            title={nashville ? "Show chord names" : "Show Nashville numbers"}
          >
            <Hash className="h-3.5 w-3.5" />
            Nashville
          </button>
        )}
        <select
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="select btn-sm w-auto"
          title="Font size"
        >
          {[12, 14, 16, 18, 20, 24].map((s) => (
            <option key={s} value={s}>
              {s}px
            </option>
          ))}
        </select>
        {canEdit && (
          <button
            onClick={shareUrl ? handleCopyLink : handleShare}
            disabled={sharing}
            className="btn-outline btn-sm"
            title="Generate a read-only share link"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : shareUrl ? (
              <Copy className="h-3.5 w-3.5" />
            ) : (
              <Share2 className="h-3.5 w-3.5" />
            )}
            {sharing ? "Sharing..." : copied ? "Copied!" : shareUrl ? "Copy Link" : "Share"}
          </button>
        )}
        {canEdit && (
          <button
            onClick={() => setShowShareManage(true)}
            className="btn-outline btn-sm"
            title="Manage share links"
          >
            <Settings2 className="h-3.5 w-3.5" /> Links
          </button>
        )}
        {canEdit && (
          <Link
            to={activeVariationId ? `/songs/${id}/edit?variation=${activeVariationId}` : `/songs/${id}/edit`}
            className="btn-outline btn-sm"
          >
            <Edit className="h-3.5 w-3.5" /> Edit
          </Link>
        )}
        {canEdit && (
          <button
            onClick={() => setShowSetlistPicker(true)}
            className="btn-outline btn-sm"
            title="Add this song to a setlist"
          >
            <Plus className="h-3.5 w-3.5" /> Add to Setlist
          </button>
        )}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="btn-outline btn-sm"
          >
            <Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3" />
          </button>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 z-10 w-44 card card-body py-1 !p-0">
              <button
                onClick={handleExport}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-[hsl(var(--muted))] transition-colors"
              >
                ChordPro (.cho)
              </button>
              <button
                onClick={handleExportOnSong}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-[hsl(var(--muted))] transition-colors"
              >
                OnSong (.onsong)
              </button>
              <button
                onClick={handleExportText}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-[hsl(var(--muted))] transition-colors"
              >
                Plain Text (.txt)
              </button>
              <button
                onClick={handleExportPdf}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-[hsl(var(--muted))] transition-colors"
              >
                PDF (print)
              </button>
            </div>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => setShowUsageForm(true)}
            className="btn-primary btn-sm"
            title="Log when this song was used in a service"
          >
            <CalendarPlus className="h-3.5 w-3.5" /> Log Usage
          </button>
        )}
        <button
          onClick={() => window.print()}
          className="btn-outline btn-sm"
          title="Print chord chart"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
        {canEdit && (
          <button
            onClick={handleDelete}
            className="btn-destructive btn-sm"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        )}
      </div>

      {/* Song metadata */}
      <div className="space-y-1 print-meta">
        <h2 className="page-title flex flex-wrap items-center gap-2">
          <span>
            {song.title}
            {activeVariation && (
              <span className="ml-2 text-base font-normal text-[hsl(var(--secondary))]">
                — {activeVariation.name}
              </span>
            )}
          </span>
          <span className="print-hidden inline-flex items-center gap-2">
            <SongStatusBadge status={song.status} isArchived={song.isArchived} size="md" />
            <SongActionsMenu
              song={song}
              canEdit={!!canEdit}
              onChanged={(updated) => setSong((prev) => (prev ? { ...prev, ...updated } : prev))}
              onRemoved={() => navigate("/songs")}
            />
          </span>
        </h2>
        <div className="flex flex-wrap gap-3 text-sm text-[hsl(var(--muted-foreground))]">
          {song.artist && <span>{song.artist}</span>}
          {song.category && <span>Category: {song.category}</span>}
          {song.aka && <span>AKA: {song.aka}</span>}
          {song.shout && <span>Shout: {song.shout}</span>}
          {displayKey && <span>Key: {displayKey}</span>}
          {song.tempo && <TempoIndicator tempo={song.tempo} />}
          {song.tags && <span>{song.tags}</span>}
        </div>
      </div>

      {/* Variation Tabs */}
      {(variations.length > 0 || true) && (
        <div className="flex flex-wrap items-center gap-2 print-hidden" data-testid="variation-tabs">
          <Layers className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <button
            onClick={() => selectVariation(null)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              !activeVariationId
                ? "btn-primary !py-1 !px-3"
                : "btn-outline !py-1 !px-3"
            }`}
          >
            Original
            {!song.defaultVariationId && <span className="ml-1 opacity-70">• Default</span>}
          </button>
          {variations.map((v) => (
            <div key={v.id} className="group relative flex items-center">
              <button
                onClick={() => selectVariation(v.id)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  activeVariationId === v.id
                    ? "btn-primary !py-1 !px-3"
                    : "btn-outline !py-1 !px-3"
                }`}
              >
                {v.name}
                {v.key && v.key !== song.key && (
                  <span className="ml-1 opacity-60">({v.key})</span>
                )}
                {song.defaultVariationId === v.id && (
                  <span className="ml-1 opacity-70">• Default</span>
                )}
              </button>
              {canEdit && (
                <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                  <button
                    onClick={() => openEditVariation(v)}
                    className="rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                    title="Open full variation editor"
                    aria-label="Open full variation editor"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteVariation(v.id)}
                    className="rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] transition-colors"
                    title="Delete variation"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {canEdit && (
            <button
              onClick={openNewVariation}
              className="btn-outline btn-sm border-dashed"
              title="Create a new variation"
            >
              <Plus className="h-3 w-3" /> Variation
            </button>
          )}
        </div>
      )}

      <div className="card card-body flex flex-wrap items-center gap-2 print-hidden">
        <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          Default View
        </span>
        <span className="badge-muted">
          {defaultVariation ? defaultVariation.name : "Original"}
        </span>
        {canSetDefaultVariation && (
          activeVariation?.id === song.defaultVariationId || (!activeVariation && !song.defaultVariationId) ? (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Current selection is already the default.</span>
          ) : (
            <button
              onClick={() => handleSetDefaultVariation(activeVariation?.id ?? null)}
              className="btn-outline btn-sm"
            >
              {activeVariation ? "Make Selected Variation Default" : "Use Original as Default"}
            </button>
          )
        )}
      </div>

      {/* ChordPro renderer */}
      <div
        ref={scrollRef}
        className="card card-body-lg overflow-y-auto print-sheet"
        style={{ maxHeight: "calc(100vh - 280px)" }}
      >
        <ChordProRenderer
          ref={chordProRef}
          content={displayContent}
          songKey={originalKey}
          baseTranspose={baseTranspose}
          showChords={showChords}
          nashville={nashville}
          fontSize={fontSize}
        />
      </div>

      {/* Musician tools: staff notation + metronome */}
      {(song.abcNotation || song.tempo) && (
        <div className="space-y-2 print-hidden">
          <button
            onClick={() => setShowMusicianTools((prev) => !prev)}
            className="section-title w-full text-left"
            aria-expanded={showMusicianTools}
          >
            <Music2 className="section-title-icon" /> Musician Tools
            <ChevronDown className={`h-4 w-4 transition-transform ${showMusicianTools ? "rotate-180" : ""}`} />
          </button>
          {showMusicianTools && (
            <div className="space-y-3">
              {song.tempo ? <MetronomeWidget tempo={song.tempo} /> : null}
              {song.abcNotation && <StaffNotation abc={song.abcNotation} />}
            </div>
          )}
        </div>
      )}

      {/* Usage History */}
      {usages.length > 0 && (
        <div className="space-y-2 print-hidden">
          <h3 className="section-title">
            <History className="section-title-icon" /> Usage History
          </h3>
          <div className="list-container">
            {usages.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-4 py-2.5 group">
                <div>
                  <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                    {new Date(u.usedAt + "T00:00:00").toLocaleDateString(undefined, {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  {u.notes && (
                    <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
                      — {u.notes}
                    </span>
                  )}
                </div>
                {canEdit && (
                  <button
                    onClick={() => handleDeleteUsage(u.id)}
                    className="opacity-0 group-hover:opacity-100 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] transition-all"
                    title="Remove usage record"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit History */}
      {editHistory.length > 0 && (
        <div className="space-y-2 print-hidden">
          <button
            onClick={() => setShowEditHistory((v) => !v)}
            className="section-title hover:text-[hsl(var(--secondary))] transition-colors cursor-pointer"
          >
            <FileText className="section-title-icon" /> Edit History
            <ChevronDown className={`h-4 w-4 transition-transform ${showEditHistory ? "rotate-180" : ""}`} />
            <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">
              ({editHistory.length} change{editHistory.length !== 1 ? "s" : ""})
            </span>
          </button>
          {showEditHistory && (
            <div className="list-container max-h-64 overflow-y-auto">
              {editHistory.map((edit) => (
                <div key={edit.id} className="px-4 py-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[hsl(var(--foreground))] capitalize">
                      {edit.field === "content" ? "Content" : edit.field}
                    </span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      {edit.createdAt && new Date(edit.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {edit.field !== "content" && (
                    <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      <span className="line-through text-[hsl(var(--destructive))]">
                        {edit.oldValue || "(empty)"}
                      </span>
                      {" → "}
                      <span className="text-[hsl(var(--secondary))]">
                        {edit.newValue || "(empty)"}
                      </span>
                    </div>
                  )}
                  {edit.field === "content" && (
                    <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      Content updated
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sticky Notes */}
      <div className="space-y-2 print-hidden">
        <div className="flex items-center justify-between">
          <h3 className="section-title">
            <StickyNoteIcon className="section-title-icon" /> Notes
            {stickyNotes.length > 0 && (
              <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">
                ({stickyNotes.length})
              </span>
            )}
          </h3>
          {canEdit && (
            <button
              onClick={() => {
                setEditingNote(null);
                setNoteContent("");
                setNoteColor("yellow");
                setShowNoteForm(true);
              }}
              className="btn-outline btn-sm border-dashed"
            >
              <Plus className="h-3 w-3" /> Add Note
            </button>
          )}
        </div>
        {stickyNotes.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stickyNotes.map((note) => {
              const colorMap: Record<string, string> = {
                yellow: "bg-yellow-100 border-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-700",
                blue: "bg-blue-100 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700",
                green: "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700",
                pink: "bg-pink-100 border-pink-300 dark:bg-pink-900/30 dark:border-pink-700",
                purple: "bg-purple-100 border-purple-300 dark:bg-purple-900/30 dark:border-purple-700",
              };
              return (
                <div
                  key={note.id}
                  className={`group relative rounded-lg border p-3 ${colorMap[note.color] || colorMap.yellow}`}
                  data-testid="sticky-note"
                >
                  <p className="whitespace-pre-wrap text-sm text-[hsl(var(--foreground))]">
                    {note.content}
                  </p>
                  {note.createdAt && (
                    <p className="mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">
                      {new Date(note.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  )}
                  {canEdit && (
                    <div className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center gap-0.5">
                      <button
                        onClick={() => openEditNote(note)}
                        className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-black/10 transition-colors"
                        title="Edit note"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] hover:bg-black/10 transition-colors"
                        title="Delete note"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {stickyNotes.length === 0 && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            No notes yet. Add a personal note for this song.
          </p>
        )}
      </div>

      <SongCollaborationPanel
        songId={song.id}
        sourceContent={displayContent}
        canEdit={canEdit}
      />

      {/* Quick Add to Setlist */}
      {showSetlistPicker && (
        <div className="modal-backdrop print-hidden">
          <div className="modal-content max-w-md">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-brand text-[hsl(var(--foreground))]">Add to Setlist</h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {activeVariation
                    ? `This will add the ${activeVariation.name} variation with its key to the chosen setlist.`
                    : "This will add the original song to the chosen setlist."}
                </p>
              </div>
              <button
                onClick={() => setShowSetlistPicker(false)}
                className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-sm">
              <div className="font-medium text-[hsl(var(--foreground))]">{song.title}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                {activeVariation
                  ? `Variation: ${activeVariation.name}${displayKey ? ` · Key: ${displayKey}` : ""}`
                  : displayKey
                    ? `Original song · Key: ${displayKey}`
                    : "Original song"}
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-[hsl(var(--border))] rounded-md border border-[hsl(var(--border))]">
              {loadingSetlists ? (
                <div className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">Loading setlists…</div>
              ) : availableSetlists.length === 0 ? (
                <div className="space-y-2 px-4 py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  <p>No setlists yet.</p>
                  <Link
                    to="/setlists/new"
                    onClick={() => setShowSetlistPicker(false)}
                    className="text-[hsl(var(--secondary))] hover:underline"
                  >
                    Create a setlist
                  </Link>
                </div>
              ) : (
                availableSetlists.map((setlist) => (
                  <button
                    key={setlist.id}
                    onClick={() => handleAddToSetlist(setlist.id)}
                    disabled={addingToSetlistId === setlist.id}
                    className="w-full px-4 py-3 text-left hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-60"
                  >
                    <div className="font-medium text-sm text-[hsl(var(--foreground))]">{setlist.name}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {[setlist.category, setlist.songCount !== undefined ? `${setlist.songCount} song${setlist.songCount === 1 ? "" : "s"}` : null]
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

      {/* Sticky Note Form Modal */}
      {showNoteForm && (
        <div className="modal-backdrop print-hidden">
          <div className="modal-content max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-brand text-[hsl(var(--foreground))]">
                {editingNote ? "Edit Note" : "New Note"}
              </h3>
              <button
                onClick={() => { setShowNoteForm(false); setEditingNote(null); }}
                className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                  Note
                </label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={4}
                  placeholder="Add your note..."
                  className="input"
                  data-testid="note-content-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                  Color
                </label>
                <div className="flex gap-2">
                  {["yellow", "blue", "green", "pink", "purple"].map((c) => {
                    const dotColors: Record<string, string> = {
                      yellow: "bg-yellow-400",
                      blue: "bg-blue-400",
                      green: "bg-green-400",
                      pink: "bg-pink-400",
                      purple: "bg-purple-400",
                    };
                    return (
                      <button
                        key={c}
                        onClick={() => setNoteColor(c)}
                        className={`h-7 w-7 rounded-full ${dotColors[c]} transition-all ${
                          noteColor === c
                            ? "ring-2 ring-offset-2 ring-[hsl(var(--secondary))] ring-offset-[hsl(var(--card))]"
                            : "hover:scale-110"
                        }`}
                        title={c}
                        data-testid={`note-color-${c}`}
                      />
                    );
                  })}
                </div>
              </div>
              <button
                onClick={handleSaveNote}
                disabled={savingNote || !noteContent.trim()}
                className="btn-primary w-full"
              >
                {savingNote ? "Saving..." : editingNote ? "Update Note" : "Add Note"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Usage Modal */}
      {showUsageForm && (
        <div className="modal-backdrop print-hidden">
          <div className="modal-content max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-brand text-[hsl(var(--foreground))]">Log Song Usage</h3>
              <button
                onClick={() => setShowUsageForm(false)}
                className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                  Date Used
                </label>
                <input
                  type="date"
                  value={usageDate}
                  onChange={(e) => setUsageDate(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                  Notes <span className="text-xs text-[hsl(var(--muted-foreground))]">(optional)</span>
                </label>
                <input
                  type="text"
                  value={usageNotes}
                  onChange={(e) => setUsageNotes(e.target.value)}
                  placeholder="e.g. Sunday morning service"
                  className="input"
                />
              </div>
              <button
                onClick={handleLogUsage}
                disabled={loggingUsage || !usageDate}
                className="btn-primary w-full"
              >
                {loggingUsage ? "Logging..." : "Log Usage"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Share Management Dialog */}
      {id && (
        <ShareManageDialog
          songId={id}
          open={showShareManage}
          onClose={() => setShowShareManage(false)}
        />
      )}

      {/* Variation Create/Edit Modal */}
      {showVariationForm && (
        <div className="modal-backdrop print-hidden">
          <div className="modal-content max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-brand text-[hsl(var(--foreground))]">
                {editingVariation ? "Edit Variation" : "New Variation"}
              </h3>
              <button
                onClick={() => setShowVariationForm(false)}
                className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-[hsl(var(--foreground))]">
                    Variation Name *
                  </label>
                  <input
                    type="text"
                    value={varName}
                    onChange={(e) => setVarName(e.target.value)}
                    placeholder="e.g. Acoustic, My version"
                    className="input"
                    data-testid="variation-name-input"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-[hsl(var(--foreground))]">
                    Key
                  </label>
                  <select
                    value={varKey}
                    onChange={(e) => setVarKey(e.target.value)}
                    className="select"
                    data-testid="variation-key-select"
                  >
                    <option value="">Same as original</option>
                    {ALL_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-[hsl(var(--foreground))]">
                  Content (ChordPro) *
                </label>
                <textarea
                  value={varContent}
                  onChange={(e) => setVarContent(e.target.value)}
                  rows={12}
                  className="input font-mono"
                  data-testid="variation-content-textarea"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveVariation}
                  disabled={savingVariation || !varName.trim() || !varContent.trim()}
                  className="btn-primary"
                  data-testid="variation-save-btn"
                >
                  {savingVariation
                    ? "Saving..."
                    : editingVariation
                      ? "Update Variation"
                      : "Create Variation"}
                </button>
                <button
                  onClick={() => setShowVariationForm(false)}
                  className="btn-outline"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title ?? "Confirm action"}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        busy={confirmingAction}
        onClose={() => {
          if (!confirmingAction) {
            setConfirmState(null);
          }
        }}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}
