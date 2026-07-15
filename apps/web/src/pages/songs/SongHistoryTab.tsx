import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  songsApi,
  songUsageApi,
  songHistoryApi,
  statsApi,
  type Song,
  type SongUsage,
  type SongEdit,
  type MonthPlays,
  type SongPerformance,
} from "@/lib/api-client";
import { History, TrendingUp, ListMusic, ArrowLeft, CalendarDays } from "lucide-react";
import { formatShortDate } from "@/lib/format";
import { MonthlyColumns } from "@/components/charts/MonthlyColumns";

interface ContainingSetlist {
  id: string;
  name: string;
  status?: string;
}

/** Song detail → History: play stats, full play log, edits, and set lists. */
export function SongHistoryTab() {
  const { id } = useParams<{ id: string }>();
  const [song, setSong] = useState<Song | null>(null);
  const [usages, setUsages] = useState<SongUsage[]>([]);
  const [edits, setEdits] = useState<SongEdit[]>([]);
  const [containing, setContaining] = useState<ContainingSetlist[]>([]);
  const [playsByMonth, setPlaysByMonth] = useState<MonthPlays[]>([]);
  const [performances, setPerformances] = useState<SongPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      songsApi.get(id).then((res) => setSong(res.song)).catch(() => {}),
      songUsageApi.list(id).then((res) => setUsages(res.usages)).catch(() => {}),
      songHistoryApi.list(id).then((res) => setEdits(res.history)).catch(() => {}),
      songsApi.listSetlists(id).then((res) => setContaining(res.setlists)).catch(() => {}),
      statsApi
        .song(id)
        .then((res) => {
          setPlaysByMonth(res.playsByMonth);
          setPerformances(res.performances);
        })
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="spinner" /></div>;
  }

  const lastPlayed = usages.length > 0 ? usages[0].usedAt : null;

  return (
    <div className="space-y-6">
      <Link to={`/songs/${id}`} className="link-accent inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="h-4 w-4" /> {song?.title ?? "Song"}
      </Link>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 max-w-xl">
        <div className="card card-body">
          <p className="text-xs uppercase font-semibold text-[hsl(var(--muted-foreground))]">Times played</p>
          <p className="text-2xl font-bold tabular-nums">{usages.length}</p>
        </div>
        <div className="card card-body">
          <p className="text-xs uppercase font-semibold text-[hsl(var(--muted-foreground))]">Last played</p>
          <p className="text-sm font-medium mt-1.5">
            {lastPlayed
              ? formatShortDate(lastPlayed + "T00:00:00")
              : "Never"}
          </p>
        </div>
        <div className="card card-body">
          <p className="text-xs uppercase font-semibold text-[hsl(var(--muted-foreground))]">In set lists</p>
          <p className="text-2xl font-bold tabular-nums">{containing.length}</p>
        </div>
      </div>

      {/* Plays over time */}
      {playsByMonth.some((m) => m.plays > 0) && (
        <section className="max-w-xl space-y-2">
          <h4 className="section-title">
            <TrendingUp className="section-title-icon" /> Plays per month
          </h4>
          <MonthlyColumns data={playsByMonth} height={72} ariaLabel="This song's plays per month" />
        </section>
      )}

      {/* Where it was actually played — survives setlist/event deletion */}
      {performances.length > 0 && (
        <section className="space-y-2">
          <h4 className="section-title">
            <CalendarDays className="section-title-icon" /> Played at
          </h4>
          <div className="list-container">
            {performances.slice(0, 20).map((p) => (
              <div key={p.id} className="list-item text-sm">
                <span className="font-medium shrink-0">{formatShortDate(p.usedAt + "T00:00:00")}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-[hsl(var(--muted-foreground))]">
                  {p.eventTitle
                    ? `Event: ${p.eventTitle}`
                    : p.setlistName
                      ? `Setlist: ${p.setlistName}`
                      : p.notes || "Logged manually"}
                </span>
                {p.eventId && (
                  <Link to={`/setlists/events/${p.eventId}`} className="link-accent shrink-0 text-xs">
                    View event
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Set lists containing the song */}
      <section className="space-y-2">
        <h4 className="section-title">
          <ListMusic className="section-title-icon" /> Currently in
        </h4>
        {containing.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Not in any set list yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {containing.map((setlist) => (
              <Link key={setlist.id} to={`/setlists/${setlist.id}`} className="badge badge-muted hover:bg-[hsl(var(--muted))]">
                {setlist.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Play log */}
      <section className="space-y-2">
        <h4 className="section-title">
          <TrendingUp className="section-title-icon" /> Play log
        </h4>
        {usages.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Plays are logged when an event with this song is marked completed.
          </p>
        ) : (
          <div className="list-container">
            {usages.map((usage) => (
              <div key={usage.id} className="list-item text-sm">
                <CalendarDays className="h-3.5 w-3.5 text-[hsl(var(--secondary))] shrink-0" />
                <span className="font-medium">
                  {new Date(usage.usedAt + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                </span>
                {usage.notes && <span className="text-xs text-[hsl(var(--muted-foreground))] truncate">{usage.notes}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Edit history */}
      <section className="space-y-2">
        <h4 className="section-title">
          <History className="section-title-icon" /> Edit history
        </h4>
        {edits.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No edits recorded yet.</p>
        ) : (
          <div className="list-container">
            {edits.map((edit) => (
              <div key={edit.id} className="list-item text-sm">
                <span className="badge badge-muted shrink-0">{edit.field}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-[hsl(var(--muted-foreground))]">
                  {edit.oldValue ? `${String(edit.oldValue).slice(0, 40)} → ` : ""}
                  {String(edit.newValue ?? "").slice(0, 60) || "—"}
                </span>
                <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">
                  {edit.createdAt ? new Date(edit.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
