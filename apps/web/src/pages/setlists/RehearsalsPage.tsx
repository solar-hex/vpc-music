import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { rehearsalsApi, eventsApi, setlistsApi, type Rehearsal, type Event, type Setlist } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Mic2, Plus, Pencil, Trash2, X, ListMusic, CalendarDays } from "lucide-react";

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RehearsalFormDialog({
  rehearsal,
  initialDate,
  onClose,
  onSaved,
}: {
  rehearsal: Rehearsal | null;
  /** Prefill for create mode (ISO-ish local datetime) */
  initialDate?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(
    rehearsal ? toLocalInputValue(rehearsal.rehearsalDate) : initialDate ? toLocalInputValue(initialDate) : "",
  );
  const [location, setLocation] = useState(rehearsal?.location ?? "");
  const [notes, setNotes] = useState(rehearsal?.notes ?? "");
  const [eventId, setEventId] = useState(rehearsal?.eventId ?? "");
  const [setlistId, setSetlistId] = useState(rehearsal?.setlistId ?? "");
  const [events, setEvents] = useState<Event[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    eventsApi.list({ upcoming: false }).then((res) => setEvents(res.events)).catch(() => {});
    setlistsApi.list({ view: "active" }).then((res) => setSetlists(res.setlists)).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      toast.error("A date is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        rehearsalDate: new Date(date).toISOString(),
        location: location.trim() || null,
        notes: notes.trim() || null,
        eventId: eventId || null,
        setlistId: setlistId || null,
      };
      if (rehearsal) {
        await rehearsalsApi.update(rehearsal.id, payload);
        toast.success("Rehearsal updated");
      } else {
        await rehearsalsApi.create(payload);
        toast.success("Rehearsal scheduled");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save rehearsal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="rehearsal-form-title">
      <form onSubmit={handleSubmit} className="modal-content max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 id="rehearsal-form-title" className="text-lg font-brand">
            {rehearsal ? "Edit rehearsal" : "New rehearsal"}
          </h3>
          <button type="button" onClick={onClose} disabled={saving} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="space-y-2 block">
          <span className="text-sm font-medium">Date &amp; time *</span>
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="input w-full" disabled={saving} autoFocus />
        </label>
        <label className="space-y-2 block">
          <span className="text-sm font-medium">Location</span>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="input w-full" placeholder="Practice room" disabled={saving} />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-2 block">
            <span className="text-sm font-medium">For event</span>
            <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="input w-full" disabled={saving}>
              <option value="">—</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 block">
            <span className="text-sm font-medium">Set list</span>
            <select value={setlistId} onChange={(e) => setSetlistId(e.target.value)} className="input w-full" disabled={saving}>
              <option value="">—</option>
              {setlists.map((setlist) => (
                <option key={setlist.id} value={setlist.id}>
                  {setlist.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="space-y-2 block">
          <span className="text-sm font-medium">Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input w-full min-h-[60px]" placeholder="Focus areas, arrivals…" disabled={saving} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="btn-outline btn-sm">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary btn-sm">
            {saving ? "Saving..." : rehearsal ? "Save" : "Schedule"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Set Lists → Rehearsals: list, optionally tied to events and set lists. */
export function RehearsalsPage() {
  const { user, activeOrg } = useAuth();
  const canEdit = user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician";
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [loading, setLoading] = useState(true);
  const [formRehearsal, setFormRehearsal] = useState<Rehearsal | null | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<Rehearsal | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = () => {
    rehearsalsApi
      .list()
      .then((res) => setRehearsals(res.rehearsals))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await rehearsalsApi.delete(pendingDelete.id);
      setRehearsals((prev) => prev.filter((r) => r.id !== pendingDelete.id));
      toast.success("Rehearsal deleted");
      setPendingDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h3 className="section-title">
          <Mic2 className="section-title-icon" /> Rehearsals
        </h3>
        {canEdit && (
          <button onClick={() => setFormRehearsal(null)} className="btn-primary btn-sm">
            <Plus className="h-4 w-4" /> New rehearsal
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : rehearsals.length === 0 ? (
        <div className="card-empty">
          <Mic2 className="mx-auto h-10 w-10 text-[hsl(var(--muted-foreground))] mb-2" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Rehearsals keep prep visible — tie each one to an event and a set list.
          </p>
          {canEdit && (
            <button onClick={() => setFormRehearsal(null)} className="btn-primary mt-4">
              <Plus className="h-4 w-4" /> Schedule rehearsal
            </button>
          )}
        </div>
      ) : (
        <div className="list-container">
          {rehearsals.map((rehearsal) => (
            <div key={rehearsal.id} className="list-item">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {new Date(rehearsal.rehearsalDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  {rehearsal.location && <span className="text-[hsl(var(--muted-foreground))]"> · {rehearsal.location}</span>}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-[hsl(var(--muted-foreground))]">
                  {rehearsal.eventId && (
                    <Link to={`/setlists/events/${rehearsal.eventId}`} className="inline-flex items-center gap-1 hover:text-[hsl(var(--secondary))]">
                      <CalendarDays className="h-3 w-3" /> {rehearsal.eventTitle}
                    </Link>
                  )}
                  {rehearsal.setlistId && (
                    <Link to={`/setlists/${rehearsal.setlistId}`} className="inline-flex items-center gap-1 hover:text-[hsl(var(--secondary))]">
                      <ListMusic className="h-3 w-3" /> {rehearsal.setlistName}
                    </Link>
                  )}
                  {rehearsal.notes && <span className="truncate max-w-[280px]">{rehearsal.notes}</span>}
                </div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setFormRehearsal(rehearsal)} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" title="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setPendingDelete(rehearsal)} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {formRehearsal !== undefined && (
        <RehearsalFormDialog rehearsal={formRehearsal} onClose={() => setFormRehearsal(undefined)} onSaved={refresh} />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this rehearsal?"
        description="Linked events and set lists stay untouched."
        confirmLabel="Delete rehearsal"
        busy={deleting}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
