import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { eventsApi, rehearsalsApi, type Event, type Rehearsal } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { EventFormDialog } from "@/components/dashboard/EventFormDialog";
import { EventEditPanel } from "@/components/setlists/EventEditPanel";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { RehearsalFormDialog } from "./RehearsalsPage";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toDateKey } from "@/lib/format";
import { toast } from "sonner";

const EVENT_DRAG_TYPE = "application/x-vpc-event";

/** md breakpoint — used to mount exactly one edit-panel instance (split view or sheet). */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window.matchMedia === "function" ? window.matchMedia("(min-width: 768px)").matches : true,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

/** Set Lists → Calendar: month view combining events and rehearsals. */
export function CalendarPage() {
  const { user, activeOrg } = useAuth();
  const canEdit = user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician";
  const [monthStart, setMonthStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [events, setEvents] = useState<Event[]>([]);
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [pickerDate, setPickerDate] = useState<string | null>(null); // date chosen for creation
  const [creating, setCreating] = useState<"event" | "rehearsal" | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  // Split-view edit panel: which event is open, plus its full detail
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [panelDirty, setPanelDirty] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: "select"; id: string } | { type: "close" } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isDesktop = useIsDesktop();

  const refresh = () => {
    eventsApi.list({ upcoming: false }).then((res) => setEvents(res.events)).catch(() => {});
    rehearsalsApi.list().then((res) => setRehearsals(res.rehearsals)).catch(() => {});
  };

  useEffect(() => {
    refresh();
  }, []);

  // Selecting an event seeds the panel from the list row instantly, then
  // upgrades to the full detail (joins: prepared-by name, set list, songs).
  useEffect(() => {
    if (!selectedId) return;
    const seed = events.find((ev) => ev.id === selectedId);
    if (seed) setSelectedEvent((cur) => (cur?.id === selectedId ? cur : seed));
    let cancelled = false;
    eventsApi
      .get(selectedId)
      .then((res) => {
        if (!cancelled) setSelectedEvent(res.event);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const closePanel = () => {
    setSelectedId(null);
    setSelectedEvent(null);
    setPanelDirty(false);
  };

  // Switching events or closing goes through these guards: unsaved edits
  // prompt a discard confirmation instead of being silently dropped.
  const requestSelect = (id: string) => {
    if (id === selectedId) return;
    if (panelDirty) setPendingAction({ type: "select", id });
    else setSelectedId(id);
  };

  const requestClose = () => {
    if (panelDirty) setPendingAction({ type: "close" });
    else closePanel();
  };

  const confirmDiscard = () => {
    setPanelDirty(false);
    if (pendingAction?.type === "select") setSelectedId(pendingAction.id);
    else if (pendingAction?.type === "close") closePanel();
    setPendingAction(null);
  };

  // Esc closes the panel — but only when no dialog is layered on top of it.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirmDelete && !creating && !pickerDate && !pendingAction) {
        requestClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, confirmDelete, creating, pickerDate, pendingAction, panelDirty]);

  const handleDelete = async () => {
    if (!selectedId) return;
    setDeleting(true);
    try {
      await eventsApi.delete(selectedId);
      toast.success("Event deleted");
      setConfirmDelete(false);
      closePanel();
      refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete event");
    } finally {
      setDeleting(false);
    }
  };

  const byDay = useMemo(() => {
    const map = new Map<string, { events: Event[]; rehearsals: Rehearsal[] }>();
    const bucket = (key: string) => {
      if (!map.has(key)) map.set(key, { events: [], rehearsals: [] });
      return map.get(key)!;
    };
    for (const event of events) bucket(toDateKey(new Date(event.date))).events.push(event);
    for (const rehearsal of rehearsals) bucket(toDateKey(new Date(rehearsal.rehearsalDate))).rehearsals.push(rehearsal);
    return map;
  }, [events, rehearsals]);

  const weeks = useMemo(() => {
    const firstDay = new Date(monthStart);
    const gridStart = new Date(firstDay);
    gridStart.setDate(1 - firstDay.getDay()); // back to Sunday
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + i);
      cells.push(day);
    }
    const grouped: Date[][] = [];
    for (let i = 0; i < 6; i++) grouped.push(cells.slice(i * 7, i * 7 + 7));
    return grouped;
  }, [monthStart]);

  const monthLabel = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const todayKey = toDateKey(new Date());

  const shiftMonth = (delta: number) => {
    setMonthStart((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  /** Drop an event chip onto a day: same wall-clock time, new date. Optimistic, reverts on failure. */
  const handleEventDrop = async (eventId: string, targetKey: string) => {
    const dragged = events.find((ev) => ev.id === eventId);
    if (!dragged || toDateKey(new Date(dragged.date)) === targetKey) return;
    const [year, month, day] = targetKey.split("-").map(Number);
    const moved = new Date(dragged.date);
    moved.setFullYear(year, month - 1, day);
    const iso = moved.toISOString();
    const previous = events;
    setEvents((cur) => cur.map((ev) => (ev.id === eventId ? { ...ev, date: iso } : ev)));
    try {
      await eventsApi.update(eventId, { date: iso });
      toast.success(
        `Moved "${dragged.title}" to ${moved.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`,
      );
    } catch (err: any) {
      setEvents(previous);
      toast.error(err.message || "Failed to move event");
    }
  };

  const initialDateTime = pickerDate ? `${pickerDate}T10:00:00` : undefined;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h3 className="section-title">
          <CalendarDays className="section-title-icon" /> Calendar
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMonth(-1)} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))]" aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium min-w-[140px] text-center">{monthLabel}</span>
          <button onClick={() => shiftMonth(1)} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))]" aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="md:flex md:items-start">
        {/* Split-view details panel — slides in from the left, pushing the calendar right */}
        <div
          aria-hidden={!selectedEvent}
          className={`hidden md:block shrink-0 self-start overflow-hidden rounded-lg bg-[hsl(var(--card))] transition-all duration-300 ease-in-out md:sticky md:top-4 ${
            selectedEvent
              ? "md:mr-4 md:w-[40%] lg:w-[34%] border border-[hsl(var(--border))] opacity-100 shadow-sm"
              : "w-0 border-0 opacity-0"
          }`}
        >
          <div className="h-[calc(100vh-9rem)] min-w-[280px]" role="complementary" aria-label="Edit event">
            {selectedEvent && isDesktop && (
              <EventEditPanel
                event={selectedEvent}
                rehearsals={rehearsals.filter((r) => r.eventId === selectedEvent.id)}
                canEdit={canEdit}
                onDirtyChange={setPanelDirty}
                onRequestClose={requestClose}
                onSaved={(saved) => {
                  setSelectedEvent(saved);
                  refresh();
                }}
                onRequestDelete={() => setConfirmDelete(true)}
              />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="min-w-[720px]">
          <div className="grid grid-cols-7 text-center text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="py-2">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 border-t border-l border-[hsl(var(--border))]">
            {weeks.flat().map((day) => {
              const key = toDateKey(day);
              const inMonth = day.getMonth() === monthStart.getMonth();
              const dayData = byDay.get(key);
              return (
                <div
                  key={key}
                  role={canEdit ? "button" : undefined}
                  tabIndex={canEdit ? 0 : undefined}
                  onClick={() => canEdit && setPickerDate(key)}
                  onKeyDown={(e) => {
                    if (canEdit && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      setPickerDate(key);
                    }
                  }}
                  onDragOver={(e) => {
                    if (canEdit && e.dataTransfer.types.includes(EVENT_DRAG_TYPE)) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dragOverKey !== key) setDragOverKey(key);
                    }
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node) && dragOverKey === key) {
                      setDragOverKey(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverKey(null);
                    const eventId = e.dataTransfer.getData(EVENT_DRAG_TYPE);
                    if (canEdit && eventId) void handleEventDrop(eventId, key);
                  }}
                  className={`min-h-[92px] border-r border-b border-[hsl(var(--border))] p-1.5 text-left align-top ${
                    inMonth ? "" : "opacity-40"
                  } ${canEdit ? "cursor-pointer hover:bg-[hsl(var(--muted))]/50" : ""} ${
                    dragOverKey === key ? "bg-[hsl(var(--secondary))]/10 ring-1 ring-inset ring-[hsl(var(--secondary))]" : ""
                  }`}
                >
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                      key === todayKey ? "bg-[hsl(var(--secondary))] font-bold text-[hsl(var(--secondary-foreground))]" : "text-[hsl(var(--muted-foreground))]"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayData?.events.map((event) => (
                      <Link
                        key={event.id}
                        to={`/setlists/events/${event.id}`}
                        onClick={(e) => {
                          // Straight into the split-view editor — no details page, no modal
                          e.preventDefault();
                          e.stopPropagation();
                          requestSelect(event.id);
                        }}
                        aria-expanded={selectedId === event.id}
                        draggable={canEdit}
                        onDragStart={(e) => {
                          e.dataTransfer.setData(EVENT_DRAG_TYPE, event.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => setDragOverKey(null)}
                        className={`block truncate rounded px-1 py-0.5 text-[11px] font-medium ${canEdit ? "cursor-grab active:cursor-grabbing" : ""} ${
                          selectedId === event.id ? "ring-2 ring-[hsl(var(--secondary))] ring-offset-1 ring-offset-[hsl(var(--background))]" : ""
                        } ${
                          event.status === "cancelled"
                            ? "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] line-through"
                            : "bg-[hsl(var(--secondary))]/20 text-[hsl(var(--secondary))]"
                        }`}
                        title={event.title}
                      >
                        {event.title}
                      </Link>
                    ))}
                    {dayData?.rehearsals.map((rehearsal) => (
                      <span
                        key={rehearsal.id}
                        className="block truncate rounded bg-blue-500/15 px-1 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400"
                        title={`Rehearsal${rehearsal.eventTitle ? ` — ${rehearsal.eventTitle}` : ""}`}
                      >
                        Rehearsal{rehearsal.setlistName ? `: ${rehearsal.setlistName}` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: the same editable form as a bottom sheet (no split view) */}
      {selectedEvent && !isDesktop && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Edit event">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" onClick={requestClose} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-xl border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl">
            <EventEditPanel
              event={selectedEvent}
              rehearsals={rehearsals.filter((r) => r.eventId === selectedEvent.id)}
              canEdit={canEdit}
              onDirtyChange={setPanelDirty}
              onRequestClose={requestClose}
              onSaved={(saved) => {
                setSelectedEvent(saved);
                refresh();
              }}
              onRequestDelete={() => setConfirmDelete(true)}
            />
          </div>
        </div>
      )}

      {/* Day action picker */}
      {pickerDate && !creating && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="calendar-day-title">
          <div className="modal-content max-w-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 id="calendar-day-title" className="text-lg font-brand">
                {new Date(`${pickerDate}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </h3>
              <button onClick={() => setPickerDate(null)} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))]" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => setCreating("event")} className="btn-primary">
                New event
              </button>
              <button onClick={() => setCreating("rehearsal")} className="btn-outline">
                New rehearsal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved-changes guard for switching events / closing the panel */}
      <ConfirmDialog
        open={pendingAction !== null}
        title="Discard unsaved changes?"
        description="Your edits to this event haven't been saved."
        confirmLabel="Discard changes"
        onClose={() => setPendingAction(null)}
        onConfirm={confirmDiscard}
      />

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete "${selectedEvent?.title ?? "event"}"?`}
        description="This removes the event from the calendar. Linked set lists and rehearsals are not deleted."
        confirmLabel="Delete event"
        busy={deleting}
        onClose={() => {
          if (!deleting) setConfirmDelete(false);
        }}
        onConfirm={handleDelete}
      />

      <EventFormDialog
        open={creating === "event"}
        event={initialDateTime ? ({ id: "", title: "", date: initialDateTime } as Event) : null}
        creatingFromDate={creating === "event"}
        onClose={() => {
          setCreating(null);
          setPickerDate(null);
        }}
        onSaved={refresh}
      />
      {creating === "rehearsal" && (
        <RehearsalFormDialog
          rehearsal={null}
          initialDate={initialDateTime}
          onClose={() => {
            setCreating(null);
            setPickerDate(null);
          }}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
