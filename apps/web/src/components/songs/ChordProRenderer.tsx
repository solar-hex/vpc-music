import { parseChordPro, transposeChordPro, chordToNashville, spellForTarget, parseBarLine, transposeKeyName } from "@vpc-music/shared";
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
  /** Makes chords tappable (e.g. to open a fingering diagram). */
  onChordTap?: (chord: string) => void;
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
  onChordTap,
}, ref) {
  const [manualTranspose, setManualTranspose] = useState(0);
  // Capo: play friendlier shapes N frets down while sounding the same key.
  const [capo, setCapo] = useState(0);
  const transpose = normalizeTranspose(baseTranspose + manualTranspose - capo);

  useEffect(() => {
    setManualTranspose(0);
    setCapo(0);
  }, [baseTranspose, content, songKey]);

  // Apply transposition to raw ChordPro, then parse. Enharmonic spelling
  // follows the TARGET key (into Bb you get Eb, not D#): if the flat name
  // of the destination is a conventional flat key, spell the chart flat.
  const { preferFlats, targetKey } = spellForTarget(songKey, transpose);
  const transposedContent = transpose !== 0 ? transposeChordPro(content, transpose, preferFlats) : content;
  const doc = parseChordPro(transposedContent);

  // The key the audience hears: what the chart would be at WITHOUT the capo
  // shift (base + manual only).
  const soundingTranspose = normalizeTranspose(baseTranspose + manualTranspose);
  const soundingKey = songKey ? spellForTarget(songKey, soundingTranspose).targetKey ?? songKey : null;

  // A {capo: N} directive in the source acts as the initial suggestion.
  const directiveCapo = Number(doc.directives.capo);
  const suggestedCapo = Number.isInteger(directiveCapo) && directiveCapo >= 1 && directiveCapo <= 12 ? directiveCapo : null;

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
            <label className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
              Capo
              <select
                value={capo}
                onChange={(e) => setCapo(Number(e.target.value))}
                className="select btn-sm w-auto"
                title="Play open shapes with a capo; the sounding key stays the same"
              >
                <option value={0}>Off</option>
                {[1, 2, 3, 4, 5, 6, 7].map((fret) => (
                  <option key={fret} value={fret}>
                    {fret} — play {soundingKey ? transposeKeyName(soundingKey, -fret) : "?"}
                  </option>
                ))}
              </select>
            </label>
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

      {/* Capo banner — active capo, or the chart's {capo:} suggestion */}
      {showChords && capo > 0 && soundingKey && (
        <div className="print-hidden inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--secondary))]/40 bg-[hsl(var(--secondary))]/10 px-2.5 py-1 text-xs font-medium text-[hsl(var(--foreground))]">
          Capo {capo} — play {targetKey ?? "?"}, sounds {soundingKey}
        </div>
      )}
      {showChords && capo === 0 && suggestedCapo && soundingKey && (
        <button
          type="button"
          onClick={() => setCapo(suggestedCapo)}
          className="print-hidden inline-flex items-center gap-1.5 rounded-md border border-dashed border-[hsl(var(--border))] px-2.5 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]"
          title="Apply the chart's suggested capo"
        >
          Suggested: Capo {suggestedCapo} — play {transposeKeyName(soundingKey, -suggestedCapo)}
        </button>
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
        {doc.sections.map((section: any, si: number) => {
          // Consecutive bar rows ("| G | C |") render as one aligned grid
          const rows: React.ReactNode[] = [];
          let barRun: string[] = [];
          const flushBars = (key: string) => {
            if (barRun.length && showChords) {
              rows.push(<BarGrid key={key} lines={barRun} nashville={nashville} songKey={songKey} />);
            }
            barRun = [];
          };
          section.lines.forEach((line: any, li: number) => {
            if (!line.chords.length && line.lyrics.trimStart().startsWith("|")) {
              barRun.push(line.lyrics);
              return;
            }
            flushBars(`bars-${li}`);
            rows.push(
              <ChordLine
                key={li}
                chords={line.chords}
                lyrics={line.lyrics}
                showChords={showChords}
                nashville={nashville}
                songKey={songKey}
                onChordTap={onChordTap}
              />,
            );
          });
          flushBars("bars-tail");
          return (
            <div key={si} className="space-y-1">
              {section.name && (
                <div className="song-secondary-chord mt-2 text-sm font-semibold uppercase tracking-wide">
                  {section.name}
                </div>
              )}
              {rows}
            </div>
          );
        })}
      </div>
    </div>
  );
});

/**
 * Aligned grid for instrumental bar rows. Consecutive rows share column
 * widths so measures line up vertically; rows shorter than the widest row
 * get invisible trailing cells.
 */
function BarGrid({
  lines,
  nashville = false,
  songKey,
}: {
  lines: string[];
  nashville?: boolean;
  songKey?: string | null;
}) {
  const rows = lines
    .map((line) => parseBarLine(line))
    .filter((row): row is NonNullable<ReturnType<typeof parseBarLine>> => Boolean(row));
  if (!rows.length) return null;
  const columns = Math.max(1, ...rows.map((row) => row.measures.length));

  return (
    <div className="font-mono space-y-px py-1" data-testid="bar-grid">
      {rows.map((row, ri) => (
        <div
          key={ri}
          className="grid"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }, (_, ci) => {
            const tokens = row.measures[ci];
            return (
              <div
                key={ci}
                className={`border-l border-[hsl(var(--border))] px-2 py-0.5 ${
                  ci === columns - 1 ? "border-r" : ""
                } ${tokens === undefined ? "invisible" : ""}`}
              >
                {tokens?.length
                  ? tokens.map((token, ti) =>
                      token.type === "chord" ? (
                        <span key={ti} className="song-primary-chord font-bold mr-2 last:mr-0">
                          {nashville && songKey ? chordToNashville(token.value, songKey) : token.value}
                        </span>
                      ) : (
                        <span key={ti} className="text-[hsl(var(--muted-foreground))] mr-2 last:mr-0">
                          {token.value}
                        </span>
                      ),
                    )
                  : " "}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Renders a single lyric/chord line pair */
function ChordLine({
  chords,
  lyrics,
  showChords,
  nashville = false,
  songKey,
  onChordTap,
}: {
  chords: { chord: string; position: number }[];
  lyrics: string;
  showChords: boolean;
  nashville?: boolean;
  songKey?: string | null;
  onChordTap?: (chord: string) => void;
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
      onChordTap ? (
        // Tappable chord → fingering diagram. min-h-0 opts out of the global
        // 44px coarse-pointer rule (it would inflate every chord row); the
        // negative-margin padding grows the hit area without moving layout.
        <button
          key={`ch-${i}`}
          type="button"
          onClick={() => onChordTap(chord)}
          className="song-primary-chord min-h-0 -my-2 border-0 bg-transparent p-0 py-2 font-bold cursor-pointer hover:underline"
          title={`Show ${displayChord} chord diagram`}
        >
          {displayChord}
        </button>
      ) : (
        <span key={`ch-${i}`} className="song-primary-chord font-bold">
          {displayChord}
        </span>
      )
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
