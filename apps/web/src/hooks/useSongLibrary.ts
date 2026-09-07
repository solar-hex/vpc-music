import { useCallback, useEffect, useRef, useState } from "react";
import { songsApi, type Song } from "@/lib/api-client";
import { isOfflineRequestError } from "@/lib/offline-cache";

/**
 * The whole song library, fetched once and filtered on the device, the way
 * the old site's search page worked. A snapshot lives in localStorage so the
 * list opens instantly and still works offline; it is refreshed in the
 * background when older than a minute, and whenever a song changes.
 */
export const LIBRARY_CACHE_KEY = "vpc-music:offline:library";
const LIBRARY_STALE_MS = 60_000;
const LIBRARY_LIMIT = 5000;

export type SongLibrarySnapshot = { songs: Song[]; fetchedAt: string };

let memory: SongLibrarySnapshot | null = null;
let inflight: Promise<SongLibrarySnapshot> | null = null;
const listeners = new Set<(snapshot: SongLibrarySnapshot) => void>();

function readSnapshot(): SongLibrarySnapshot | null {
  try {
    const raw = localStorage.getItem(LIBRARY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SongLibrarySnapshot;
    return Array.isArray(parsed?.songs) ? parsed : null;
  } catch {
    return null;
  }
}

function writeSnapshot(snapshot: SongLibrarySnapshot) {
  try {
    localStorage.setItem(LIBRARY_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage full or unavailable: the in-memory copy still serves this session.
  }
}

function isFresh(snapshot: SongLibrarySnapshot | null) {
  return Boolean(snapshot) && Date.now() - new Date(snapshot!.fetchedAt).getTime() < LIBRARY_STALE_MS;
}

function fetchLibrary(): Promise<SongLibrarySnapshot> {
  if (inflight) return inflight;
  inflight = songsApi
    .list({ sort: "title", limit: LIBRARY_LIMIT })
    .then((res) => {
      const snapshot = { songs: res.songs, fetchedAt: new Date().toISOString() };
      memory = snapshot;
      writeSnapshot(snapshot);
      listeners.forEach((listener) => listener(snapshot));
      return snapshot;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Call after creating, editing, importing or deleting a song. */
export function invalidateSongLibrary() {
  memory = null;
  fetchLibrary().catch(() => {});
}

/** Test helper: forget everything. */
export function resetSongLibraryCache() {
  memory = null;
  inflight = null;
  try {
    localStorage.removeItem(LIBRARY_CACHE_KEY);
  } catch {
    // ignore
  }
}

export function useSongLibrary() {
  const [snapshot, setSnapshot] = useState<SongLibrarySnapshot | null>(() => {
    if (!memory) memory = readSnapshot();
    return memory;
  });
  const [loading, setLoading] = useState(!snapshot);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  useEffect(() => {
    const listener = (next: SongLibrarySnapshot) => {
      setSnapshot(next);
      setLoading(false);
      setOffline(false);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const next = await fetchLibrary();
      setSnapshot(next);
      setOffline(false);
    } catch (err) {
      const offlineError = isOfflineRequestError(err);
      if (snapshotRef.current) {
        setOffline(offlineError);
      } else {
        setError(offlineError ? "You're offline and no copy of the library is saved on this device yet." : err instanceof Error ? err.message : "Failed to load songs");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isFresh(memory)) void refresh();
  }, [refresh]);

  return { songs: snapshot?.songs ?? [], loading, error, offline, refresh };
}
