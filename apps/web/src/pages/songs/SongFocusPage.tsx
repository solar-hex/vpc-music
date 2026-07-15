import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { songsApi, type Song, type SongVariation } from "@/lib/api-client";
import { ChordProRenderer, AutoScroll, type ChordProRendererHandle } from "@/components/songs/ChordProRenderer";
import { ChordDiagramSheet } from "@/components/songs/ChordDiagramSheet";
import { isOfflineRequestError, loadCachedSong } from "@/lib/offline-cache";
import { ALL_KEYS, composeTranspose, normalizeEnharmonicKey, parseChordPro } from "@vpc-music/shared";
import { toast } from "sonner";
import { X, Minus, Plus, Eye, EyeOff, Hash } from "lucide-react";

/**
 * Distraction-free, full-bleed reader for a single song (story 3).
 * Rendered OUTSIDE the AppShell — no sidebar, no chrome — so a chart fills the
 * screen on a phone or tablet on a music stand. Exit returns to the song page.
 */
export function SongFocusPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [song, setSong] = useState<Song | null>(null);
  const [variations, setVariations] = useState<SongVariation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChords, setShowChords] = useState(true);
  const [nashville, setNashville] = useState(false);
  const [fontSize, setFontSize] = useState(20); // larger default for stage legibility
  const [tappedChord, setTappedChord] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chordProRef = useRef<ChordProRendererHandle>(null);

  const exit = () => {
    if (id) navigate(`/songs/${id}`);
    else navigate("/songs");
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    songsApi
      .get(id)
      .then((res) => {
        setSong(res.song);
        setVariations(res.variations || []);
      })
      .catch((error) => {
        const cached = loadCachedSong(id);
        if (cached && isOfflineRequestError(error)) {
          setSong(cached.response.song);
          setVariations(cached.response.variations || []);
          return;
        }
        toast.error("Song not found");
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Esc / Backspace exits; arrows nudge transpose (foot-pedal + keyboard friendly).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        exit();
      } else if (e.key === "ArrowUp") {
        chordProRef.current?.transposeUp();
      } else if (e.key === "ArrowDown") {
        chordProRef.current?.transposeDown();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Wake lock: a chart that sleeps mid-song is worse than no chart.
  useEffect(() => {
    let wakeLock: any = null;
    const acquire = async () => {
      try {
        const wakeLockApi = (navigator as any).wakeLock;
        if (!wakeLockApi || document.visibilityState !== "visible") return;
        wakeLock = await wakeLockApi.request("screen");
      } catch {
        // Not supported or denied — nothing else to do
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      wakeLock?.release?.().catch?.(() => {});
    };
  }, []);

  const requestedVariationId = searchParams.get("variation");
  const activeVariation =
    requestedVariationId && requestedVariationId !== "original"
      ? variations.find((v) => v.id === requestedVariationId) ?? null
      : null;

  const displayContent = activeVariation ? activeVariation.content : song?.content ?? "";
  // Custom {define:} chord shapes from the chart, for tap-a-chord diagrams
  const chordDefinitions = useMemo(() => parseChordPro(displayContent).chordDefinitions, [displayContent]);
  const originalKey = activeVariation?.key ?? song?.key;
  const requestedSearchKey = normalizeEnharmonicKey(searchParams.get("key"));
  const displayKey = requestedSearchKey && ALL_KEYS.includes(requestedSearchKey) ? requestedSearchKey : originalKey;
  const baseTranspose = composeTranspose({ sourceKey: originalKey, overrideKey: displayKey }).semis;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--background))]">
        <div className="spinner" />
      </div>
    );
  }

  if (!song) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[hsl(var(--background))]">
        <p className="text-[hsl(var(--muted-foreground))]">Song not found.</p>
        <button onClick={() => navigate("/songs")} className="btn-primary">
          Back to songs
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      {/* Slim, touch-friendly control bar */}
      <div className="flex items-center gap-1 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 px-2 py-2 backdrop-blur sm:gap-2 sm:px-4">
        <button
          onClick={exit}
          className="btn-icon btn-ghost h-11 w-11"
          title="Exit full screen (Esc)"
          aria-label="Exit full screen"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium sm:text-base">
            {song.title}
            {activeVariation && (
              <span className="ml-1 font-normal text-[hsl(var(--secondary))]">— {activeVariation.name}</span>
            )}
          </div>
          <div className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">
            {[displayKey && `Key ${displayKey}`, song.tempo && `${song.tempo} BPM`].filter(Boolean).join(" · ")}
          </div>
        </div>

        {/* Transpose */}
        <button
          onClick={() => chordProRef.current?.transposeDown()}
          className="btn-icon btn-ghost h-11 w-11"
          title="Transpose down"
          aria-label="Transpose down"
        >
          <Minus className="h-5 w-5" />
        </button>
        <button
          onClick={() => chordProRef.current?.transposeUp()}
          className="btn-icon btn-ghost h-11 w-11"
          title="Transpose up"
          aria-label="Transpose up"
        >
          <Plus className="h-5 w-5" />
        </button>

        {/* Font size */}
        <button
          onClick={() => setFontSize((s) => Math.max(12, s - 2))}
          className="btn-icon btn-ghost hidden h-11 w-11 sm:inline-flex"
          title="Smaller text"
          aria-label="Smaller text"
        >
          <span className="text-xs font-bold">A−</span>
        </button>
        <button
          onClick={() => setFontSize((s) => Math.min(40, s + 2))}
          className="btn-icon btn-ghost hidden h-11 w-11 sm:inline-flex"
          title="Larger text"
          aria-label="Larger text"
        >
          <span className="text-base font-bold">A+</span>
        </button>

        <button
          onClick={() => setShowChords((v) => !v)}
          className="btn-icon btn-ghost h-11 w-11"
          title={showChords ? "Hide chords" : "Show chords"}
          aria-label={showChords ? "Hide chords" : "Show chords"}
        >
          {showChords ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
        {showChords && displayKey && (
          <button
            onClick={() => setNashville((v) => !v)}
            className={`btn-icon h-11 w-11 ${nashville ? "btn-primary" : "btn-ghost"}`}
            title={nashville ? "Show chord names" : "Show Nashville numbers"}
            aria-label="Toggle Nashville numbers"
          >
            <Hash className="h-5 w-5" />
          </button>
        )}
        <div className="hidden sm:block">
          <AutoScroll containerRef={scrollRef} />
        </div>
      </div>

      {/* The chart fills all remaining space */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <ChordProRenderer
          ref={chordProRef}
          content={displayContent}
          songKey={originalKey}
          baseTranspose={baseTranspose}
          showChords={showChords}
          nashville={nashville}
          fontSize={fontSize}
          onChordTap={setTappedChord}
        />
      </div>

      {/* Tap-a-chord fingering diagram */}
      <ChordDiagramSheet
        chord={tappedChord}
        definitions={chordDefinitions}
        onClose={() => setTappedChord(null)}
      />
    </div>
  );
}
