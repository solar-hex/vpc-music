import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { statsApi, type StatsOverview } from "@/lib/api-client";
import { MonthlyColumns } from "@/components/charts/MonthlyColumns";
import { BarList } from "@/components/charts/BarList";
import { DashboardUsageTab } from "./DashboardUsageTab";
import { DashboardHistoryTab } from "./DashboardHistoryTab";
import { BarChart3, Table2, CalendarCheck } from "lucide-react";

type View = "charts" | "usage" | "history";

const VIEWS: Array<{ id: View; label: string; icon: typeof BarChart3 }> = [
  { id: "charts", label: "Charts", icon: BarChart3 },
  { id: "usage", label: "Song usage", icon: Table2 },
  { id: "history", label: "Event history", icon: CalendarCheck },
];

/**
 * Analytics home: charts (plays over time, top songs, library make-up,
 * member activity) plus the song-usage table and event history as
 * segmented views. One place for every statistic.
 */
export function DashboardAnalyticsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = (searchParams.get("view") as View) || "charts";
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (view !== "charts") return;
    setLoading(true);
    statsApi
      .overview()
      .then(setOverview)
      .catch(() => setOverview(null))
      .finally(() => setLoading(false));
  }, [view]);

  const setView = (v: View) => {
    const next = new URLSearchParams(searchParams);
    if (v === "charts") next.delete("view");
    else next.set("view", v);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      {/* Segmented view toggle */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-[hsl(var(--muted))] p-1 w-fit" role="tablist" aria-label="Analytics views">
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === id
                ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {view === "usage" && <DashboardUsageTab />}
      {view === "history" && <DashboardHistoryTab />}

      {view === "charts" &&
        (loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner" />
          </div>
        ) : !overview ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Couldn't load statistics.</p>
        ) : (
          <>
            {/* Headline totals */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="card card-body">
                <p className="text-xs uppercase font-semibold text-[hsl(var(--muted-foreground))]">Total plays</p>
                <p className="text-2xl font-bold tabular-nums">{overview.totals.totalPlays}</p>
              </div>
              <div className="card card-body">
                <p className="text-xs uppercase font-semibold text-[hsl(var(--muted-foreground))]">Songs played</p>
                <p className="text-2xl font-bold tabular-nums">{overview.totals.songsPlayed}</p>
              </div>
              <div className="card card-body">
                <p className="text-xs uppercase font-semibold text-[hsl(var(--muted-foreground))]">Plays this month</p>
                <p className="text-2xl font-bold tabular-nums">
                  {overview.playsByMonth.length > 0 ? overview.playsByMonth[overview.playsByMonth.length - 1].plays : 0}
                </p>
              </div>
              <div className="card card-body">
                <p className="text-xs uppercase font-semibold text-[hsl(var(--muted-foreground))]">Keys in library</p>
                <p className="text-2xl font-bold tabular-nums">{overview.keyDistribution.length}</p>
              </div>
            </div>

            {/* Plays over time */}
            <div className="card card-body space-y-2">
              <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Plays per month (last 12)</h3>
              <MonthlyColumns data={overview.playsByMonth} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="card card-body space-y-3">
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Most played songs</h3>
                <BarList
                  ariaLabel="Most played songs"
                  items={overview.topSongs.map((s) => ({ label: s.title, value: s.plays }))}
                />
              </div>
              <div className="card card-body space-y-3">
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Who logs plays</h3>
                <BarList
                  ariaLabel="Plays recorded per member"
                  items={overview.memberActivity.map((m) => ({ label: m.name || "Unknown", value: m.plays }))}
                />
              </div>
              <div className="card card-body space-y-3">
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Library by key</h3>
                <BarList
                  ariaLabel="Songs per key"
                  items={overview.keyDistribution.map((k) => ({ label: `Key ${k.key}`, value: k.count }))}
                />
              </div>
              <div className="card card-body space-y-3">
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Library by tempo</h3>
                <BarList
                  ariaLabel="Songs per tempo band"
                  items={overview.tempoDistribution.map((t) => ({ label: t.band, value: t.count }))}
                />
              </div>
            </div>
          </>
        ))}
    </div>
  );
}
