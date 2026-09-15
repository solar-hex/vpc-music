import { songsApi, type Song, type SongVariation } from "@/lib/api-client";

/**
 * Offline mode: every chart kept on this device, so a phone at a church with
 * no signal opens any song, not just the ones someone happened to open at home.
 *
 * It is opt-in and per device (Settings, Offline), because it is a promise
 * about what this phone stores. Once on, it keeps everything: no per-song
 * choices, nothing to remember to download. Turning it off deletes the copy.
 *
 * The charts live in IndexedDB. The whole library is about 2 MB of text, past
 * what localStorage should hold. The switch and the last sync time live in
 * localStorage, because they are read synchronously on every screen that asks.
 *
 * A sync asks for what changed since the last one, overlapping by ten minutes
 * so a clock difference between the machine that saved a chart and the server
 * can never skip an edit; re-sending a chart is harmless. Every sync also gets
 * the full list of ids, and drops the charts that are gone.
 */

export type OfflineEntry = { song: Song; variations: SongVariation[] };

export interface OfflineLibraryStatus {
  supported: boolean;
  enabled: boolean;
  syncing: boolean;
  count: number;
  syncedAt: string | null;
  error: string | null;
}

const DB_NAME = "vpc-music-offline";
const STORE = "charts";
const ENABLED_KEY = "vpc-music:offline:library-enabled";
const STATUS_KEY = "vpc-music:offline:library-status";
const SYNC_OVERLAP_MS = 10 * 60 * 1000;

let syncing: Promise<OfflineLibraryStatus> | null = null;
let lastError: string | null = null;
const listeners = new Set<(status: OfflineLibraryStatus) => void>();

export function offlineLibrarySupported(): boolean {
  return typeof indexedDB !== "undefined";
}

function readStored(): { count: number; syncedAt: string | null } {
  try {
    const parsed = JSON.parse(localStorage.getItem(STATUS_KEY) || "null");
    return { count: Number(parsed?.count) || 0, syncedAt: typeof parsed?.syncedAt === "string" ? parsed.syncedAt : null };
  } catch {
    return { count: 0, syncedAt: null };
  }
}

function writeStored(value: { count: number; syncedAt: string | null } | null) {
  try {
    if (value) localStorage.setItem(STATUS_KEY, JSON.stringify(value));
    else localStorage.removeItem(STATUS_KEY);
  } catch {
    // Storage unavailable: the status is only shown, the charts are in IndexedDB.
  }
}

export function isOfflineLibraryEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

export function offlineLibraryStatus(): OfflineLibraryStatus {
  return {
    supported: offlineLibrarySupported(),
    enabled: isOfflineLibraryEnabled(),
    syncing: syncing !== null,
    ...readStored(),
    error: lastError,
  };
}

function notify() {
  const status = offlineLibraryStatus();
  listeners.forEach((listener) => listener(status));
}

export function subscribeOfflineLibrary(listener: (status: OfflineLibraryStatus) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the offline library"));
  });
}

async function withStore<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDatabase();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = work(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request ? request.result : undefined);
      transaction.onerror = () => reject(transaction.error ?? new Error("The offline library could not be written"));
      transaction.onabort = () => reject(transaction.error ?? new Error("The offline library could not be written"));
    });
  } finally {
    db.close();
  }
}

/** A chart kept on this device, or null. */
export async function getOfflineSong(id: string): Promise<OfflineEntry | null> {
  if (!offlineLibrarySupported() || !isOfflineLibraryEnabled()) return null;
  try {
    const record = await withStore<{ id: string; entry: OfflineEntry } | undefined>("readonly", (store) => store.get(id));
    return record?.entry ?? null;
  } catch {
    return null;
  }
}

/**
 * Bring this device's copy up to date. Does nothing when offline mode is off.
 * `full` fetches every chart instead of only what changed.
 */
export function syncOfflineLibrary({ full = false }: { full?: boolean } = {}): Promise<OfflineLibraryStatus> {
  if (!offlineLibrarySupported() || !isOfflineLibraryEnabled()) return Promise.resolve(offlineLibraryStatus());
  if (syncing) return syncing;

  const run = (async () => {
    const stored = readStored();
    const since = !full && stored.syncedAt ? new Date(new Date(stored.syncedAt).getTime() - SYNC_OVERLAP_MS).toISOString() : undefined;
    try {
      const result = await songsApi.contents(since);
      const keep = new Set(result.ids);
      const existing = ((await withStore<IDBValidKey[]>("readonly", (store) => store.getAllKeys())) ?? []).map(String);
      await withStore("readwrite", (store) => {
        for (const entry of result.songs) store.put({ id: entry.song.id, entry });
        for (const id of existing) if (!keep.has(id)) store.delete(id);
      });
      // Turned off while this sync was running: keep nothing.
      if (!isOfflineLibraryEnabled()) {
        await clearOfflineLibrary();
        return offlineLibraryStatus();
      }
      const count = (await withStore<number>("readonly", (store) => store.count())) ?? 0;
      writeStored({ count, syncedAt: result.fetchedAt });
      lastError = null;
    } catch (err) {
      lastError = err instanceof Error ? err.message : "The charts could not be saved";
    }
  })();
  // The status is read after `syncing` clears, so it never says a finished sync is still running.
  const done = run.finally(() => {
    syncing = null;
    notify();
  });
  syncing = done.then(() => offlineLibraryStatus());
  notify();
  return syncing;
}

/** Delete every chart kept on this device (the switch stays as it is). */
export async function clearOfflineLibrary(): Promise<void> {
  writeStored(null);
  if (offlineLibrarySupported()) {
    try {
      await withStore("readwrite", (store) => {
        store.clear();
      });
    } catch {
      // Nothing stored, or storage unavailable: nothing to delete.
    }
  }
  notify();
}

export async function setOfflineLibraryEnabled(enabled: boolean): Promise<OfflineLibraryStatus> {
  try {
    if (enabled) localStorage.setItem(ENABLED_KEY, "true");
    else localStorage.removeItem(ENABLED_KEY);
  } catch {
    // ignore: without storage the switch cannot stay on anyway
  }
  lastError = null;
  if (!enabled) {
    await clearOfflineLibrary();
    return offlineLibraryStatus();
  }
  return syncOfflineLibrary({ full: true });
}
