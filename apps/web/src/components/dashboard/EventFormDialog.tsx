import { useState, useEffect } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import {
  eventsApi,
  orgsApi,
  setlistsApi,
  type Event,
  type EventTeamMember,
  type OrgMember,
  type Setlist,
} from "@/lib/api-client";
import { toLocalInputValue } from "@/lib/format";


/**
 * Create/edit dialog for events (service plans): title, date/time, location,
 * theme, prepared-by, team assignments, linked setlist, and notes.
 */
export function EventFormDialog({
  open,
  event,
  creatingFromDate = false,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** When set, the dialog edits this event; otherwise it creates a new one. */
  event?: Event | null;
  /** Treat `event` as initial values only (create mode with a prefilled date). */
  creatingFromDate?: boolean;
  onClose: () => void;
  onSaved: (event: Event) => void;
}) {
  const isEditing = Boolean(event && !creatingFromDate);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [theme, setTheme] = useState("");
  const [eventType, setEventType] = useState("");
  const [slotMinutes, setSlotMinutes] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [setlistId, setSetlistId] = useState("");
  const [notes, setNotes] = useState("");
  const [team, setTeam] = useState<EventTeamMember[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    // Seed form from the event being edited (or reset for create)
    setTitle(event?.title ?? "");
    setDate(event?.date ? toLocalInputValue(event.date) : "");
    setLocation(event?.location ?? "");
    setTheme(event?.theme ?? "");
    setEventType(event?.eventType ?? "");
    setSlotMinutes(event?.targetSeconds ? String(Math.round(event.targetSeconds / 60)) : "");
    setPreparedBy(event?.preparedBy ?? "");
    setSetlistId(event?.setlistId ?? "");
    setNotes(event?.notes ?? "");
    setTeam(event?.team ?? []);
    setSaving(false);

    orgsApi
      .members()
      .then((res) => setMembers(res.members))
      .catch(() => setMembers([]));
    setlistsApi
      .list()
      .then((res) => setSetlists(res.setlists))
      .catch(() => setSetlists([]));
  }, [open, event]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, saving, onClose]);

  if (!open) return null;

  const toggleTeamMember = (member: OrgMember) => {
    setTeam((prev) => {
      const existing = prev.find((t) => t.userId === member.userId);
      if (existing) return prev.filter((t) => t.userId !== member.userId);
      return [...prev, { userId: member.userId, name: member.displayName || "Member" }];
    });
  };

  const setTeamRole = (userId: string | undefined, role: string) => {
    setTeam((prev) => prev.map((t) => (t.userId === userId ? { ...t, role } : t)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) {
      toast.error("Title and date are required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        date: new Date(date).toISOString(),
        location: location.trim() || null,
        theme: theme.trim() || null,
        eventType: eventType.trim() || null,
        targetSeconds: /^\d+$/.test(slotMinutes) ? Number(slotMinutes) * 60 : null,
        preparedBy: preparedBy || null,
        setlistId: setlistId || null,
        notes: notes.trim() || null,
        team,
      };
      const res = isEditing && event
        ? await eventsApi.update(event.id, payload)
        : await eventsApi.create(payload);
      toast.success(isEditing ? "Plan updated" : "Plan created");
      onSaved(res.event);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save plan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="event-form-title">
      <div className="modal-content max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h2 id="event-form-title" className="text-lg font-semibold text-[hsl(var(--foreground))]">
              {isEditing ? "Edit plan" : "New plan"}
            </h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Schedule a service or rehearsal and link a setlist.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="space-y-2 block">
            <span className="text-sm font-medium text-[hsl(var(--foreground))]">Title *</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sunday Morning Worship"
              className="input w-full"
              disabled={saving}
              autoFocus
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-2 block">
              <span className="text-sm font-medium text-[hsl(var(--foreground))]">Date &amp; time *</span>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input w-full"
                disabled={saving}
              />
            </label>
            <label className="space-y-2 block">
              <span className="text-sm font-medium text-[hsl(var(--foreground))]">Location</span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Main Sanctuary"
                className="input w-full"
                disabled={saving}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-2 block">
              <span className="text-sm font-medium text-[hsl(var(--foreground))]">Type</span>
              <input
                type="text"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                placeholder="Service, Concert, Wedding…"
                className="input w-full"
                disabled={saving}
                list="event-type-suggestions"
              />
              <datalist id="event-type-suggestions">
                <option value="Service" />
                <option value="Concert" />
                <option value="Wedding" />
                <option value="Special Event" />
              </datalist>
            </label>
            <label className="space-y-2 block">
              <span className="text-sm font-medium text-[hsl(var(--foreground))]">Theme</span>
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="Gratitude"
                className="input w-full"
                disabled={saving}
              />
            </label>
            <label className="space-y-2 block">
              <span className="text-sm font-medium text-[hsl(var(--foreground))]">Prepared by</span>
              <select
                value={preparedBy}
                onChange={(e) => setPreparedBy(e.target.value)}
                className="input w-full"
                disabled={saving}
              >
                <option value="">—</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.displayName || m.userId}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-2 block">
            <span className="text-sm font-medium text-[hsl(var(--foreground))]">Music slot (minutes)</span>
            <input
              type="number"
              min="1"
              value={slotMinutes}
              onChange={(e) => setSlotMinutes(e.target.value)}
              placeholder="e.g. 45"
              className="input w-full"
              disabled={saving}
            />
            <span className="block text-xs text-[hsl(var(--muted-foreground))]">
              The set list builder checks its total (with gaps) against this.
            </span>
          </label>

          <label className="space-y-2 block">
            <span className="text-sm font-medium text-[hsl(var(--foreground))]">Linked setlist</span>
            <select
              value={setlistId}
              onChange={(e) => setSetlistId(e.target.value)}
              className="input w-full"
              disabled={saving}
            >
              <option value="">No setlist</option>
              {setlists.map((sl) => (
                <option key={sl.id} value={sl.id}>
                  {sl.name}
                </option>
              ))}
            </select>
          </label>

          {members.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm font-medium text-[hsl(var(--foreground))]">Team</span>
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => {
                  const selected = team.some((t) => t.userId === m.userId);
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => toggleTeamMember(m)}
                      disabled={saving}
                      className={`badge cursor-pointer transition-colors ${
                        selected
                          ? "bg-[hsl(var(--secondary))]/20 text-[hsl(var(--secondary))]"
                          : "badge-muted hover:bg-[hsl(var(--muted))]"
                      }`}
                      aria-pressed={selected}
                    >
                      {m.displayName || "Member"}
                    </button>
                  );
                })}
              </div>
              {team.length > 0 && (
                <div className="space-y-1.5">
                  {team.map((t) => (
                    <div key={t.userId ?? t.name} className="flex items-center gap-2">
                      <span className="text-xs w-32 truncate text-[hsl(var(--muted-foreground))]">{t.name}</span>
                      <input
                        type="text"
                        value={t.role ?? ""}
                        onChange={(e) => setTeamRole(t.userId, e.target.value)}
                        placeholder="Role (e.g. Vocals)"
                        className="input flex-1 text-xs py-1"
                        disabled={saving}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <label className="space-y-2 block">
            <span className="text-sm font-medium text-[hsl(var(--foreground))]">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Planning notes…"
              className="input w-full min-h-[70px]"
              disabled={saving}
            />
          </label>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={saving} className="btn-outline btn-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving || !title.trim() || !date} className="btn-primary btn-sm">
              {saving ? "Saving..." : event ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
