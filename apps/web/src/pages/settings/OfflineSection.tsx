import { useState } from "react";
import { toast } from "sonner";
import { CloudOff } from "lucide-react";
import { useOfflineLibrary } from "@/hooks/useOfflineLibrary";
import { SettingsSection } from "./SettingsSection";

function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "a minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return "an hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/**
 * Offline mode, said plainly: what it keeps, what it does not, and what it
 * costs. Off until someone turns it on, because it is a promise about what
 * this device stores.
 */
export function OfflineSection() {
  const offline = useOfflineLibrary();
  const [changing, setChanging] = useState(false);

  const toggle = async (enabled: boolean) => {
    setChanging(true);
    try {
      const status = await offline.setEnabled(enabled);
      if (enabled && status.error) toast.error(`Could not save the charts: ${status.error}`);
      else if (enabled) toast.success(`${status.count} charts saved on this device`);
      else toast.success("Offline charts removed from this device");
    } finally {
      setChanging(false);
    }
  };

  return (
    <SettingsSection id="offline" title="Offline" icon={CloudOff}>
      <div className="space-y-3 text-sm">
        <p className="text-[hsl(var(--foreground))]">
          Keep a copy of every chord chart on this device, so the app opens any song with no internet, like at a church
          with no signal.
        </p>
        <p className="text-[hsl(var(--muted-foreground))]">
          Charts and song details only, about 2 MB. Practice audio and chart PDFs are never stored; they still need a
          connection. The copy updates itself whenever the app is online.
        </p>

        {!offline.supported ? (
          <p className="text-[hsl(var(--muted-foreground))]">This browser cannot keep charts for offline use.</p>
        ) : (
          <>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                role="switch"
                checked={offline.enabled}
                disabled={changing}
                onChange={(event) => void toggle(event.target.checked)}
                aria-describedby="offline-status"
              />
              <span className="font-medium text-[hsl(var(--foreground))]">Keep every chart on this device</span>
            </label>

            <div id="offline-status" className="rounded-md border border-[hsl(var(--border))] p-3" aria-live="polite">
              {!offline.enabled ? (
                <p className="text-[hsl(var(--muted-foreground))]">Off. Only charts opened recently are on this device.</p>
              ) : offline.syncing && !offline.syncedAt ? (
                <p>Saving the charts…</p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>
                    {offline.syncedAt
                      ? `${offline.count} charts saved, updated ${timeAgo(offline.syncedAt)}`
                      : "No charts saved yet."}
                    {offline.syncing ? " Updating…" : ""}
                  </p>
                  <button type="button" className="btn-outline btn-sm" disabled={offline.syncing} onClick={() => void offline.refresh()}>
                    Refresh
                  </button>
                </div>
              )}
              {offline.enabled && offline.error && (
                <p className="mt-2 text-xs text-[hsl(var(--destructive))]" role="alert">
                  The last update did not finish: {offline.error}
                </p>
              )}
            </div>
            {offline.enabled && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Turning this off deletes the saved charts from this device.</p>
            )}
          </>
        )}
      </div>
    </SettingsSection>
  );
}
