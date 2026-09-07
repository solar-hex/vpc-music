import { parseChordPro, transposeChordPro, chordToNashville, spellForTarget, parseBarLine, isSecondaryToken } from "@vpc-music/shared";
import { useState, useRef, useEffect, useCallback } from "react";

function normalizeTranspose(steps: number) {
  if (steps === 0) return 0;
  return steps > 0 ? steps % 12 : -((-steps) % 12);
}

interface ChordProRendererProps {
  content: string;
  songKey?: string | null;
  /** Net semitone shift to render at (the host owns transposition state). */
  transpose?: number;
  showChords?: boolean;
  nashville?: boolean;
  fontSize?: number;
  /** Render `{ci: ...}` note lines (the old site's toggleable comments). */
  showComments?: boolean;
  /** Wrap long lyric lines (default). The chart page passes false and scrolls sideways instead. */
  wrap?: boolean;
  /** Makes chords tappable (e.g. to open a fingering diagram). */
  onChordTap?: (chord: string) => void;
}

/**
 * Renders a ChordPro string as chord-over-lyric lines. Stateless: every
 * control (transpose, capo, key picker) lives in the host page, which passes
 * the net shift in. Each section wrapper carries `id="section-<index>"` so a
 * jump bar can scroll to it.
 */
export function ChordProRenderer({
  content,
  songKey,
  transpose: requestedTranspose = 0,
  showChords = true,
  nashville = false,
  fontSize = 16,
  showComments = true,
  wrap = true,
  onChordTap,
}: ChordProRendererProps) {
  const transpose = normalizeTranspose(requestedTranspose);
  // Apply transposition to raw ChordPro, then parse. Enharmonic spelling
  // follows the TARGET key (into Bb you get Eb, not D#).
  const { preferFlats } = spellForTarget(songKey, transpose);
  const transposedContent = transpose !== 0 ? transposeChordPro(content, transpose, preferFlats) : content;
  const doc = parseChordPro(transposedContent);

  return (
    <div data-testid="chordpro-renderer">
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
            if (line.note !== undefined) {
              flushBars(`bars-${li}`);
              if (showComments) {
                rows.push(
                  <div key={li} className="chart-note italic text-[hsl(var(--muted-foreground))]">
                    {line.note}
                  </div>,
                );
              }
              return;
            }
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
                wrap={wrap}
                onChordTap={onChordTap}
              />,
            );
          });
          flushBars("bars-tail");
          return (
            <div key={si} id={`section-${si}`} className="chart-section scroll-mt-4 space-y-1">
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
}

/** Names of the sections a chart has, in order, with the ids the renderer gives them. */
export function chartSections(content: string): { id: string; label: string }[] {
  return parseChordPro(content)
    .sections.map((section, index) => ({ id: `section-${index}`, label: section.name }))
    .filter((section) => section.label);
}

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
                  : " "}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Pad chord names to their lyric columns, as React nodes. */
function chordRow(
  chords: { chord: string; position: number }[],
  render: (chord: string, label: string, index: number) => React.ReactNode,
) {
  const spans: React.ReactNode[] = [];
  let lastEnd = 0;
  chords.forEach(({ chord, position }, i) => {
    const label = isSecondaryToken(chord) ? chord.slice(1) : chord;
    const gap = Math.max(0, position - lastEnd);
    if (gap > 0) {
      spans.push(
        <span key={`gap-${i}`} className="whitespace-pre">
          {" ".repeat(gap)}
        </span>,
      );
    }
    spans.push(render(chord, label, i));
    lastEnd = Math.max(lastEnd, position) + label.length;
  });
  return spans;
}

/** Renders a single lyric line with its chord row(s) above it. */
function ChordLine({
  chords,
  lyrics,
  showChords,
  nashville = false,
  songKey,
  wrap,
  onChordTap,
}: {
  chords: { chord: string; position: number }[];
  lyrics: string;
  showChords: boolean;
  nashville?: boolean;
  songKey?: string | null;
  wrap: boolean;
  onChordTap?: (chord: string) => void;
}) {
  if (!chords.length && !lyrics.trim()) return null;

  const lyricClass = `${wrap ? "whitespace-pre-wrap" : "whitespace-pre"} text-[hsl(var(--foreground))]`;

  // If no chords, just render lyrics
  if (!chords.length || !showChords) {
    return <div className={`font-mono ${lyricClass}`}>{lyrics}</div>;
  }

  const sorted = [...chords].sort((a, b) => a.position - b.position);
  const secondary = sorted.filter((entry) => isSecondaryToken(entry.chord));
  const primary = sorted.filter((entry) => !isSecondaryToken(entry.chord));

  const primarySpans = chordRow(primary, (chord, label, i) => {
    const displayChord = nashville && songKey ? chordToNashville(chord, songKey) : label;
    return onChordTap ? (
      // Tappable chord -> fingering diagram. min-h-0 opts out of the global
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
    );
  });

  const secondarySpans = chordRow(secondary, (_chord, label, i) => (
    <span key={`sec-${i}`} className="song-secondary-chord font-bold">
      {label}
    </span>
  ));

  return (
    <div className="font-mono leading-relaxed">
      {secondary.length > 0 && (
        <div className="song-secondary-chord whitespace-pre text-[0.9em]" data-testid="secondary-chord-row">
          {secondarySpans}
        </div>
      )}
      {primary.length > 0 && <div className="song-primary-chord whitespace-pre">{primarySpans}</div>}
      <div className={lyricClass}>{lyrics}</div>
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
