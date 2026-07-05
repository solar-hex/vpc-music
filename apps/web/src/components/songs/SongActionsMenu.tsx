import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  MoreVertical,
  Star,
  Archive,
  ArchiveRestore,
  Trash2,
  ChevronRight,
  CircleSlash,
} from "lucide-react";
import { songsApi, type Song, type SongStatus } from "@/lib/api-client";
import { SONG_STATUS_CONFIGS } from "./SongStatusBadge";

/**
 * Three-dot actions menu for a song: favorite, rehearsal status, archive,
 * and trash. Favorite is available to every role; the rest require edit
 * rights (`canEdit`).
 */
export function SongActionsMenu({
  song,
  canEdit,
  onChanged,
  onRemoved,
}: {
  song: Song;
  canEdit: boolean;
  /** Called with the updated song after favorite/status/archive changes. */
  onChanged?: (song: Song) => void;
  /** Called after the song leaves the current list (archived or trashed). */
  onRemoved?: (song: Song) => void;
}) {
  const [open, setOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setStatusOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const close = () => {
    setOpen(false);
    setStatusOpen(false);
  };

  const handleFavorite = async () => {
    close();
    try {
      if (song.isFavorite) {
        await songsApi.unfavorite(song.id);
        onChanged?.({ ...song, isFavorite: false });
      } else {
        await songsApi.favorite(song.id);
        onChanged?.({ ...song, isFavorite: true });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update favorite");
    }
  };

  const handleStatus = async (status: SongStatus | null) => {
    close();
    try {
      const res = await songsApi.setStatus(song.id, status);
      onChanged?.({ ...song, ...res.song });
      toast.success(status ? `Marked "${SONG_STATUS_CONFIGS[status].label}"` : "Status cleared");
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleArchive = async () => {
    close();
    try {
      if (song.isArchived) {
        const res = await songsApi.unarchive(song.id);
        onChanged?.({ ...song, ...res.song });
        toast.success(`"${song.title}" restored from archive`);
        onRemoved?.(song);
      } else {
        await songsApi.archive(song.id);
        toast.success(`"${song.title}" archived`, {
          action: {
            label: "Undo",
            onClick: async () => {
              await songsApi.unarchive(song.id).catch(() => {});
              onChanged?.({ ...song, isArchived: false });
            },
          },
        });
        onRemoved?.(song);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to archive");
    }
  };

  const handleTrash = async () => {
    close();
    try {
      await songsApi.delete(song.id);
      toast.success(`"${song.title}" moved to trash`, {
        action: {
          label: "Undo",
          onClick: async () => {
            await songsApi.restore(song.id).catch(() => {});
            onChanged?.(song);
          },
        },
      });
      onRemoved?.(song);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const itemClass =
    "flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors";

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
        }}
        className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        aria-label={`Actions for ${song.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-50 min-w-[190px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg py-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button role="menuitem" onClick={handleFavorite} className={itemClass}>
            <Star className={`h-3.5 w-3.5 ${song.isFavorite ? "fill-[hsl(var(--secondary))] text-[hsl(var(--secondary))]" : ""}`} />
            {song.isFavorite ? "Remove favorite" : "Add to favorites"}
          </button>

          {canEdit && (
            <>
              <div className="my-1 border-t border-[hsl(var(--border))]" />
              <button
                role="menuitem"
                onClick={() => setStatusOpen(!statusOpen)}
                className={itemClass}
                aria-expanded={statusOpen}
              >
                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${statusOpen ? "rotate-90" : ""}`} />
                Set status
              </button>
              {statusOpen && (
                <div className="pl-4">
                  {(Object.keys(SONG_STATUS_CONFIGS) as SongStatus[]).map((status) => {
                    const config = SONG_STATUS_CONFIGS[status];
                    const Icon = config.icon;
                    return (
                      <button
                        key={status}
                        role="menuitem"
                        onClick={() => handleStatus(status)}
                        className={`${itemClass} ${song.status === status ? "text-[hsl(var(--secondary))]" : ""}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {config.label}
                      </button>
                    );
                  })}
                  {song.status && (
                    <button role="menuitem" onClick={() => handleStatus(null)} className={itemClass}>
                      <CircleSlash className="h-3.5 w-3.5" />
                      Clear status
                    </button>
                  )}
                </div>
              )}

              <div className="my-1 border-t border-[hsl(var(--border))]" />
              <button role="menuitem" onClick={handleArchive} className={itemClass}>
                {song.isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                {song.isArchived ? "Restore from archive" : "Archive"}
              </button>
              <button
                role="menuitem"
                onClick={handleTrash}
                className={`${itemClass} text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Move to trash
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
