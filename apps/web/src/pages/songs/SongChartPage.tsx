import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CalendarPlus, Download, Edit, Printer, Share2, Trash2 } from "lucide-react";
import { songsApi, shareApi, songUsageApi, type Song, type SongVariation } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useWakeLock } from "@/hooks/useWakeLock";
import { nextFontSize, useChartPrefs } from "@/lib/chart-prefs";
import { isOfflineRequestError, loadCachedSong, saveCachedSong } from "@/lib/offline-cache";
import { ChordProRenderer, chartSections } from "@/components/songs/ChordProRenderer";
import { ChartToolbar } from "@/components/songs/ChartToolbar";
import { SectionJumpBar, jumpToSection } from "@/components/songs/SectionJumpBar";
import { KeyPickerSheet } from "@/components/songs/KeyPickerSheet";
import { LogPlayDialog } from "@/components/songs/LogPlayDialog";
import { ChordDiagramSheet } from "@/components/songs/ChordDiagramSheet";
import { TempoIndicator } from "@/components/songs/TempoIndicator";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import type { ActionMenuEntry } from "@/components/ui/ActionMenu";
import { ALL_KEYS, composeTranspose, normalizeEnharmonicKey, parseChordPro, parseKeyRoot, spellForTarget } from "@vpc-music/shared";

/** "Bb", "C#m" -> the canonical spelling, or null when it is not a key we can transpose to. */
function validKey(value: string | null): string | null {
  if (!value) return null;
  const parsed = parseKeyRoot(value);
  if (!parsed) return null;
  const root = normalizeEnharmonicKey(parsed.root);
  if (!ALL_KEYS.includes(root)) return null;
  return parsed.isMinor ? `${root}m` : root;
}

/**
 * The lead sheet: a chart that fills the screen, the old site's toolbar on
 * top and its section jump bar underneath. Rendered outside the app shell.
 * Transposition lives in the URL (`?key=Bb`, or `?t=2` for keyless charts)
 * so a link or a reload lands on the same key.
 */
