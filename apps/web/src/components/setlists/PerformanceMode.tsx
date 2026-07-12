import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Timer,
  Pause,
  Play,
  Eye,
  EyeOff,
  ArrowUpDown,
  Maximize2,
  Minimize2,
  Music,
  SkipForward,
  Sun,
} from "lucide-react";
import { ChordProRenderer, AutoScroll } from "@/components/songs/ChordProRenderer";
import { TempoIndicator } from "@/components/songs/TempoIndicator";
import type { SetlistSongItem } from "@/lib/api-client";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { formatDuration } from "@/lib/format";
import { interval, transposeKeyName, keyPrefersFlats } from "@vpc-music/shared";

// ── Types ────────────────────────────────────────
interface SongContent {
  songId: string;
  content: string;
  /** Effective key (set list override wins) */
  key?: string | null;
  /** The key the chart source is written in */
  originalKey?: string | null;
  tempo?: number | null;
  durationSeconds?: number | null;
}

const FONT_SIZE_KEY = "perform-font-size";
const MIN_FONT_SIZE = 18;

function loadFontSize(): number {
  try {
    const stored = Number(localStorage.getItem(FONT_SIZE_KEY));
    if (Number.isFinite(stored) && stored >= MIN_FONT_SIZE && stored <= 40) return stored;
  } catch {
    // localStorage unavailable
  }
  return 20;
}

export interface PerformanceModeProps {
  songs: SetlistSongItem[];
  /** Map of songId → content/key/tempo for each song in the setlist */
  songContents: Map<string, SongContent>;
  setlistName: string;
  initialSongIndex?: number;
  onExit: () => void;
  /** If conductor mode, broadcast current song index */
  onSongChange?: (index: number) => void;
}

