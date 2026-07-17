import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Save, Trash2, X, Drum, CheckCircle2, Ban } from "lucide-react";
import {
  eventsApi,
  orgsApi,
  setlistsApi,
  type Event,
  type EventTeamMember,
  type OrgMember,
  type Rehearsal,
  type Setlist,
} from "@/lib/api-client";
import { toLocalInputValue, formatShortDate } from "@/lib/format";

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-[hsl(var(--secondary))]/15 text-[hsl(var(--secondary))]",
  completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  cancelled: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] line-through",
};

interface FormValues {
  title: string;
  date: string; // datetime-local value
  location: string;
  eventType: string;
  theme: string;
  preparedBy: string;
  slotMinutes: string;
  setlistId: string;
  notes: string;
  team: EventTeamMember[];
}

function toFormValues(event: Event): FormValues {
  return {
    title: event.title ?? "",
    date: event.date ? toLocalInputValue(event.date) : "",
    location: event.location ?? "",
    eventType: event.eventType ?? "",
    theme: event.theme ?? "",
    preparedBy: event.preparedBy ?? "",
    slotMinutes: event.targetSeconds ? String(Math.round(event.targetSeconds / 60)) : "",
    setlistId: event.setlistId ?? "",
    notes: event.notes ?? "",
    team: event.team ?? [],
  };
}

/**
 * The calendar's split-view editor: the form IS the event details — no
 * details page, no stacked edit modal. Owns its form state and reports
 * dirtiness up so the host can guard event-switch/close against unsaved
 * changes. Cmd/Ctrl+S saves.
 */
