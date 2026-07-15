import { useSearchParams } from "react-router-dom";
import { EventsPage } from "./EventsPage";
import { CalendarPage } from "./CalendarPage";
import { RehearsalsPage } from "./RehearsalsPage";
import { CalendarDays, CalendarRange, Drum } from "lucide-react";

type View = "events" | "calendar" | "rehearsals";

const VIEWS: Array<{ id: View; label: string; icon: typeof CalendarDays }> = [
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "calendar", label: "Calendar", icon: CalendarRange },
  { id: "rehearsals", label: "Rehearsals", icon: Drum },
];

/**
 * One schedule home. Events, Calendar, and Rehearsals were three sibling
 * tabs describing the same "when are we playing?" question — now they're
 * views of a single Schedule tab, toggled via ?view= (deep-linkable).
 */
export function SchedulePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = (searchParams.get("view") as View) || "events";

  const setView = (v: View) => {
    const next = new URLSearchParams(searchParams);
    if (v === "events") next.delete("view");
    else next.set("view", v);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 rounded-lg bg-[hsl(var(--muted))] p-1 w-fit" role="tablist" aria-label="Schedule views">
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === id
                ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {view === "events" && <EventsPage />}
      {view === "calendar" && <CalendarPage />}
      {view === "rehearsals" && <RehearsalsPage />}
    </div>
  );
}
