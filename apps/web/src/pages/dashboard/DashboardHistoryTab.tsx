import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { eventsApi, setlistsApi, type Event, type SetlistSongItem } from "@/lib/api-client";
import { History, ChevronDown, MapPin, ListMusic } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

/** Dashboard → Event history: completed events, expandable to their set list. */
export function DashboardHistoryTab() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [setlistCache, setSetlistCache] = useState<Record<string, SetlistSongItem[]>>({});

  useEffect(() => {
    eventsApi
      .list({ upcoming: false, status: "completed" })
      .then((res) => setEvents(res.events))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = async (event: Event) => {
    const next = expandedId === event.id ? null : event.id;
    setExpandedId(next);
    if (next && event.setlistId && !setlistCache[event.setlistId]) {
      try {
        const res = await setlistsApi.get(event.setlistId);
        setSetlistCache((prev) => ({ ...prev, [event.setlistId!]: res.songs }));
      } catch {
        // Expansion just shows "unavailable"
      }
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="section-title">
        <History className="section-title-icon" /> Event History
      </h3>

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={History}
          message="Completed events land here. Mark an event completed to start the record."
          action={
            <Link to="/setlists/schedule" className="btn-primary">
              View events
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {events.map((event) => {
            const expanded = expandedId === event.id;
            const items = event.setlistId ? setlistCache[event.setlistId] : undefined;
            return (
              <div key={event.id} className="card">
                <button
                  onClick={() => void toggleExpand(event)}
                  className="card-body w-full flex items-center gap-3 text-left"
                  aria-expanded={expanded}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{event.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-[hsl(var(--muted-foreground))]">
                      <span>
                        {new Date(event.date).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                      </span>
                      {event.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {event.location}
                        </span>
                      )}
                      {event.setlistName && (
                        <span className="inline-flex items-center gap-1">
                          <ListMusic className="h-3 w-3" /> {event.setlistName} · {event.songCount ?? 0} songs
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>

                {expanded && (
                  <div className="border-t border-[hsl(var(--border))] px-4 py-3">
                    {!event.setlistId ? (
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">No set list was attached to this event.</p>
                    ) : !items ? (
                      <div className="flex justify-center py-3"><div className="spinner" /></div>
                    ) : (
                      <ol className="space-y-1">
                        {items.map((item, index) => (
                          <li key={item.id} className="flex items-center gap-3 text-sm">
                            <span className="w-6 text-right text-xs text-[hsl(var(--muted-foreground))]">{index + 1}.</span>
                            {item.songId ? (
                              <Link to={`/songs/${item.songId}`} className="hover:text-[hsl(var(--secondary))]">
                                {item.songTitle}
                              </Link>
                            ) : (
                              <span className="text-[hsl(var(--muted-foreground))]">{item.slotLabel || "Empty slot"}</span>
                            )}
                            {(item.key || item.songKey) && <span className="badge-key">{item.key || item.songKey}</span>}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
