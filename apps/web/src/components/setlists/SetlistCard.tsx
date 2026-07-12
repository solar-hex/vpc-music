import { Link } from "react-router-dom";
import { Archive, Trash2, Clock, User, Activity } from "lucide-react";
import type { Setlist } from "@/lib/api-client";
import { formatSetlistDuration } from "@/lib/format";
import { SetlistStatusBadge } from "./SetlistStatusBadge";

/** "G,C,D" → "G · C · D" (capped) for the card's key summary. */
export function formatKeys(keys?: string | null): string | null {
  if (!keys) return null;
  const unique = keys.split(",").map((k) => k.trim()).filter(Boolean);
  if (unique.length === 0) return null;
  const shown = unique.slice(0, 3).join(" · ");
  return unique.length > 3 ? `${shown} +${unique.length - 3}` : shown;
}

export function SetlistCard({
  setlist,
  canEdit,
  onArchive,
  onTrash,
}: {
  setlist: Setlist;
  canEdit: boolean;
  onArchive?: (setlist: Setlist) => void;
  onTrash?: (setlist: Setlist) => void;
}) {
  const duration = formatSetlistDuration(setlist.totalDuration);
  const keys = formatKeys(setlist.keys);

  return (
    <div className="card-interactive card-body relative group">
      <Link to={`/setlists/${setlist.id}`} className="block space-y-1.5">
        <div className="flex items-center gap-2 pr-14">
          <span className="font-medium text-[hsl(var(--foreground))] truncate">{setlist.name}</span>
          {setlist.status === "complete" && <SetlistStatusBadge status="complete" className="shrink-0" />}
        </div>
        <div className="text-xs text-[hsl(var(--muted-foreground))]">
          {setlist.songCount ?? 0} song{(setlist.songCount ?? 0) !== 1 ? "s" : ""}
          {setlist.category && <span className="ml-2">· {setlist.category}</span>}
          {keys && <span className="ml-2">· {keys}</span>}
        </div>
        <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
          {duration && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {duration}
            </span>
          )}
          {setlist.averageBpm ? (
            <span className="inline-flex items-center gap-1">
              <Activity className="h-3 w-3" /> ~{setlist.averageBpm} BPM
            </span>
          ) : null}
          {setlist.leader && (
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" /> {setlist.leader}
            </span>
          )}
        </div>
      </Link>
      {canEdit && (
        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {onArchive && (
            <button
              onClick={() => onArchive(setlist)}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--secondary))] transition-colors"
              title="Archive"
            >
              <Archive className="h-4 w-4" />
            </button>
          )}
          {onTrash && (
            <button
              onClick={() => onTrash(setlist)}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] transition-colors"
              title="Move to trash"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
