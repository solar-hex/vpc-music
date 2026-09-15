import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useConnectivity } from "@/contexts/ConnectivityContext";
import { syncOfflineLibrary } from "@/lib/offline-library";

/** How often an open app checks for charts changed elsewhere. */
const RESYNC_MS = 15 * 60 * 1000;

/**
 * Keeps offline mode's copy of the charts current: when someone signs in, when
 * the connection comes back, and every quarter hour while the app is open.
 * Saving a song refreshes it too (see invalidateSongLibrary). Does nothing
 * while offline mode is off.
 */
export function OfflineLibrarySync() {
  const { user } = useAuth();
  const { isOnline } = useConnectivity();
  const signedIn = Boolean(user);

  useEffect(() => {
    if (signedIn && isOnline) void syncOfflineLibrary();
  }, [signedIn, isOnline]);

  useEffect(() => {
    if (!signedIn) return;
    const timer = window.setInterval(() => {
      if (navigator.onLine) void syncOfflineLibrary();
    }, RESYNC_MS);
    return () => window.clearInterval(timer);
  }, [signedIn]);

  return null;
}