export function SongChartPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, activeOrg } = useAuth();
  const { resolvedTheme, toggleTheme, keyNotation } = useTheme();
  const [prefs, updatePrefs] = useChartPrefs();
  const { supported: keepAwakeSupported } = useWakeLock(prefs.keepAwake);

  const [song, setSong] = useState<Song | null>(null);
  const [variations, setVariations] = useState<SongVariation[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyPickerOpen, setKeyPickerOpen] = useState(false);
  const [logPlayOpen, setLogPlayOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tappedChord, setTappedChord] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Transposition: the URL is the single source of truth.
  const overrideKey = originalKey ? validKey(searchParams.get("key")) : null;
  const nudge = originalKey ? 0 : Number.parseInt(searchParams.get("t") || "0", 10) || 0;
  const { semis, displayKey } = composeTranspose({ sourceKey: originalKey, overrideKey, nudge });

  const setKeyParam = (key: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (key && originalKey && normalizeEnharmonicKey(key) !== normalizeEnharmonicKey(originalKey)) {
      next.set("key", key);
    } else {
      next.delete("key");
    }
    setSearchParams(next, { replace: true });
  };

  const shift = (delta: number) => {
    if (originalKey) {
      setKeyParam(spellForTarget(originalKey, semis + delta).targetKey);
      return;
    }
    const next = new URLSearchParams(searchParams);
    const value = (((semis + delta) % 12) + 12) % 12;
    if (value === 0) next.delete("t");
    else next.set("t", String(value));
    setSearchParams(next, { replace: true });
  };

  const modalOpen = keyPickerOpen || logPlayOpen || confirmDelete || tappedChord !== null;
  useKeyboardShortcuts({
    scrollRef,
    onTransposeUp: () => shift(1),
    onTransposeDown: () => shift(-1),
    enabled: !modalOpen,
  });

  const sections = useMemo(() => chartSections(content), [content]);
  const chordDefinitions = useMemo(() => parseChordPro(content).chordDefinitions, [content]);

  // The old site carried the current key back to the search page.
  const searchHref = semis !== 0 && displayKey ? `/songs?key=${encodeURIComponent(displayKey)}` : "/songs";

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

  const handleShare = async () => {
    if (!id) return;
    try {
      const { shareUrl } = await shareApi.create(id);
      const absolute = shareUrl.startsWith("http") ? shareUrl : `${window.location.origin}${shareUrl}`;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absolute);
        toast.success("Share link copied to clipboard");
      } else {
        toast.success(`Share link: ${absolute}`);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to create a share link");
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

  const menuItems: ActionMenuEntry[] = [
    { label: "Print", icon: <Printer />, onSelect: () => window.print() },
    { label: "Download ChordPro (.cho)", icon: <Download />, onSelect: () => download(() => songsApi.exportChordPro(id!, defaultVariation?.id), "cho") },
    { label: "Download OnSong (.onsong)", icon: <Download />, onSelect: () => download(() => songsApi.exportOnSong(id!, defaultVariation?.id), "onsong") },
    { label: "Download text (.txt)", icon: <Download />, onSelect: () => download(() => songsApi.exportText(id!, defaultVariation?.id), "txt") },
    { label: "Download PDF", icon: <Download />, onSelect: () => window.open(songsApi.exportPdf(id!, defaultVariation?.id), "_blank") },
    ...(canEdit
      ? ([
          "separator",
          { label: "Copy share link", icon: <Share2 />, onSelect: () => void handleShare() },
          { label: "Log a play", icon: <CalendarPlus />, onSelect: () => setLogPlayOpen(true) },
          "separator",
          { label: "Edit", icon: <Edit />, onSelect: () => navigate(`/songs/${id}/edit`) },
          { label: "Delete", icon: <Trash2 />, onSelect: () => setConfirmDelete(true), destructive: true },
        ] satisfies ActionMenuEntry[])
      : []),
  ];

  if (loading) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-[hsl(var(--background))]">
        <div className="spinner" />
      </div>
    );
  }

  if (!song) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
        <p className="text-[hsl(var(--muted-foreground))]">Song not found.</p>
        <button type="button" onClick={() => navigate("/songs")} className="btn-primary">
          Back to songs
        </button>
      </div>
    );
  }

  return (
    <div className="chart-page fixed inset-0 z-40 flex flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <ChartToolbar
        searchHref={searchHref}
        displayKey={displayKey}
        onOpenKeyPicker={() => setKeyPickerOpen(true)}
        onTransposeUp={() => shift(1)}
        onTransposeDown={() => shift(-1)}
        nashville={prefs.nashville && Boolean(originalKey)}
        nashvilleDisabled={!originalKey}
        onToggleNashville={() => updatePrefs({ nashville: !prefs.nashville })}
        showComments={prefs.showComments}
        onToggleComments={() => updatePrefs({ showComments: !prefs.showComments })}
        fontSize={prefs.fontSize}
        onCycleFontSize={() => updatePrefs({ fontSize: nextFontSize(prefs.fontSize) })}
        keepAwake={prefs.keepAwake}
        keepAwakeSupported={keepAwakeSupported}
        onToggleKeepAwake={() => updatePrefs({ keepAwake: !prefs.keepAwake })}
        resolvedTheme={resolvedTheme}
        onToggleTheme={toggleTheme}
        menuItems={menuItems}
      />
      <OfflineBanner />

      <div ref={scrollRef} className="chart-scroll flex-1 overflow-auto">
        <div className="chart-sheet mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <div className="print-meta mb-4 space-y-1">
            {displayKey && (
              <div className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Key of {displayKey}
                {semis !== 0 && originalKey ? <span className="normal-case tracking-normal"> (originally {originalKey})</span> : null}
              </div>
            )}
            <h1 className="page-title">{song.title}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[hsl(var(--muted-foreground))]">
              {(song.artist || song.year) && <span>{[song.artist, song.year].filter(Boolean).join(" / ")}</span>}
              {song.tempo ? <TempoIndicator tempo={song.tempo} /> : null}
              {song.isDraft && <span className="badge-muted">Draft</span>}
            </div>
          </div>

          <div className="print-sheet">
            <ChordProRenderer
              content={content}
              songKey={originalKey}
              transpose={semis}
              nashville={prefs.nashville && Boolean(originalKey)}
              fontSize={prefs.fontSize}
              showComments={prefs.showComments}
              wrap={false}
              onChordTap={setTappedChord}
            />
          </div>
        </div>
      </div>

      <SectionJumpBar sections={sections} onJump={(sectionId) => jumpToSection(scrollRef.current, sectionId)} />

      <KeyPickerSheet
        open={keyPickerOpen}
        onClose={() => setKeyPickerOpen(false)}
        currentKey={displayKey}
        originalKey={originalKey}
        notation={keyNotation}
        onPick={(key) => setKeyParam(key)}
      />
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
      <ChordDiagramSheet chord={tappedChord} definitions={chordDefinitions} onClose={() => setTappedChord(null)} />
    </div>
  );
}
