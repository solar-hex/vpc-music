import { useMemo } from "react";
import { analyze, type FlowItem, type FlowTransition } from "@vpc-music/shared";
import type { SetlistSongItem } from "@/lib/api-client";
import { AlertTriangle, Info } from "lucide-react";

const QUALITY_COLORS: Record<FlowTransition["quality"], string> = {
  smooth: "bg-emerald-500",
  ok: "bg-[hsl(var(--muted-foreground))]/40",
  notable: "bg-amber-500",
  harsh: "bg-red-500",
  unknown: "bg-[hsl(var(--muted-foreground))]/20",
};

function formatMinutes(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/**
 * Ambient set-flow strip: energy sparkline, key sequence with transition
 * quality, duration vs the event slot, and a quiet list of advisory
 * signals. Recomputed synchronously on every change — it's O(n).
 */
export function FlowStrip({
  items,
  targetSeconds,
  recentlyPlayed,
}: {
  items: SetlistSongItem[];
  targetSeconds?: number | null;
  recentlyPlayed?: string[];
}) {
  const result = useMemo(() => {
    const flowItems: FlowItem[] = items.map((item) => ({
      songId: item.songId,
      title: item.songTitle ?? item.slotLabel ?? "Song",
      key: item.key || item.songKey || null,
      bpm: item.songTempo ?? null,
      energy: item.songEnergy ?? null,
      durationSeconds: item.duration ?? item.songDurationSeconds ?? null,
      talkSeconds: item.talkSeconds ?? null,
      status: item.songStatus ?? null,
    }));
    return analyze(flowItems, { targetSeconds: targetSeconds ?? null, recentlyPlayed });
  }, [items, targetSeconds, recentlyPlayed]);

  if (items.length < 2) return null;

  const { curve, keys, transitions, timing, signals } = result;
  const width = Math.max(items.length * 28, 120);
  const height = 28;
  const points = curve
    .map((energy, index) => {
      if (energy == null) return null;
      const x = items.length === 1 ? width / 2 : (index / (items.length - 1)) * (width - 8) + 4;
      const y = height - 3 - ((energy - 1) / 4) * (height - 8);
      return { x, y, index };
    })
    .filter(Boolean) as { x: number; y: number; index: number }[];

  const musicPct = timing.totalSeconds > 0 ? (timing.musicSeconds / Math.max(timing.totalSeconds, timing.targetSeconds ?? 0)) * 100 : 0;
  const gapPct = timing.totalSeconds > 0 ? (timing.gapSeconds / Math.max(timing.totalSeconds, timing.targetSeconds ?? 0)) * 100 : 0;

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 space-y-2.5 print-hidden" data-testid="flow-strip">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {/* Energy curve */}
        <div className="flex items-center gap-2" title="Energy curve (1–5, BPM-derived unless a song sets its own)">
          <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Energy</span>
          <svg width={width} height={height} className="shrink-0" role="img" aria-label="Set energy curve">
            {points.length > 1 && (
              <polyline
                points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="hsl(var(--secondary))"
                strokeWidth="1.5"
              />
            )}
            {points.map((p) => (
              <circle key={p.index} cx={p.x} cy={p.y} r="2.5" fill="hsl(var(--secondary))" />
            ))}
          </svg>
        </div>

        {/* Key sequence with transition quality connectors */}
        <div className="flex items-center gap-0.5" title="Key sequence — connector color = transition quality">
          <span className="mr-1.5 text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Keys</span>
          {keys.map((key, index) => (
            <span key={index} className="flex items-center gap-0.5">
              {index > 0 && (
                <span
                  className={`inline-block h-0.5 w-3 rounded ${QUALITY_COLORS[transitions[index - 1]?.quality ?? "unknown"]}`}
                  data-testid={`flow-connector-${index}`}
                  aria-hidden="true"
                />
              )}
              <span className="text-xs font-mono text-[hsl(var(--foreground))]">{key ?? "—"}</span>
            </span>
          ))}
        </div>

        {/* Duration bar: music vs gaps vs slot */}
        <div className="flex items-center gap-2 min-w-[180px] flex-1 max-w-[320px]" title="Music vs gaps vs the event's slot">
          <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Time</span>
          <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
            <div className="absolute inset-y-0 left-0 bg-[hsl(var(--secondary))]" style={{ width: `${Math.min(musicPct, 100)}%` }} />
            <div
              className="absolute inset-y-0 bg-amber-500/70"
              style={{ left: `${Math.min(musicPct, 100)}%`, width: `${Math.min(gapPct, 100 - Math.min(musicPct, 100))}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))] whitespace-nowrap">
            {formatMinutes(timing.musicSeconds)} music · {formatMinutes(timing.gapSeconds)} gaps
            {timing.targetSeconds != null && ` / ${formatMinutes(timing.targetSeconds)} slot`}
          </span>
        </div>
      </div>

      {/* Advisory signals — every one can be ignored */}
      {signals.length > 0 && (
        <ul className="space-y-0.5">
          {signals.map((signal, index) => (
            <li
              key={`${signal.type}-${index}`}
              className={`flex items-center gap-1.5 text-xs ${
                signal.severity === "warn" ? "text-amber-600 dark:text-amber-400" : "text-[hsl(var(--muted-foreground))]"
              }`}
              data-testid={`flow-signal-${signal.type}`}
            >
              {signal.severity === "warn" ? <AlertTriangle className="h-3 w-3 shrink-0" /> : <Info className="h-3 w-3 shrink-0" />}
              {signal.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
