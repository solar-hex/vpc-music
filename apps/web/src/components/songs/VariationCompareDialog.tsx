import { useMemo, useState } from "react";
import { variationsApi, type Song, type SongVariation } from "@/lib/api-client";
import { diffLines, countDiff } from "@/utils/line-diff";
import { toast } from "sonner";
import { X, ArrowUpToLine } from "lucide-react";

/**
 * Shows a line diff between the canonical song and a variation, and lets an
 * editor promote the variation up to canonical (story 4, C3 + C5). Handles the
 * version-conflict (409) case by offering an explicit overwrite.
 */
export function VariationCompareDialog({
  song,
  variation,
  canPromote,
  onClose,
  onPromoted,
}: {
  song: Song;
  variation: SongVariation;
  canPromote: boolean;
  onClose: () => void;
  onPromoted: (updated: Song) => void;
}) {
  const [promoting, setPromoting] = useState(false);
  const [conflict, setConflict] = useState(false);
  const keyDiffers = Boolean(variation.key && variation.key !== song.key);
  const [promoteKey, setPromoteKey] = useState(keyDiffers);

  const diff = useMemo(() => diffLines(song.content ?? "", variation.content ?? ""), [song.content, variation.content]);
  const counts = useMemo(() => countDiff(diff), [diff]);

  const promote = async (force: boolean) => {
    setPromoting(true);
    try {
      const res = await variationsApi.promote(song.id, variation.id, {
        lastKnownUpdatedAt: song.updatedAt,
        forceOverwrite: force,
        promoteKey: keyDiffers ? promoteKey : false,
      });
      toast.success(`Promoted "${variation.name}" to the canonical song`);
      onPromoted(res.song);
      onClose();
    } catch (err: any) {
      if (err?.status === 409) {
        setConflict(true);
        toast.error("This song changed since you opened it.");
      } else {
        toast.error(err?.message || "Failed to promote");
      }
    } finally {
      setPromoting(false);
    }
  };

  return (
    <div className="modal-backdrop print-hidden">
      <div className="modal-content max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-brand text-[hsl(var(--foreground))]">
              Compare "{variation.name}" with the original
            </h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              <span className="text-[hsl(var(--secondary))]">+{counts.added} added</span>
              {" · "}
              <span className="text-[hsl(var(--destructive))]">−{counts.removed} removed</span>
              {" · promoting replaces the original for everyone in your organization."}
            </p>
          </div>
          <button onClick={onClose} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 font-mono text-xs">
          {diff.map((line, idx) => (
            <div
              key={idx}
              className={`flex gap-2 px-3 py-0.5 ${
                line.type === "add"
                  ? "bg-green-500/10 text-green-700 dark:text-green-300"
                  : line.type === "remove"
                    ? "bg-red-500/10 text-red-700 dark:text-red-300"
                    : "text-[hsl(var(--muted-foreground))]"
              }`}
            >
              <span className="w-3 shrink-0 select-none opacity-70">
                {line.type === "add" ? "+" : line.type === "remove" ? "−" : ""}
              </span>
              <span className="whitespace-pre-wrap break-words">{line.text || " "}</span>
            </div>
          ))}
        </div>

        {keyDiffers && (
          <label className="mt-3 flex items-center gap-2 text-sm text-[hsl(var(--foreground))]">
            <input type="checkbox" checked={promoteKey} onChange={(e) => setPromoteKey(e.target.checked)} />
            Also set the song key to <span className="badge-key">{variation.key}</span> (currently {song.key || "—"})
          </label>
        )}

        {conflict ? (
          <div className="mt-3 space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p className="text-amber-800 dark:text-amber-200">
              The original changed since you opened this. Reload to review, or overwrite it with this version.
            </p>
            <div className="flex gap-2">
              <button onClick={() => promote(true)} disabled={promoting} className="btn-destructive btn-sm">
                Overwrite anyway
              </button>
              <button onClick={onClose} className="btn-outline btn-sm">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          canPromote && (
            <div className="mt-3 flex gap-2">
              <button onClick={() => promote(false)} disabled={promoting} className="btn-primary">
                <ArrowUpToLine className="h-4 w-4" /> {promoting ? "Promoting…" : "Promote to canonical"}
              </button>
              <button onClick={onClose} className="btn-outline">
                Close
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
