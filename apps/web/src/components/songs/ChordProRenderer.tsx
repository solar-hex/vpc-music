import { parseChordPro, transposeChordPro, chordToNashville, transposeKeyName, keyPrefersFlats } from "@vpc-music/shared";
import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";

function normalizeTranspose(steps: number) {
  if (steps === 0) return 0;
  return steps > 0 ? steps % 12 : -((-steps) % 12);
}

interface ChordProRendererProps {
  content: string;
  songKey?: string | null;
  baseTranspose?: number;
  showChords?: boolean;
  nashville?: boolean;
  fontSize?: number;
  /** Hide the inline transpose row (the host renders its own control) */
  showControls?: boolean;
  onTranspose?: (newKey: string) => void;
}

export interface ChordProRendererHandle {
  transposeUp: () => void;
  transposeDown: () => void;
  transposeReset: () => void;
}

/**
 * Renders a ChordPro string as formatted lyric/chord lines.
 * Supports transposition via the shared transpose engine.
 */
export const ChordProRenderer = forwardRef<ChordProRendererHandle, ChordProRendererProps>(function ChordProRenderer({
  content,
  songKey,
  baseTranspose = 0,
  showChords = true,
  nashville = false,
  fontSize = 16,
  showControls = true,
  onTranspose,
}, ref) {
  const [manualTranspose, setManualTranspose] = useState(0);
  const transpose = normalizeTranspose(baseTranspose + manualTranspose);

  useEffect(() => {
    setManualTranspose(0);
  }, [baseTranspose, content, songKey]);

  // Apply transposition to raw ChordPro, then parse. Enharmonic spelling
  // follows the TARGET key (into Bb you get Eb, not D#): if the flat name
  // of the destination is a conventional flat key, spell the chart flat.
  const flatTarget = songKey ? transposeKeyName(songKey, transpose, true) : null;
  const preferFlats = flatTarget ? keyPrefersFlats(flatTarget) : undefined;
  const targetKey = songKey ? transposeKeyName(songKey, transpose, preferFlats) : null;
  const transposedContent = transpose !== 0 ? transposeChordPro(content, transpose, preferFlats) : content;
  const doc = parseChordPro(transposedContent);

  const handleUp = () => setManualTranspose((t) => normalizeTranspose(t + 1));
  const handleDown = () => setManualTranspose((t) => normalizeTranspose(t - 1));
  const handleReset = () => setManualTranspose(0);

  useImperativeHandle(ref, () => ({
    transposeUp: handleUp,
    transposeDown: handleDown,
    transposeReset: handleReset,
  }));

  return (
    <div className="song-display-font space-y-2" data-testid="chordpro-renderer">
      {/* Transpose controls */}
      {showChords && showControls && (
        <div className="flex items-center gap-3 text-sm print-hidden">
          <span className="text-[hsl(var(--muted-foreground))]">Transpose:</span>
          <button
            onClick={handleDown}
            className="h-7 w-7 rounded border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
          >
            −
          </button>
          <span className="min-w-[3ch] text-center font-mono text-[hsl(var(--foreground))]">
            {transpose > 0 ? `+${transpose}` : transpose}
          </span>
          <button
            onClick={handleUp}
            className="h-7 w-7 rounded border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
          >
            +
          </button>
          {manualTranspose !== 0 && (
            <button
              onClick={handleReset}
              className="text-xs text-[hsl(var(--secondary))] hover:underline"
            >
              Reset
            </button>
          )}
          {songKey && (
            <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">
              Original key: {songKey}
              {transpose !== 0 && targetKey && (
                <span className="ml-1 font-medium text-[hsl(var(--secondary))]">→ {targetKey}</span>
              )}
            </span>
          )}
        </div>
      )}

      {/* Directives (title, artist, etc.) — hidden in print because SongViewPage has its own print-meta block */}
      {doc.directives.title && (
        <h2 className="text-xl font-brand text-[hsl(var(--foreground))] print-hidden">
          {doc.directives.title}
        </h2>
      )}
      {doc.directives.artist && (
        <div className="text-sm text-[hsl(var(--muted-foreground))] print-hidden">
          {doc.directives.artist}
        </div>
      )}

      {/* Sections */}
      <div className="space-y-4" style={{ fontSize: `${fontSize}px` }}>
        {doc.sections.map((section: any, si: number) => (
          <div key={si} className="space-y-1">
            {section.name && (
              <div className="song-secondary-chord mt-2 text-sm font-semibold uppercase tracking-wide">
                {section.name}
              </div>
            )}
            {section.lines.map((line: any, li: number) => (
              <ChordLine
                key={li}
                chords={line.chords}
                lyrics={line.lyrics}
                showChords={showChords}
                nashville={nashville}
                songKey={songKey}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});

/** Renders a single lyric/chord line pair */
function ChordLine({
  chords,
  lyrics,
  showChords,
  nashville = false,
  songKey,
}: {
  chords: { chord: string; position: number }[];
  lyrics: string;
  showChords: boolean;
  nashville?: boolean;
  songKey?: string | null;
}) {
  if (!chords.length && !lyrics.trim()) return null;

  // If no chords, just render lyrics
  if (!chords.length || !showChords) {
    return (
      <div className="font-mono whitespace-pre-wrap text-[hsl(var(--foreground))]">
        {lyrics}
      </div>
    );
  }

  // Build chord line: spaces + chord names at the right positions
  const chordSpans: React.ReactNode[] = [];
  let lastEnd = 0;

  for (let i = 0; i < chords.length; i++) {
    const { chord, position } = chords[i];
    const gap = Math.max(0, position - lastEnd);
    if (gap > 0) {
      chordSpans.push(
        <span key={`gap-${i}`} className="whitespace-pre">
          {" ".repeat(gap)}
        </span>
      );
    }
    const displayChord = nashville && songKey ? chordToNashville(chord, songKey) : chord;
    chordSpans.push(
      <span key={`ch-${i}`} className="song-primary-chord font-bold">
        {displayChord}
      </span>
    );
    lastEnd = position + chord.length;
  }

  return (
    <div className="font-mono leading-relaxed">
      <div className="song-primary-chord whitespace-pre">{chordSpans}</div>
      <div className="whitespace-pre-wrap text-[hsl(var(--foreground))]">{lyrics}</div>
    </div>
  );
}

/** Auto-scroll component for performance mode */
export function AutoScroll({
  containerRef,
  defaultSpeed = 30,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  defaultSpeed?: number;
}) {
  const [scrolling, setScrolling] = useState(false);
  const [speed, setSpeed] = useState(defaultSpeed); // px per second
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const startScrolling = useCallback(() => {
    setScrolling(true);
    lastTimeRef.current = performance.now();
  }, []);

  const stopScrolling = useCallback(() => {
    setScrolling(false);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
  }, []);

  const toggleScrolling = useCallback(() => {
    if (scrolling) stopScrolling();
    else startScrolling();
  }, [scrolling, startScrolling, stopScrolling]);

  useEffect(() => {
    if (!scrolling || !containerRef.current) return;

    const el = containerRef.current;

    const tick = (time: number) => {
      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;
      el.scrollTop += speed * delta;

      // Stop at bottom
      if (el.scrollTop + el.clientHeight >= el.scrollHeight) {
        setScrolling(false);
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [scrolling, speed, containerRef]);

  return (
    <div className="flex items-center gap-3 text-sm">
      <button
        onClick={toggleScrolling}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          scrolling
            ? "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]"
            : "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"
        }`}
      >
        {scrolling ? "Stop" : "Auto-scroll"}
      </button>
      <label className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
        Speed
        <input
          type="range"
          min="10"
          max="80"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="w-24 accent-[hsl(var(--secondary))]"
        />
      </label>
    </div>
  );
}