export function EventEditPanel({
  event,
  rehearsals = [],
  canEdit,
  onDirtyChange,
  onRequestClose,
  onSaved,
  onRequestDelete,
  onRequestComplete,
  onToggleCancelled,
}: {
  event: Event;
  /** Rehearsals linked to this event (read-only context). */
  rehearsals?: Rehearsal[];
  canEdit: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onRequestClose: () => void;
  onSaved: (event: Event) => void;
  onRequestDelete: () => void;
  /** Mark-completed flow (host confirms first — it logs song plays). */
  onRequestComplete: () => void;
  /** Toggle cancelled ↔ scheduled. */
  onToggleCancelled: () => void;
}) {
  const [values, setValues] = useState<FormValues>(() => toFormValues(event));
  const [dirty, setDirty] = useState(false);
  // Ref mirror of `dirty` — the reseed effect must see the *current* flag,
  // not a render-time closure, or a detail fetch landing mid-edit wipes input.
  const dirtyRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const seededIdRef = useRef(event.id);

  // Reseed the form when the selection changes, or when fresher data for the
  // same event arrives (detail fetch, post-save) and the user hasn't typed.
  useEffect(() => {
    if (event.id !== seededIdRef.current || !dirtyRef.current) {
      seededIdRef.current = event.id;
      setValues(toFormValues(event));
      setDirty(false);
      dirtyRef.current = false;
      onDirtyChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  useEffect(() => {
    orgsApi
      .members()
      .then((res) => setMembers(res.members))
      .catch(() => setMembers([]));
    setlistsApi
      .list()
      .then((res) => setSetlists(res.setlists))
      .catch(() => setSetlists([]));
  }, []);

  const setField = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      setDirty(true);
      onDirtyChange(true);
    }
  };

  const toggleTeamMember = (member: OrgMember) => {
    const existing = values.team.find((t) => t.userId === member.userId);
    setField(
      "team",
      existing
        ? values.team.filter((t) => t.userId !== member.userId)
        : [...values.team, { userId: member.userId, name: member.displayName || "Member" }],
    );
  };

  const handleSave = async () => {
    if (!canEdit || saving) return;
    if (!values.title.trim() || !values.date) {
      toast.error("Title and date are required");
      return;
    }
    setSaving(true);
    try {
      const res = await eventsApi.update(event.id, {
        title: values.title.trim(),
        date: new Date(values.date).toISOString(),
        location: values.location.trim() || null,
        theme: values.theme.trim() || null,
        eventType: values.eventType.trim() || null,
        targetSeconds: /^\d+$/.test(values.slotMinutes) ? Number(values.slotMinutes) * 60 : null,
        preparedBy: values.preparedBy || null,
        setlistId: values.setlistId || null,
        notes: values.notes.trim() || null,
        team: values.team,
      });
      setDirty(false);
      dirtyRef.current = false;
      onDirtyChange(false);
      onSaved(res.event);
      toast.success("Event saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save event");
    } finally {
      setSaving(false);
    }
  };

  // Cmd/Ctrl+S saves while the panel is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "s" || e.key === "S") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, canEdit, saving]);

  const disabled = !canEdit || saving;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="event-edit-panel">
      {/* Sticky header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[hsl(var(--border))] px-5 py-4">
        <h3 className="truncate text-base font-brand text-[hsl(var(--foreground))]" title={values.title}>
          {values.title || "Event"}
          {dirty && <span className="ml-1.5 align-middle text-[hsl(var(--secondary))]" title="Unsaved changes">•</span>}
        </h3>
        <button
          onClick={onRequestClose}
          className="btn-icon shrink-0 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable form body */}
      <form
        className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        {event.status && (
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_STYLES[event.status] ?? ""}`}>
              {event.status}
            </span>
            {canEdit && event.status !== "completed" && (
              <>
                <button type="button" onClick={onToggleCancelled} className="btn-outline btn-sm inline-flex items-center gap-1.5">
                  <Ban className="h-3.5 w-3.5" /> {event.status === "cancelled" ? "Restore" : "Cancel event"}
                </button>
                <button
                  type="button"
                  onClick={onRequestComplete}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark completed
                </button>
              </>
            )}
          </div>
        )}

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Title *</span>
          <input type="text" value={values.title} onChange={(e) => setField("title", e.target.value)} className="input w-full" disabled={disabled} />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Date &amp; time *</span>
          <input type="datetime-local" value={values.date} onChange={(e) => setField("date", e.target.value)} className="input w-full" disabled={disabled} />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Location</span>
          <input type="text" value={values.location} onChange={(e) => setField("location", e.target.value)} placeholder="Main Sanctuary" className="input w-full" disabled={disabled} />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Type</span>
            <input
              type="text"
              value={values.eventType}
              onChange={(e) => setField("eventType", e.target.value)}
              placeholder="Service, Concert…"
              className="input w-full"
              disabled={disabled}
              list="panel-event-type-suggestions"
            />
            <datalist id="panel-event-type-suggestions">
              <option value="Service" />
              <option value="Concert" />
              <option value="Wedding" />
              <option value="Special Event" />
            </datalist>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Theme</span>
            <input type="text" value={values.theme} onChange={(e) => setField("theme", e.target.value)} placeholder="Gratitude" className="input w-full" disabled={disabled} />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Prepared by</span>
            <select value={values.preparedBy} onChange={(e) => setField("preparedBy", e.target.value)} className="input w-full" disabled={disabled}>
              <option value="">—</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.displayName || m.userId}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Music slot (min)</span>
            <input type="number" min="1" value={values.slotMinutes} onChange={(e) => setField("slotMinutes", e.target.value)} placeholder="45" className="input w-full" disabled={disabled} />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Linked setlist</span>
          <select value={values.setlistId} onChange={(e) => setField("setlistId", e.target.value)} className="input w-full" disabled={disabled}>
            <option value="">No setlist</option>
            {setlists.map((sl) => (
              <option key={sl.id} value={sl.id}>
                {sl.name}
              </option>
            ))}
          </select>
        </label>

        {members.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Team</span>
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => {
                const selected = values.team.some((t) => t.userId === m.userId);
                return (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => toggleTeamMember(m)}
                    disabled={disabled}
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
            {values.team.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {values.team.map((t) => (
                  <div key={t.userId ?? t.name} className="flex items-center gap-2">
                    <span className="w-28 truncate text-xs text-[hsl(var(--muted-foreground))]">{t.name}</span>
                    <input
                      type="text"
                      value={t.role ?? ""}
                      onChange={(e) =>
                        setField(
                          "team",
                          values.team.map((tm) => (tm.userId === t.userId ? { ...tm, role: e.target.value } : tm)),
                        )
                      }
                      placeholder="Role (e.g. Vocals)"
                      className="input flex-1 py-1 text-xs"
                      disabled={disabled}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Notes</span>
          <textarea value={values.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Planning notes…" className="input min-h-[70px] w-full" disabled={disabled} />
        </label>

        {rehearsals.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Rehearsals</span>
            <ul className="space-y-1">
              {rehearsals.map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                  <Drum className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                  {formatShortDate(r.rehearsalDate)}
                  {r.setlistName ? ` · ${r.setlistName}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>

      {/* Sticky action footer */}
      {canEdit && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[hsl(var(--border))] p-4">
          <button onClick={() => void handleSave()} disabled={saving || !dirty} className="btn-primary btn-sm inline-flex items-center gap-1.5">
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save Changes"}
          </button>
          <button onClick={onRequestClose} disabled={saving} className="btn-outline btn-sm">
            Cancel
          </button>
          <button
            onClick={onRequestDelete}
            disabled={saving}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--destructive))]/40 px-2.5 py-1.5 text-xs font-medium text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete Event
          </button>
        </div>
      )}
    </div>
  );
}
