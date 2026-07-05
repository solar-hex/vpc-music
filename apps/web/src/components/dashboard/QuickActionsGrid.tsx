import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, CalendarPlus, Star } from "lucide-react";

const FAVORITES_KEY = "dashboard_favorite_actions";

interface QuickAction {
  id: string;
  label: string;
  icon: typeof Plus;
  /** Route to navigate to, or undefined when onClick is used instead. */
  to?: string;
  onClick?: () => void;
  /** Single-key keyboard shortcut (fires when no input is focused). */
  shortcut?: string;
  requiresEdit?: boolean;
}

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Dashboard quick actions with pinnable favorites and single-key shortcuts,
 * after the prototype's quick-action grid. Favorites sort first and persist
 * per browser.
 */
export function QuickActionsGrid({ canEdit, onNewPlan }: { canEdit: boolean; onNewPlan: () => void }) {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);

  const actions = useMemo<QuickAction[]>(
    () => [
      { id: "new-song", label: "New Song", icon: Plus, to: "/songs/new", shortcut: "n", requiresEdit: true },
      { id: "new-setlist", label: "New Setlist", icon: Plus, to: "/setlists/new", shortcut: "s", requiresEdit: true },
      { id: "new-plan", label: "New Plan", icon: CalendarPlus, onClick: onNewPlan, shortcut: "p", requiresEdit: true },
      { id: "browse-songs", label: "Browse Songs", icon: Search, to: "/songs", shortcut: "b" },
    ],
    [onNewPlan],
  );

  const visible = actions.filter((a) => !a.requiresEdit || canEdit);
  const sorted = [...visible].sort((a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)));

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id];
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch {
        // localStorage unavailable — favorites just won't persist
      }
      return next;
    });
  };

  // Single-key shortcuts, suppressed while typing in a form field
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable) return;
      const action = visible.find((a) => a.shortcut === e.key.toLowerCase());
      if (!action) return;
      e.preventDefault();
      if (action.to) navigate(action.to);
      else action.onClick?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, onNewPlan]);

  return (
    <div className="flex flex-wrap gap-3">
      {sorted.map((action, idx) => {
        const Icon = action.icon;
        const isFavorite = favorites.includes(action.id);
        const buttonClass = idx === 0 ? "btn-primary" : "btn-outline";
        const inner = (
          <>
            <Icon className="h-4 w-4" /> {action.label}
            {action.shortcut && (
              <kbd className="ml-1 hidden sm:inline rounded border border-current/30 px-1 text-[10px] uppercase opacity-60">
                {action.shortcut}
              </kbd>
            )}
          </>
        );
        return (
          <span key={action.id} className="inline-flex items-center group">
            {action.to ? (
              <Link to={action.to} className={buttonClass} title={`Shortcut: ${action.shortcut?.toUpperCase()}`}>
                {inner}
              </Link>
            ) : (
              <button onClick={action.onClick} className={buttonClass} title={`Shortcut: ${action.shortcut?.toUpperCase()}`}>
                {inner}
              </button>
            )}
            <button
              onClick={() => toggleFavorite(action.id)}
              className={`btn-icon ml-0.5 rounded-md transition-opacity ${
                isFavorite
                  ? "text-[hsl(var(--secondary))]"
                  : "text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              }`}
              aria-label={isFavorite ? `Unpin ${action.label}` : `Pin ${action.label}`}
              aria-pressed={isFavorite}
            >
              <Star className={`h-3.5 w-3.5 ${isFavorite ? "fill-current" : ""}`} />
            </button>
          </span>
        );
      })}
    </div>
  );
}
