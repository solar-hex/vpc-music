import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Trash2, RotateCcw } from "lucide-react";
import { setlistsApi, type Setlist } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

/**
 * Slide-in trash panel: restore soft-deleted setlists or permanently delete
 * them (admins only).
 */
export function SetlistTrashPanel({
  open,
  onClose,
  canEdit,
  isAdmin,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [trashed, setTrashed] = useState<Setlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingPurge, setPendingPurge] = useState<Setlist | null>(null);
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setlistsApi
      .list({ view: "trash" })
      .then((res) => setTrashed(res.setlists))
      .catch(() => setTrashed([]))
      .finally(() => setLoading(false));
  }, [open]);

  const handleRestore = async (setlist: Setlist) => {
    try {
      await setlistsApi.restore(setlist.id);
      setTrashed((prev) => prev.filter((s) => s.id !== setlist.id));
      toast.success(`"${setlist.name}" restored`);
      onChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to restore");
    }
  };

  const handlePurge = async () => {
    if (!pendingPurge) return;
    setPurging(true);
    try {
      await setlistsApi.permanentDelete(pendingPurge.id);
      setTrashed((prev) => prev.filter((s) => s.id !== pendingPurge.id));
      toast.success(`"${pendingPurge.name}" permanently deleted`);
      setPendingPurge(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setPurging(false);
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
        aria-label="Setlist trash"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
          <h3 className="section-title">
            <Trash2 className="section-title-icon" /> Trash
          </h3>
          <button onClick={onClose} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8"><div className="spinner" /></div>
          ) : trashed.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-8">Trash is empty.</p>
          ) : (
            trashed.map((setlist) => (
              <div key={setlist.id} className="card card-body flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{setlist.name}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {setlist.songCount ?? 0} songs
                    {setlist.deletedAt &&
                      ` · deleted ${new Date(setlist.deletedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleRestore(setlist)}
                      className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--secondary))]"
                      title="Restore"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => setPendingPurge(setlist)}
                        className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                        title="Delete permanently"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingPurge)}
        title={pendingPurge ? `Permanently delete "${pendingPurge.name}"?` : "Delete setlist?"}
        description="This cannot be undone. The setlist and its song order will be removed forever."
        confirmLabel="Delete forever"
        busy={purging}
        onClose={() => {
          if (!purging) setPendingPurge(null);
        }}
        onConfirm={handlePurge}
      />
    </>
  );
}
