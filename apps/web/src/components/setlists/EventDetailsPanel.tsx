import { Link } from "react-router-dom";
import {
  CalendarDays,
  Clock,
  MapPin,
  Users,
  ListMusic,
  FileText,
  Tag,
  Pencil,
  Copy,
  Trash2,
  X,
  ExternalLink,
  UserCheck,
} from "lucide-react";
import type { Event } from "@/lib/api-client";
import { formatEventDateTime, formatDuration } from "@/lib/format";

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-[hsl(var(--secondary))]/15 text-[hsl(var(--secondary))]",
  completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  cancelled: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] line-through",
};

function DetailRow({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{label}</p>
        <div className="text-sm text-[hsl(var(--foreground))]">{children}</div>
      </div>
    </div>
  );
}

/**
 * Event details for the calendar's split view (desktop) and bottom sheet
 * (mobile). Purely presentational: sticky header, scrollable body, sticky
 * action footer. The host owns selection, data, and the action handlers.
 */
export function EventDetailsPanel({
  event,
  canEdit,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  event: Event;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="event-details-panel">
      {/* Sticky header */}
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[hsl(var(--border))] p-5">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-brand text-[hsl(var(--foreground))]" title={event.title}>
            {event.title}
          </h3>
          {event.status && (
            <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_STYLES[event.status] ?? ""}`}>
              {event.status}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canEdit && (
            <button onClick={onEdit} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" aria-label="Edit event">
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <button onClick={onClose} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" aria-label="Close details panel">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <DetailRow icon={CalendarDays} label="Date & time">
          {formatEventDateTime(event.date)}
        </DetailRow>

        {typeof event.targetSeconds === "number" && event.targetSeconds > 0 && (
          <DetailRow icon={Clock} label="Music slot">
            {formatDuration(event.targetSeconds)}
          </DetailRow>
        )}

        {event.location && (
          <DetailRow icon={MapPin} label="Location">
            {event.location}
          </DetailRow>
        )}

        {(event.eventType || event.theme) && (
          <DetailRow icon={Tag} label="Type & theme">
            <div className="flex flex-wrap gap-1.5">
              {event.eventType && <span className="badge badge-muted">{event.eventType}</span>}
              {event.theme && <span className="badge bg-[hsl(var(--secondary))]/15 text-[hsl(var(--secondary))]">{event.theme}</span>}
            </div>
          </DetailRow>
        )}

        {event.preparedByName && (
          <DetailRow icon={UserCheck} label="Prepared by">
            {event.preparedByName}
          </DetailRow>
        )}

        {(event.team?.length ?? 0) > 0 && (
          <DetailRow icon={Users} label="Team">
            <ul className="space-y-1">
              {event.team!.map((member, i) => (
                <li key={member.userId ?? i} className="flex items-baseline justify-between gap-2">
                  <span className="truncate">{member.name}</span>
                  {member.role && <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">{member.role}</span>}
                </li>
              ))}
            </ul>
          </DetailRow>
        )}

        {event.setlistId && (
          <DetailRow icon={ListMusic} label="Set list">
            <Link to={`/setlists/${event.setlistId}`} className="text-[hsl(var(--secondary))] hover:underline">
              {event.setlistName ?? "View set list"}
            </Link>
            {typeof event.songCount === "number" && (
              <span className="ml-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                · {event.songCount} song{event.songCount === 1 ? "" : "s"}
              </span>
            )}
          </DetailRow>
        )}

        {event.notes && (
          <DetailRow icon={FileText} label="Notes">
            <p className="whitespace-pre-wrap">{event.notes}</p>
          </DetailRow>
        )}

        <Link
          to={`/setlists/events/${event.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open full event page
        </Link>
      </div>

      {/* Sticky action footer */}
      {canEdit && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[hsl(var(--border))] p-4">
          <button onClick={onEdit} className="btn-primary btn-sm inline-flex items-center gap-1.5">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button onClick={onDuplicate} className="btn-outline btn-sm inline-flex items-center gap-1.5">
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </button>
          <button
            onClick={onDelete}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--destructive))]/40 px-2.5 py-1.5 text-xs font-medium text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
