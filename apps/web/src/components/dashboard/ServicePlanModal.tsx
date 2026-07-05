import { Link } from "react-router-dom";
import { X, CalendarDays, MapPin, Music, Users, ListMusic, Pencil } from "lucide-react";
import type { Event } from "@/lib/api-client";

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}

/**
 * Service plan detail modal — a richer read view of an Event (date, theme,
 * team, linked setlist) styled after the prototype's plan modal.
 */
export function ServicePlanModal({
  event,
  onClose,
  canEdit,
  onEdit,
}: {
  event: Event | null;
  onClose: () => void;
  canEdit: boolean;
  onEdit: (event: Event) => void;
}) {
  if (!event) return null;

  const { date, time } = formatDateTime(event.date);
  const isPast = new Date(event.date).getTime() < Date.now();
  const status = event.setlistStatus === "complete" || isPast ? "Completed" : "Upcoming";

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="service-plan-title">
      <div className="modal-content max-w-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`h-2.5 w-2.5 rounded-full ${status === "Upcoming" ? "bg-amber-400" : "bg-emerald-400"}`}
                aria-hidden="true"
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                {status}
              </span>
            </div>
            <h2 id="service-plan-title" className="text-xl font-semibold text-[hsl(var(--foreground))] truncate">
              {event.title}
            </h2>
            {event.theme && <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{event.theme}</p>}
          </div>
          <button
            onClick={onClose}
            className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] shrink-0"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Detail grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="card card-body">
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays className="h-4 w-4 text-[hsl(var(--secondary))]" />
              <span className="text-xs uppercase font-semibold text-[hsl(var(--muted-foreground))]">Date &amp; Time</span>
            </div>
            <p className="text-sm font-medium">{date}</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{time}</p>
          </div>
          <div className="card card-body">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="h-4 w-4 text-[hsl(var(--secondary))]" />
              <span className="text-xs uppercase font-semibold text-[hsl(var(--muted-foreground))]">Location</span>
            </div>
            <p className="text-sm font-medium">{event.location || "—"}</p>
          </div>
          <div className="card card-body">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-[hsl(var(--secondary))]" />
              <span className="text-xs uppercase font-semibold text-[hsl(var(--muted-foreground))]">Prepared By</span>
            </div>
            <p className="text-sm font-medium">{event.preparedByName || "—"}</p>
          </div>
          <div className="card card-body">
            <div className="flex items-center gap-2 mb-1">
              <Music className="h-4 w-4 text-[hsl(var(--secondary))]" />
              <span className="text-xs uppercase font-semibold text-[hsl(var(--muted-foreground))]">Setlist</span>
            </div>
            {event.setlistId ? (
              <p className="text-sm font-medium">
                {event.setlistName}
                <span className="text-[hsl(var(--muted-foreground))]"> · {event.songCount ?? 0} songs</span>
              </p>
            ) : (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No setlist linked</p>
            )}
          </div>
        </div>

        {/* Team */}
        {event.team && event.team.length > 0 && (
          <div>
            <p className="text-xs uppercase font-semibold text-[hsl(var(--muted-foreground))] mb-2">Team</p>
            <div className="flex flex-wrap gap-2">
              {event.team.map((member, i) => (
                <span key={`${member.name}-${i}`} className="badge badge-muted">
                  {member.name}
                  {member.role && <span className="opacity-70"> · {member.role}</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {event.notes && (
          <div className="card card-body">
            <p className="text-xs uppercase font-semibold text-[hsl(var(--muted-foreground))] mb-1">Planning Notes</p>
            <p className="text-sm whitespace-pre-wrap">{event.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          {canEdit && (
            <button onClick={() => onEdit(event)} className="btn-outline btn-sm">
              <Pencil className="h-4 w-4" /> Edit plan
            </button>
          )}
          {event.setlistId && (
            <Link to={`/setlists/${event.setlistId}`} className="btn-primary btn-sm" onClick={onClose}>
              <ListMusic className="h-4 w-4" /> Open setlist
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
