import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { eventsApi, rehearsalsApi, type Event, type Rehearsal } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { EventFormDialog } from "@/components/dashboard/EventFormDialog";
import { RehearsalFormDialog } from "./RehearsalsPage";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

function toDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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

  const refresh = () => {
    eventsApi.list({ upcoming: false }).then((res) => setEvents(res.events)).catch(() => {});
    rehearsalsApi.list().then((res) => setRehearsals(res.rehearsals)).catch(() => {});
  };

  useEffect(() => {
    refresh();
  }, []);

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

      <div className="overflow-x-auto">
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
                  className={`min-h-[92px] border-r border-b border-[hsl(var(--border))] p-1.5 text-left align-top ${
                    inMonth ? "" : "opacity-40"
                  } ${canEdit ? "cursor-pointer hover:bg-[hsl(var(--muted))]/50" : ""}`}
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
                        onClick={(e) => e.stopPropagation()}
                        className={`block truncate rounded px-1 py-0.5 text-[11px] font-medium ${
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
