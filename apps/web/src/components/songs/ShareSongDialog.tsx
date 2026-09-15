import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Copy, Link2Off, Share2 } from "lucide-react";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";
import { shareApi } from "@/lib/api-client";

interface ShareSongDialogProps {
  open: boolean;
  onClose: () => void;
  songId: string;
  songTitle: string;
}

type LinkState = { status: "loading" } | { status: "ready"; url: string } | { status: "error" };

/**
 * Share one chart with someone outside the team.
 *
 * The link opens that chart read only: they can change the key, play its parts
 * and print it, and cannot edit it or reach any other song. A song has one link
 * at a time, so opening this again shows the same link, and Stop sharing turns
 * it off for everyone who has it.
 *
 * The key on screen travels with the link, so "send the guitarist the chart in
 * A" is one tap from wherever the chart is showing.
 */
export function ShareSongDialog({ open, onClose, songId, songTitle }: ShareSongDialogProps) {
  const [searchParams] = useSearchParams();
  const [link, setLink] = useState<LinkState>({ status: "loading" });
  const [confirmingStop, setConfirmingStop] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const key = searchParams.get("key");
  const steps = searchParams.get("t");

  useEffect(() => {
    if (!open) return;
    let current = true;
    setLink({ status: "loading" });
    setConfirmingStop(false);
    shareApi
      .create(songId)
      .then(({ shareUrl }) => {
        if (!current) return;
        const url = new URL(shareUrl, window.location.origin);
        if (key) url.searchParams.set("key", key);
        else if (steps) url.searchParams.set("t", steps);
        setLink({ status: "ready", url: url.toString() });
      })
      .catch(() => current && setLink({ status: "error" }));
    return () => {
      current = false;
    };
  }, [open, songId, key, steps, attempt]);

  const copy = async () => {
    if (link.status !== "ready") return;
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy. Select the link and copy it instead.");
    }
  };

  const canUseShareSheet = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const openShareSheet = async () => {
    if (link.status !== "ready") return;
    try {
      await navigator.share({ title: songTitle, text: `${songTitle} chord chart`, url: link.url });
    } catch {
      // Dismissing the share sheet is not an error worth a message.
    }
  };

  const stopSharing = async () => {
    setStopping(true);
    try {
      await shareApi.stopSharing(songId);
      toast.success("Link turned off");
      onClose();
    } catch {
      toast.error("Could not turn the link off. Try again.");
    } finally {
      setStopping(false);
      setConfirmingStop(false);
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title="Share this chart"
      description="Anyone with the link can view this chart, change its key, play its parts and print it. They can't edit it or see any other song."
    >
      <div className="space-y-4">
        {link.status === "loading" && (
          <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]" role="status">
            <span className="spinner h-4 w-4" aria-hidden="true" /> Getting the link…
          </div>
        )}

        {link.status === "error" && (
          <div className="space-y-2" role="alert">
            <p className="text-sm text-[hsl(var(--destructive))]">Could not get a link for this song.</p>
            <button type="button" className="btn-outline btn-sm" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          </div>
        )}

        {link.status === "ready" && (
          <>
            <div className="space-y-1">
              <input
                type="text"
                readOnly
                value={link.url}
                onFocus={(event) => event.currentTarget.select()}
                className="input w-full font-mono text-xs"
                aria-label="Share link"
              />
              {key && <p className="text-xs text-[hsl(var(--muted-foreground))]">Opens in the key of {key}.</p>}
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={() => void copy()}>
                <Copy className="h-4 w-4" aria-hidden="true" /> Copy link
              </button>
              {canUseShareSheet && (
                <button type="button" className="btn-outline" onClick={() => void openShareSheet()}>
                  <Share2 className="h-4 w-4" aria-hidden="true" /> Send…
                </button>
              )}
            </div>

            <div className="border-t border-[hsl(var(--border))] pt-3">
              {confirmingStop ? (
                <div className="space-y-2">
                  <p className="text-sm">Turn this link off? Anyone who has it loses access. You can share again any time, with a new link.</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-outline btn-sm" onClick={() => setConfirmingStop(false)} disabled={stopping}>
                      Keep sharing
                    </button>
                    <button type="button" className="btn-destructive btn-sm" onClick={() => void stopSharing()} disabled={stopping}>
                      {stopping ? "Turning off…" : "Turn off link"}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn-ghost btn-sm text-[hsl(var(--destructive))]" onClick={() => setConfirmingStop(true)}>
                  <Link2Off className="h-4 w-4" aria-hidden="true" /> Stop sharing
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </ResponsiveModal>
  );
}
