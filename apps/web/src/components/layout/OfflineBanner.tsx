import { RefreshCw, WifiOff } from "lucide-react";
import { useConnectivity } from "@/contexts/ConnectivityContext";

/** Offline / pending-sync notice shared by the app shell and the full-screen chart page. */
export function OfflineBanner() {
  const { isOnline, pendingOfflineEditCount, syncingOfflineEdits } = useConnectivity();
  if (isOnline && pendingOfflineEditCount === 0) return null;

  return (
    <div
      role="status"
      className={`print-hidden shrink-0 border-b px-4 py-2 text-sm ${
        isOnline
          ? "border-[hsl(var(--border))] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-2">
        {isOnline ? (
          <RefreshCw className={`h-4 w-4 ${syncingOfflineEdits ? "animate-spin" : ""}`} />
        ) : (
          <WifiOff className="h-4 w-4" />
        )}
        {!isOnline ? (
          <span>You&apos;re offline. Cached songs stay available, and song edits will queue until you reconnect.</span>
        ) : (
          <span>
            {syncingOfflineEdits
              ? "Syncing offline edits…"
              : `${pendingOfflineEditCount} offline edit${pendingOfflineEditCount === 1 ? "" : "s"} waiting to sync.`}
          </span>
        )}
      </div>
    </div>
  );
}
