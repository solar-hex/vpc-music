import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usageReportApi, type SongUsageReportRow } from "@/lib/api-client";
import { TrendingUp, ArrowUpDown } from "lucide-react";

type SortKey = "title" | "playCount" | "lastPlayed";

const STALE_OPTIONS = [30, 60, 90, 180] as const;

/** Dashboard → Song usage: plays, last played, and set list membership. */
export function DashboardUsageTab() {
  const [rows, setRows] = useState<SongUsageReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("playCount");
  const [sortAsc, setSortAsc] = useState(false);
  const [staleDays, setStaleDays] = useState<number | null>(null);

  useEffect(() => {
    usageReportApi
      .get()
      .then((res) => setRows(res.songs))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    let filtered = rows;
    if (staleDays !== null) {
      const cutoff = Date.now() - staleDays * 86_400_000;
      filtered = rows.filter((row) => !row.lastPlayed || new Date(row.lastPlayed).getTime() < cutoff);
    }
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "title") cmp = a.title.localeCompare(b.title);
      else if (sortKey === "playCount") cmp = a.playCount - b.playCount;
      else {
        const aTime = a.lastPlayed ? new Date(a.lastPlayed).getTime() : 0;
        const bTime = b.lastPlayed ? new Date(b.lastPlayed).getTime() : 0;
        cmp = aTime - bTime;
      }
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [rows, sortKey, sortAsc, staleDays]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((prev) => !prev);
    else {
      setSortKey(key);
      setSortAsc(key === "title");
    }
  };

  const headerButton = (key: SortKey, label: string) => (
    <button onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 hover:text-[hsl(var(--foreground))]">
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sortKey === key ? "text-[hsl(var(--secondary))]" : "opacity-40"}`} />
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h3 className="section-title">
          <TrendingUp className="section-title-icon" /> Song Usage
        </h3>
        <select
          value={staleDays ?? ""}
          onChange={(e) => setStaleDays(e.target.value ? Number(e.target.value) : null)}
          className="select w-auto"
          aria-label="Stale filter"
        >
          <option value="">All songs</option>
          {STALE_OPTIONS.map((days) => (
            <option key={days} value={days}>
              Not played in {days}+ days
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : visible.length === 0 ? (
        <div className="card-empty">
          <TrendingUp className="mx-auto h-10 w-10 text-[hsl(var(--muted-foreground))] mb-2" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {staleDays !== null
              ? `Every song has been played in the last ${staleDays} days.`
              : "Play data appears here once events are completed."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] text-left text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                <th className="px-4 py-2.5">{headerButton("title", "Song")}</th>
                <th className="px-4 py-2.5">{headerButton("playCount", "Times played")}</th>
                <th className="px-4 py-2.5">{headerButton("lastPlayed", "Last played")}</th>
                <th className="px-4 py-2.5">Appears in</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-b border-[hsl(var(--border))]/50 last:border-b-0 hover:bg-[hsl(var(--muted))]/50">
                  <td className="px-4 py-2.5">
                    <Link to={`/songs/${row.id}`} className="font-medium hover:text-[hsl(var(--secondary))]">
                      {row.title}
                    </Link>
                    {row.artist && <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">{row.artist}</span>}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{row.playCount}</td>
                  <td className="px-4 py-2.5 text-[hsl(var(--muted-foreground))]">
                    {row.lastPlayed
                      ? new Date(row.lastPlayed).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
                      : "Never"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))] max-w-[280px] truncate" title={row.setlistNames ?? undefined}>
                    {row.setlistNames || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
