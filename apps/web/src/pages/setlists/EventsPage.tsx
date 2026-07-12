import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { eventsApi, type Event } from "@/lib/api-client";
import { formatEventDateTime } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { EventFormDialog } from "@/components/dashboard/EventFormDialog";
import { Calendar, Plus, MapPin, ListMusic, CheckCircle2, Ban } from "lucide-react";
import { CardGrid } from "@/components/shared/CardGrid";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge, type StatusVariant } from "@/components/shared/StatusBadge";

const EVENT_STATUS: Record<string, StatusVariant> = {
  completed: { label: "Completed", className: "badge-success", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", className: "badge badge-muted", icon: Ban },
};

export function eventStatusBadge(status?: Event["status"]) {
  const variant = (status && EVENT_STATUS[status]) || { label: "Scheduled", className: "badge badge-warning" };
  return <StatusBadge variant={variant} />;
}

/** Set Lists → Events: upcoming and past events with create/edit. */
export function EventsPage() {
  const { user, activeOrg } = useAuth();
  const canEdit = user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician";
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const refresh = () => {
    eventsApi
      .list({ upcoming: false })
      .then((res) => setEvents(res.events))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const upcomingEvents = events
      .filter((event) => new Date(event.date).getTime() >= now && event.status !== "completed")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const pastEvents = events
      .filter((event) => new Date(event.date).getTime() < now || event.status === "completed")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { upcoming: upcomingEvents, past: pastEvents };
  }, [events]);

  const renderEvent = (event: Event) => (
    <Link key={event.id} to={`/setlists/events/${event.id}`} className="card-interactive card-body block space-y-1">
      <div className="flex items-center gap-2">
        <span className="font-medium truncate">{event.title}</span>
        {eventStatusBadge(event.status)}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]">
        <span>
          {formatEventDateTime(event.date)}
        </span>
        {event.eventType && <span>{event.eventType}</span>}
        {event.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {event.location}
          </span>
        )}
        {event.setlistName && (
          <span className="inline-flex items-center gap-1">
            <ListMusic className="h-3 w-3" /> {event.setlistName}
          </span>
        )}
      </div>
    </Link>
  );

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h3 className="section-title">
          <Calendar className="section-title-icon" /> Events
        </h3>
        {canEdit && (
          <button
            onClick={() => {
              setEditingEvent(null);
              setFormOpen(true);
            }}
            className="btn-primary btn-sm"
          >
            <Plus className="h-4 w-4" /> New event
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={Calendar}
          message="Events tie a date, a venue, and a set list together."
          action={
            canEdit ? (
              <button onClick={() => setFormOpen(true)} className="btn-primary">
                <Plus className="h-4 w-4" /> Schedule event
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <section className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Upcoming</h4>
            {upcoming.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Nothing scheduled yet.</p>
            ) : (
              <CardGrid>{upcoming.map(renderEvent)}</CardGrid>
            )}
          </section>
          {past.length > 0 && (
            <section className="space-y-3">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Past</h4>
              <CardGrid>{past.map(renderEvent)}</CardGrid>
            </section>
          )}
        </>
      )}

      <EventFormDialog
        open={formOpen}
        event={editingEvent}
        onClose={() => setFormOpen(false)}
        onSaved={refresh}
      />
    </div>
  );
}
