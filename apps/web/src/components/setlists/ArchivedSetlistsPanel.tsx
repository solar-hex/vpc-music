import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { X, Archive, RotateCcw, Trash2, Search } from "lucide-react";
import { setlistsApi, type Setlist } from "@/lib/api-client";

/** Bucket an archived date into a human group label, newest groups first. */
export function archiveGroupLabel(iso: string | null | undefined): string {
  if (!iso) return "Earlier";
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.floor((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (dayDiff <= 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff < 7) return "This Week";
  if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) return "This Month";
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/**
 * Slide-in panel listing archived setlists grouped by archive date, with
 * restore and move-to-trash actions.
 */
export function ArchivedSetlistsPanel({
  open,
  onClose,
  canEdit,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  /** Called after a restore/trash so the hub can refresh its list. */
  onChanged: () => void;
}) {
  const [archived, setArchived] = useState<Setlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setlistsApi
      .list({ view: "archived" })
      .then((res) => setArchived(res.setlists))
      .catch(() => setArchived([]))
      .finally(() => setLoading(false));
  }, [open]);

  const groups = useMemo(() => {
    const filtered = query
      ? archived.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
      : archived;
    const byGroup = new Map<string, Setlist[]>();
    for (const setlist of filtered) {
      const label = archiveGroupLabel(setlist.archivedAt);
      if (!byGroup.has(label)) byGroup.set(label, []);
      byGroup.get(label)!.push(setlist);
    }
    return [...byGroup.entries()];
  }, [archived, query]);

  const handleRestore = async (setlist: Setlist) => {
    try {
      await setlistsApi.unarchive(setlist.id);
      setArchived((prev) => prev.filter((s) => s.id !== setlist.id));
      toast.success(`"${setlist.name}" restored`);
      onChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to restore");
    }
  };

  const handleTrash = async (setlist: Setlist) => {
    try {
      await setlistsApi.delete(setlist.id);
      setArchived((prev) => prev.filter((s) => s.id !== setlist.id));
      toast.success(`"${setlist.name}" moved to trash`, {
        action: {
          label: "Undo",
          onClick: async () => {
            await setlistsApi.restore(setlist.id).catch(() => {});
            onChanged();
          },
        },
      });
      onChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to move to trash");
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" aria-hidden="true" onClick={onClose} />
      <div
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md flex flex-col bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Archived setlists"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
          <h3 className="section-title">
            <Archive className="section-title-icon" /> Archived setlists
          </h3>
          <button onClick={onClose} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-[hsl(var(--border))]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search archived…"
              className="input w-full pl-8"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
          {loading ? (
            <div className="flex justify-center py-8"><div className="spinner" /></div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-8">
              {query ? "No archived setlists match your search." : "No archived setlists."}
            </p>
          ) : (
            groups.map(([label, items]) => (
              <div key={label} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  {label}
                </p>
                {items.map((setlist) => (
                  <div key={setlist.id} className="card card-body flex items-center gap-3">
                    <Link to={`/setlists/${setlist.id}`} className="flex-1 min-w-0" onClick={onClose}>
                      <p className="text-sm font-medium truncate">{setlist.name}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {setlist.songCount ?? 0} songs
                        {setlist.category && ` · ${setlist.category}`}
                      </p>
                    </Link>
                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleRestore(setlist)}
                          className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--secondary))]"
                          title="Restore"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleTrash(setlist)}
                          className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                          title="Move to trash"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