// ── Component ────────────────────────────────────
export function PerformanceMode({
  songs,
  songContents,
  setlistName,
  initialSongIndex = 0,
  onExit,
  onSongChange,
}: PerformanceModeProps) {
  // ── State ──────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(initialSongIndex);
  const [showChords, setShowChords] = useState(true);
  const [fontSize, setFontSizeState] = useState(loadFontSize);
  const [showToolbar, setShowToolbar] = useState(true);
  const [brightness, setBrightness] = useState(100); // percent, 40–100
  // Live transpose: extra semitones per song index, on top of any key override
  const [liveTranspose, setLiveTranspose] = useState<Record<number, number>>({});
  const [setStartedAt] = useState(() => Date.now());
  const [elapsedLabel, setElapsedLabel] = useState("0:00");

  const setFontSize = (updater: (size: number) => number) => {
    setFontSizeState((prev) => {
      const next = Math.max(MIN_FONT_SIZE, Math.min(40, updater(prev)));
      try {
        localStorage.setItem(FONT_SIZE_KEY, String(next));
      } catch {
        // persistence is best-effort
      }
      return next;
    });
  };

  // Timer state
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerDuration, setTimerDuration] = useState(240); // 4 min default
  const [timerRunning, setTimerRunning] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);

  const currentSong = songs[currentIndex];
  const content = currentSong?.songId
    ? songContents.get(currentSong.songId)
    : undefined;

  // ── Key math: override + live transpose, spelled for the target key ──
  const overrideSteps =
    content?.originalKey && content.key && content.key !== content.originalKey
      ? interval(content.originalKey, content.key)
      : 0;
  const manualSteps = liveTranspose[currentIndex] ?? 0;
  const totalSteps = ((overrideSteps + manualSteps) % 12 + 12) % 12;
  const sourceKey = content?.originalKey ?? content?.key ?? null;
  const displayKey = sourceKey
    ? transposeKeyName(sourceKey, totalSteps, keyPrefersFlats(transposeKeyName(sourceKey, totalSteps, true)))
    : null;

  const nudgeTranspose = (delta: number) => {
    setLiveTranspose((prev) => ({ ...prev, [currentIndex]: (prev[currentIndex] ?? 0) + delta }));
  };

  // ── Wake lock: a chart that sleeps mid-song is worse than no chart ──
  useEffect(() => {
    let wakeLock: any = null;
    let released = false;

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
      if (document.visibilityState === "visible" && !released) void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      wakeLock?.release?.().catch?.(() => {});
    };
  }, []);

  // ── Elapsed set time ─────────────────────────────
  useEffect(() => {
    const tick = () => {
      const seconds = Math.floor((Date.now() - setStartedAt) / 1000);
      setElapsedLabel(formatDuration(seconds));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [setStartedAt]);

  // ── Navigation ─────────────────────────────────
  const goToSong = useCallback(
    (index: number) => {
      if (index < 0 || index >= songs.length) return;
      setCurrentIndex(index);
      onSongChange?.(index);
      // Reset timer for new song
      setTimerSeconds(0);
      setTimerRunning(false);
      // Scroll to top
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    },
    [songs.length, onSongChange]
  );

  const goNext = useCallback(() => goToSong(currentIndex + 1), [currentIndex, goToSong]);
  const goPrev = useCallback(() => goToSong(currentIndex - 1), [currentIndex, goToSong]);

  // ── Timer tick ─────────────────────────────────
  useEffect(() => {
    if (!timerEnabled || !timerRunning) return;
    const interval = setInterval(() => {
      setTimerSeconds((s) => {
        if (s + 1 >= timerDuration) {
          setTimerRunning(false);
          return timerDuration;
        }
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerEnabled, timerRunning, timerDuration]);

  // ── Auto-start timer on song change ────────────
  useEffect(() => {
    if (timerEnabled) {
      setTimerSeconds(0);
      setTimerRunning(true);
    }
  }, [currentIndex, timerEnabled]);

  // ── Keyboard shortcuts ─────────────────────────
  // PageDown/Space/ArrowDown scroll the chord sheet
  // ArrowLeft/ArrowRight navigate songs (overriding transpose for perf mode)
  useKeyboardShortcuts({
    scrollRef,
    onTransposeUp: goNext,
    onTransposeDown: goPrev,
    onEscape: onExit,
    enabled: true,
  });

  // Additional keyboard handling for performance-specific keys
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        goNext();
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        setShowChords((v) => !v);
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        setShowToolbar((v) => !v);
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setFontSize((s) => Math.min(s + 2, 36));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setFontSize((s) => Math.max(s - 2, 12));
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev]);

  // ── Timer progress ─────────────────────────────
  const timerPct = timerDuration > 0 ? (timerSeconds / timerDuration) * 100 : 0;
  const timerRemaining = timerDuration - timerSeconds;
  const isTimerWarning = timerEnabled && timerRemaining <= 30 && timerRemaining > 0;
  const isTimerExpired = timerEnabled && timerRemaining <= 0;

  return (
    <div
      data-testid="performance-mode"
      className="fixed inset-0 z-50 flex flex-col bg-[hsl(var(--background))]"
    >
      {/* ── Top bar ─────────────────────────────── */}
      {showToolbar && (
        <div
          data-testid="perf-toolbar"
          className="flex items-center gap-2 px-4 py-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 backdrop-blur-sm shrink-0"
        >
          {/* Setlist name + song position */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Music className="h-4 w-4 text-[hsl(var(--secondary))] shrink-0" />
            <span className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
              {setlistName}
            </span>
            <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
              {currentIndex + 1} / {songs.length}
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Chord toggle */}
            <button
              data-testid="perf-toggle-chords"
              onClick={() => setShowChords((v) => !v)}
              className={`p-1.5 rounded transition-colors ${
                showChords
                  ? "text-[hsl(var(--secondary))]"
                  : "text-[hsl(var(--muted-foreground))]"
              } hover:bg-[hsl(var(--muted))]`}
              title={showChords ? "Hide chords (C)" : "Show chords (C)"}
            >
              {showChords ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>

            {/* Font size */}
            <button
              onClick={() => setFontSize((s) => Math.max(s - 2, 12))}
              className="p-1.5 rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] text-xs font-mono"
              title="Decrease font size (-)"
            >
              A−
            </button>
            <span className="text-xs text-[hsl(var(--muted-foreground))] min-w-[3ch] text-center font-mono">
              {fontSize}
            </span>
            <button
              onClick={() => setFontSize((s) => Math.min(s + 2, 36))}
              className="p-1.5 rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] text-xs font-mono"
              title="Increase font size (+)"
            >
              A+
            </button>

            {/* Stage brightness */}
            <div className="flex items-center gap-1" title="Stage brightness">
              <Sun className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              <input
                data-testid="perf-brightness"
                type="range"
                min={40}
                max={100}
                step={5}
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-16 accent-[hsl(var(--secondary))]"
                aria-label="Stage brightness"
              />
            </div>

            {/* Timer toggle */}
            <button
              data-testid="perf-timer-toggle"
              onClick={() => {
                setTimerEnabled((v) => {
                  if (!v) {
                    setTimerSeconds(0);
                    setTimerRunning(true);
                  } else {
                    setTimerRunning(false);
                  }
                  return !v;
                });
              }}
              className={`p-1.5 rounded transition-colors ${
                timerEnabled
                  ? "text-[hsl(var(--secondary))]"
                  : "text-[hsl(var(--muted-foreground))]"
              } hover:bg-[hsl(var(--muted))]`}
              title="Toggle countdown timer"
            >
              <Timer className="h-4 w-4" />
            </button>

            {/* Timer duration picker (only visible when timer enabled) */}
            {timerEnabled && (
              <select
                data-testid="perf-timer-duration"
                value={timerDuration}
                onChange={(e) => {
                  setTimerDuration(Number(e.target.value));
                  setTimerSeconds(0);
                }}
                className="text-xs bg-transparent border border-[hsl(var(--border))] rounded px-1 py-0.5 text-[hsl(var(--foreground))]"
              >
                <option value={120}>2 min</option>
                <option value={180}>3 min</option>
                <option value={240}>4 min</option>
                <option value={300}>5 min</option>
                <option value={360}>6 min</option>
                <option value={420}>7 min</option>
                <option value={480}>8 min</option>
                <option value={600}>10 min</option>
              </select>
            )}

            {/* Toolbar toggle */}
            <button
              onClick={() => setShowToolbar(false)}
              className="p-1.5 rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
              title="Hide toolbar (T)"
            >
              <Minimize2 className="h-4 w-4" />
            </button>

            {/* Exit */}
            <button
              data-testid="perf-exit"
              onClick={onExit}
              className="p-1.5 rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] hover:bg-[hsl(var(--muted))]"
              title="Exit performance mode (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Hidden toolbar restore button */}
      {!showToolbar && (
        <button
          onClick={() => setShowToolbar(true)}
          className="absolute top-2 right-2 z-10 p-1.5 rounded bg-[hsl(var(--muted))]/80 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
          title="Show toolbar (T)"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      )}

      {/* ── Timer bar ───────────────────────────── */}
      {timerEnabled && (
        <div className="shrink-0">
          <div className="h-1 bg-[hsl(var(--muted))]">
            <div
              data-testid="perf-timer-bar"
              className={`h-full transition-all duration-1000 ease-linear ${
                isTimerExpired
                  ? "bg-[hsl(var(--destructive))]"
                  : isTimerWarning
                    ? "bg-amber-500"
                    : "bg-[hsl(var(--secondary))]"
              }`}
              style={{ width: `${Math.min(timerPct, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-center gap-2 py-1 text-xs">
            <button
              onClick={() => setTimerRunning((r) => !r)}
              className="p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            >
              {timerRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </button>
            <span
              data-testid="perf-timer-display"
              className={`font-mono ${
                isTimerExpired
                  ? "text-[hsl(var(--destructive))] font-bold"
                  : isTimerWarning
                    ? "text-amber-500 font-medium"
                    : "text-[hsl(var(--muted-foreground))]"
              }`}
            >
              {isTimerExpired ? "0:00" : formatDuration(timerRemaining)}
            </span>
          </div>
        </div>
      )}

      {/* ── Song content ────────────────────────── */}
      <div className="flex-1 flex items-stretch overflow-hidden">
        {/* Previous button */}
        <button
          data-testid="perf-prev"
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="shrink-0 w-12 flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-20 disabled:cursor-default"
          title="Previous song (← or P)"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        {/* Main chord sheet area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Song title bar — title · key (live transpose) · BPM · position · elapsed */}
          <div className="px-4 py-2 border-b border-[hsl(var(--border))] shrink-0">
            <h2 className="text-lg font-brand text-[hsl(var(--foreground))] truncate">
              {currentSong?.songTitle || "—"}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
              {displayKey && (
                <span className="inline-flex items-center gap-1">
                  <button
                    data-testid="perf-transpose-down"
                    onClick={() => nudgeTranspose(-1)}
                    className="h-6 w-6 rounded border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                    aria-label="Transpose down"
                  >
                    −
                  </button>
                  <span className="badge-key min-w-[2.5ch] text-center" data-testid="perf-current-key">
                    {displayKey}
                  </span>
                  <button
                    data-testid="perf-transpose-up"
                    onClick={() => nudgeTranspose(1)}
                    className="h-6 w-6 rounded border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                    aria-label="Transpose up"
                  >
                    +
                  </button>
                  {manualSteps !== 0 && (
                    <button
                      onClick={() => setLiveTranspose((prev) => ({ ...prev, [currentIndex]: 0 }))}
                      className="text-[hsl(var(--secondary))] hover:underline"
                    >
                      reset
                    </button>
                  )}
                </span>
              )}
              {(content?.tempo || currentSong?.songTempo) && (
                <span className="inline-flex items-center gap-1.5">
                  {/* Visual pulse locked to the song's BPM */}
                  <span
                    className="inline-block h-2 w-2 rounded-full bg-[hsl(var(--secondary))]"
                    style={{ animation: `perf-pulse ${60 / (content?.tempo || currentSong?.songTempo || 60)}s ease-in-out infinite` }}
                    aria-hidden="true"
                  />
                  <TempoIndicator tempo={(content?.tempo ?? currentSong?.songTempo)!} />
                </span>
              )}
              <span className="tabular-nums">{currentIndex + 1} of {songs.length}</span>
              <span className="tabular-nums" title="Elapsed set time">⏱ {elapsedLabel}</span>
              {currentSong?.songArtist && (
                <span>{currentSong.songArtist}</span>
              )}
              {currentSong?.variationName && (
                <span className="badge-muted">{currentSong.variationName}</span>
              )}
              {currentSong?.capo ? (
                <span className="badge-muted">Capo {currentSong.capo}</span>
              ) : null}
              {currentSong?.arrangement && (
                <span className="badge-muted capitalize">{currentSong.arrangement.replace("_", " ").toLowerCase()}</span>
              )}
            </div>
            <style>{`@keyframes perf-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(0.7); } }`}</style>
          </div>

          {/* Scrollable chord sheet */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-6 py-4"
            style={brightness < 100 ? { filter: `brightness(${brightness}%)` } : undefined}
          >
            {content ? (
              <ChordProRenderer
                ref={rendererRef}
                content={content.content}
                songKey={sourceKey}
                baseTranspose={totalSteps}
                showChords={showChords}
                showControls={false}
                fontSize={fontSize}
              />
            ) : (
              <div className="text-center text-[hsl(var(--muted-foreground))] py-12">
                No content available for this song.
              </div>
            )}
          </div>

          {/* Auto-scroll controls — default speed derived from song duration/BPM */}
          <div className="px-4 py-2 border-t border-[hsl(var(--border))] shrink-0 flex items-center gap-4">
            <AutoScroll
              key={currentIndex}
              containerRef={scrollRef}
              defaultSpeed={
                content?.durationSeconds
                  ? Math.max(10, Math.min(60, Math.round(2400 / content.durationSeconds)))
                  : content?.tempo
                    ? Math.max(10, Math.min(50, Math.round(content.tempo / 3)))
                    : 30
              }
            />
            <div className="flex-1" />
            {/* Song list quick nav */}
            <div className="flex items-center gap-1">
              {songs.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goToSong(idx)}
                  className={`w-6 h-6 rounded-full text-xs font-mono transition-colors ${
                    idx === currentIndex
                      ? "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"
                      : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/80"
                  }`}
                  title={songs[idx]?.songTitle ?? songs[idx]?.slotLabel ?? undefined}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Next button */}
        <button
          data-testid="perf-next"
          onClick={goNext}
          disabled={currentIndex === songs.length - 1}
          className="shrink-0 w-12 flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-20 disabled:cursor-default"
          title="Next song (→ or N)"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      {/* ── Bottom status ───────────────────────── */}
      {songs.length > 1 && (
        <div className="px-4 py-1.5 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 shrink-0">
          <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            {currentIndex < songs.length - 1 && (
              <>
                <SkipForward className="h-3 w-3" />
                <span>
                  Up next: <span className="font-medium text-[hsl(var(--foreground))]">{songs[currentIndex + 1]?.songTitle}</span>
                </span>
                {currentSong?.transitionCues?.map((cue, i) => (
                  <span key={i} className="badge-muted" data-testid="perf-transition-cue">
                    {cue.type === "COUNTDOWN" && cue.durationSec
                      ? `Countdown ${cue.durationSec}s`
                      : `${cue.type.charAt(0)}${cue.type.slice(1).toLowerCase()}${cue.text ? `: ${cue.text}` : ""}`}
                  </span>
                ))}
              </>
            )}
            {currentIndex === songs.length - 1 && (
              <span>Last song in the setlist</span>
            )}
            <div className="flex-1" />
            <span>
              ←/→ navigate · Space scroll · Esc exit · C chords · T toolbar · +/− font
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
