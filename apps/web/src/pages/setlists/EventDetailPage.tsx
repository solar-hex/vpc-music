import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  eventsApi,
  setlistsApi,
  rehearsalsApi,
  type Event,
  type SetlistSongItem,
  type Rehearsal,
} from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { EventFormDialog } from "@/components/dashboard/EventFormDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { eventStatusBadge } from "./EventsPage";
import { ArrowLeft, CalendarDays, MapPin, Users, ListMusic, CheckCircle2, Ban, Pencil, Mic2 } from "lucide-react";

/** Event detail: everything about the event, its set list, rehearsals, and completion. */
export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, activeOrg } = useAuth();
  const canEdit = user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician";

  const [event, setEvent] = useState<Event | null>(null);
  const [items, setItems] = useState<SetlistSongItem[]>([]);
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [completing, setCompleting] = useState(false);

  const load = async () => {
    if (!id) return;
    try {
      const res = await eventsApi.get(id);
      setEvent(res.event);
      if (res.event.setlistId) {
        const setlistRes = await setlistsApi.get(res.event.setlistId).catch(() => null);
        setItems(setlistRes?.songs ?? []);
      } else {
        setItems([]);
      }
      const rehearsalRes = await rehearsalsApi.list().catch(() => ({ rehearsals: [] as Rehearsal[] }));
      setRehearsals(rehearsalRes.rehearsals.filter((rehearsal) => rehearsal.eventId === id));
    } catch {
      toast.error("Event not found");
      navigate("/setlists/events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleComplete = async () => {
    if (!id) return;
    setCompleting(true);
    try {
      const res = await eventsApi.complete(id);
      toast.success(
        res.playsLogged > 0
          ? `Event completed — logged ${res.playsLogged} song play${res.playsLogged !== 1 ? "s" : ""}`
          : "Event completed",
      );
      setConfirmComplete(false);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete event");
    } finally {
      setCompleting(false);
    }
  };

  const handleCancelToggle = async () => {
    if (!id || !event) return;
    const next = event.status === "cancelled" ? "scheduled" : "cancelled";
    try {
      await eventsApi.setStatus(id, next);
      toast.success(next === "cancelled" ? "Event cancelled" : "Event restored to scheduled");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to update event");
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="spinner" /></div>;
  }
  if (!event) return null;

  return (
    <div className="space-y-6">
      <Link to="/setlists/events" className="link-accent inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="h-4 w-4" /> All events
      </Link>

      <div className="page-header">
        <div className="space-y-1 min-w-0">
          <h2 className="page-title flex flex-wrap items-center gap-2">
            {event.title}
            {eventStatusBadge(event.status)}
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[hsl(var(--muted-foreground))]">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-[hsl(var(--secondary))]" />
              {new Date(event.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
            {event.eventType && <span>{event.eventType}</span>}
            {event.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-[hsl(var(--secondary))]" /> {event.location}
              </span>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setFormOpen(true)} className="btn-outline btn-sm">
              <Pencil className="h-4 w-4" /> Edit
            </button>
            {event.status !== "completed" && (
              <>
                <button onClick={handleCancelToggle} className="btn-outline btn-sm">
                  <Ban className="h-4 w-4" /> {event.status === "cancelled" ? "Restore" : "Cancel"}
                </button>
                <button onClick={() => setConfirmComplete(true)} className="btn-primary btn-sm">
                  <CheckCircle2 className="h-4 w-4" /> Mark completed
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Team */}
      {event.team && event.team.length > 0 && (
        <section className="space-y-2">
          <h3 className="section-title">
            <Users className="section-title-icon" /> Team
          </h3>
          <div className="flex flex-wrap gap-2">
            {event.team.map((member, index) => (
              <span key={`${member.name}-${index}`} className="badge badge-muted">
                {member.name}
                {member.role && <span className="opacity-70"> · {member.role}</span>}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Set list */}
      <section className="space-y-2">
        <div className="section-header">
          <h3 className="section-title">
            <ListMusic className="section-title-icon" /> Set list
          </h3>
          {event.setlistId && (
            <Link to={`/setlists/${event.setlistId}`} className="link-accent text-sm">
              Open in builder
            </Link>
          )}
        </div>
        {!event.setlistId ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No set list attached yet.{canEdit ? " Edit the event to link one." : ""}
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">"{event.setlistName}" has no songs yet.</p>
        ) : (
          <ol className="list-container">
            {items.map((item, index) => (
              <li key={item.id} className="list-item">
                <span className="w-6 text-right text-xs text-[hsl(var(--muted-foreground))]">{index + 1}.</span>
                {item.songId ? (
                  <Link to={`/songs/${item.songId}`} className="flex-1 truncate text-sm font-medium hover:text-[hsl(var(--secondary))]">
                    {item.songTitle}
                  </Link>
                ) : (
                  <span className="flex-1 text-sm text-[hsl(var(--muted-foreground))]">{item.slotLabel || "Empty slot"}</span>
                )}
                {(item.key || item.songKey) && <span className="badge-key">{item.key || item.songKey}</span>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Rehearsals */}
      <section className="space-y-2">
        <div className="section-header">
          <h3 className="section-title">
            <Mic2 className="section-title-icon" /> Rehearsals
          </h3>
          <Link to="/setlists/rehearsals" className="link-accent text-sm">
            All rehearsals
          </Link>
        </div>
        {rehearsals.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No rehearsals linked to this event.</p>
        ) : (
          <div className="list-container">
            {rehearsals.map((rehearsal) => (
              <div key={rehearsal.id} className="list-item text-sm">
                <span className="flex-1">
                  {new Date(rehearsal.rehearsalDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  {rehearsal.location && <span className="text-[hsl(var(--muted-foreground))]"> · {rehearsal.location}</span>}
                </span>
                {rehearsal.notes && <span className="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-[200px]">{rehearsal.notes}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Notes */}
      {event.notes && (
        <section className="card card-body">
          <p className="text-xs uppercase font-semibold text-[hsl(var(--muted-foreground))] mb-1">Notes</p>
          <p className="text-sm whitespace-pre-wrap">{event.notes}</p>
        </section>
      )}

      <EventFormDialog open={formOpen} event={event} onClose={() => setFormOpen(false)} onSaved={load} />

      <ConfirmDialog
        open={confirmComplete}
        title={`Mark "${event.title}" completed?`}
        description={
          event.setlistId
            ? `This logs a play for every song in "${event.setlistName}" and marks the set list complete.`
            : "No set list is attached, so no plays will be logged."
        }
        confirmLabel="Mark completed"
        busy={completing}
        onClose={() => {
          if (!completing) setConfirmComplete(false);
        }}
        onConfirm={handleComplete}
      />
    </div>
  );
}
