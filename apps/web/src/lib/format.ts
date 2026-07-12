/**
 * Shared display formatters — one home for the small time/date helpers that
 * were previously re-implemented across pages. Keeping presentation logic here
 * makes every figure read consistently (and, per the DoD, tabular-numeral mono).
 */

/** Seconds → "m:ss". No hour rollover (3605 → "60:05"). Negative clamps to 0. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Seconds → a compact length: "45 min" under an hour, else "1h 5m". Null-safe. */
export function formatSetlistDuration(totalSeconds?: number | null): string | null {
  if (!totalSeconds) return null;
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** ISO timestamp → "just now" / "5m ago" / "3h ago" / "2d ago" / short date. */
export function timeAgo(iso?: string): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Date → "YYYY-MM-DD" in local time (calendar / availability day keys). */
export function toDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** ISO → the value format of <input type="datetime-local"> ("YYYY-MM-DDTHH:mm"). */
export function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Sat, Mar 16, 7:30 PM" — the recurring event / rehearsal datetime preset. */
export function formatEventDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Mar 16, 2026" — the recurring played / last-played date preset. */
export function formatShortDate(value: string | number | Date): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
