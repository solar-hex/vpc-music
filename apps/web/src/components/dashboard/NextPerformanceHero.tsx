import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarDays, MapPin, Music, Users, ListMusic, Eye } from "lucide-react";
import type { Event } from "@/lib/api-client";
import { fadeInUp, prefersReducedMotion } from "@/lib/motion";

function formatHeroDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * "Next Performance" hero card — spotlights the nearest upcoming event with
 * its theme, setlist, and team at a glance.
 */
export function NextPerformanceHero({ event, onViewPlan }: { event: Event; onViewPlan: (event: Event) => void }) {
  return (
    <motion.section
      variants={fadeInUp}
      initial={prefersReducedMotion() ? false : "initial"}
      animate="animate"
      aria-label="Next performance"
      className="relative overflow-hidden rounded-xl border border-[hsl(var(--secondary))]/30 bg-gradient-to-r from-[hsl(var(--secondary))]/15 via-[hsl(var(--card))] to-[hsl(var(--card))] p-5 sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--secondary))] mb-2">
        Next Performance
      </p>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-xl sm:text-2xl font-semibold text-[hsl(var(--foreground))] truncate">{event.title}</h3>
          {event.theme && <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{event.theme}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[hsl(var(--muted-foreground))]">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-[hsl(var(--secondary))]" />
              {formatHeroDate(event.date)}
            </span>
            {event.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-[hsl(var(--secondary))]" />
                {event.location}
              </span>
            )}
            {event.setlistId && (
              <span className="inline-flex items-center gap-1.5">
                <Music className="h-4 w-4 text-[hsl(var(--secondary))]" />
                {event.songCount ?? 0} song{(event.songCount ?? 0) !== 1 ? "s" : ""}
              </span>
            )}
            {event.preparedByName && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4 text-[hsl(var(--secondary))]" />
                {event.preparedByName}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => onViewPlan(event)} className="btn-outline btn-sm">
            <Eye className="h-4 w-4" /> View plan
          </button>
          {event.setlistId && (
            <Link to={`/setlists/${event.setlistId}`} className="btn-primary btn-sm">
              <ListMusic className="h-4 w-4" /> Open setlist
            </Link>
          )}
        </div>
      </div>
    </motion.section>
  );
}
