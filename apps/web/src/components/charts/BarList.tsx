import type { ReactNode } from "react";

export interface BarListItem {
  label: ReactNode;
  value: number;
  /** Optional secondary text after the value (e.g. a date). */
  hint?: string;
}

/**
 * Horizontal bar list for magnitude comparisons (top songs, key/tempo
 * distribution, member activity). Single hue from the theme accent; labels
 * and values stay in text tokens; thin 10px bars on a muted track.
 */
export function BarList({ items, ariaLabel }: { items: BarListItem[]; ariaLabel?: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-[hsl(var(--muted-foreground))]">No data yet.</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="space-y-2" role="img" aria-label={ariaLabel}>
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <div className="w-2/5 min-w-0 truncate text-sm text-[hsl(var(--foreground))]">{item.label}</div>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
            <div
              className="h-full rounded-full bg-[hsl(var(--secondary))]/90"
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
              title={String(item.value)}
            />
          </div>
          <div className="w-14 shrink-0 text-right text-sm tabular-nums text-[hsl(var(--foreground))]">
            {item.value}
            {item.hint && <span className="ml-1 text-xs text-[hsl(var(--muted-foreground))]">{item.hint}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
