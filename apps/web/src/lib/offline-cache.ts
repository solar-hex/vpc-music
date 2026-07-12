import type { Song, SongVariation, Setlist, SetlistSongItem } from "@/lib/api-client";

const SONG_CACHE_KEY = "vpc-music:offline:songs";
const SETLIST_CACHE_KEY = "vpc-music:offline:setlists";
const OFFLINE_EDIT_QUEUE_KEY = "vpc-music:offline:edit-queue";
const MAX_CACHED_SONGS = 20;
const MAX_CACHED_SETLISTS = 10;

type SongCacheEntry = {
  id: string;
  cachedAt: string;
  response: {
    song: Song;
    variations: SongVariation[];
  };
};

type SetlistPerformanceContent = {
  songId: string;
  content: string;
  key?: string | null;
  originalKey?: string | null;
  tempo?: number | null;
  durationSeconds?: number | null;
};

type SetlistCacheEntry = {
  id: string;
  cachedAt: string;
  response: {
    setlist: Setlist;
    songs: SetlistSongItem[];
  };
  performanceContents?: SetlistPerformanceContent[];
};

export type OfflineSongEditQueueItem = {
  id: string;
  songId: string;
  songTitle?: string;
  organizationId: string;
  queuedAt: string;
  lastKnownUpdatedAt?: string | null;
  songData: Partial<Song>;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function sortNewestFirst<T extends { cachedAt?: string; queuedAt?: string }>(entries: T[]) {
  return [...entries].sort((left, right) => {
    const leftDate = left.cachedAt ?? left.queuedAt ?? "";
    const rightDate = right.cachedAt ?? right.queuedAt ?? "";
    return new Date(rightDate).getTime() - new Date(leftDate).getTime();
  });
}

export function isOfflineRequestError(error: unknown) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error ?? "");
  return /failed to fetch|networkerror|network request failed|load failed/i.test(message);
}

export function saveCachedSong(response: { song: Song; variations: SongVariation[] }) {
  const entries = readJson<SongCacheEntry[]>(SONG_CACHE_KEY, []);
  const next: SongCacheEntry = {
    id: response.song.id,
    cachedAt: new Date().toISOString(),
    response,
  };

  const deduped = entries.filter((entry) => entry.id !== response.song.id);
  writeJson(SONG_CACHE_KEY, sortNewestFirst([next, ...deduped]).slice(0, MAX_CACHED_SONGS));
}

export function loadCachedSong(songId: string) {
  const entries = readJson<SongCacheEntry[]>(SONG_CACHE_KEY, []);
  return entries.find((entry) => entry.id === songId) ?? null;
}

export function saveCachedSetlist(response: { setlist: Setlist; songs: SetlistSongItem[] }) {
  const entries = readJson<SetlistCacheEntry[]>(SETLIST_CACHE_KEY, []);
  const previous = entries.find((entry) => entry.id === response.setlist.id);
  const next: SetlistCacheEntry = {
    id: response.setlist.id,
    cachedAt: new Date().toISOString(),
    response,
    performanceContents: previous?.performanceContents,
  };

  const deduped = entries.filter((entry) => entry.id !== response.setlist.id);
  writeJson(SETLIST_CACHE_KEY, sortNewestFirst([next, ...deduped]).slice(0, MAX_CACHED_SETLISTS));
}

export function loadCachedSetlist(setlistId: string) {
  const entries = readJson<SetlistCacheEntry[]>(SETLIST_CACHE_KEY, []);
  return entries.find((entry) => entry.id === setlistId) ?? null;
}

export function saveCachedSetlistPerformanceContents(
  setlistId: string,
  contents: Map<string, SetlistPerformanceContent>,
) {
  const entries = readJson<SetlistCacheEntry[]>(SETLIST_CACHE_KEY, []);
  const existing = entries.find((entry) => entry.id === setlistId);
  if (!existing) {
    return;
  }

  const updated: SetlistCacheEntry = {
    ...existing,
    cachedAt: new Date().toISOString(),
    performanceContents: Array.from(contents.values()),
  };

  const deduped = entries.filter((entry) => entry.id !== setlistId);
  writeJson(SETLIST_CACHE_KEY, sortNewestFirst([updated, ...deduped]).slice(0, MAX_CACHED_SETLISTS));
}

export function loadCachedSetlistPerformanceContents(setlistId: string) {
  const entry = loadCachedSetlist(setlistId);
  return new Map((entry?.performanceContents ?? []).map((item) => [item.songId, item]));
}

export function enqueueOfflineSongEdit(item: Omit<OfflineSongEditQueueItem, "id" | "queuedAt">) {
  const queue = readJson<OfflineSongEditQueueItem[]>(OFFLINE_EDIT_QUEUE_KEY, []);
  const queuedItem: OfflineSongEditQueueItem = {
    ...item,
    id: `${item.songId}-${Date.now()}`,
    queuedAt: new Date().toISOString(),
  };

  const nextQueue = queue.filter((entry) => !(entry.songId === item.songId && entry.organizationId === item.organizationId));
  writeJson(OFFLINE_EDIT_QUEUE_KEY, [...nextQueue, queuedItem]);
  return queuedItem;
}

export function getOfflineSongEditQueue() {
  return sortNewestFirst(readJson<OfflineSongEditQueueItem[]>(OFFLINE_EDIT_QUEUE_KEY, []));
}

export function getOfflineSongEditCount() {
  return getOfflineSongEditQueue().length;
}

export function removeOfflineSongEdit(queueItemId: string) {
  const queue = readJson<OfflineSongEditQueueItem[]>(OFFLINE_EDIT_QUEUE_KEY, []);
  writeJson(
    OFFLINE_EDIT_QUEUE_KEY,
    queue.filter((entry) => entry.id !== queueItemId),
  );
}
