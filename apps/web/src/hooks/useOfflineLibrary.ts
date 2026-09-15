import { useEffect, useState } from "react";
import {
  offlineLibraryStatus,
  setOfflineLibraryEnabled,
  subscribeOfflineLibrary,
  syncOfflineLibrary,
  type OfflineLibraryStatus,
} from "@/lib/offline-library";

/** Offline mode's switch and state, kept current while a sync runs. */
export function useOfflineLibrary(): OfflineLibraryStatus & {
  setEnabled: (enabled: boolean) => Promise<OfflineLibraryStatus>;
  refresh: () => Promise<OfflineLibraryStatus>;
} {
  const [status, setStatus] = useState<OfflineLibraryStatus>(offlineLibraryStatus);
  useEffect(() => {
    setStatus(offlineLibraryStatus());
    return subscribeOfflineLibrary(setStatus);
  }, []);
  return { ...status, setEnabled: setOfflineLibraryEnabled, refresh: () => syncOfflineLibrary({ full: true }) };
}
