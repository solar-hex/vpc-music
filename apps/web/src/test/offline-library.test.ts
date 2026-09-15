import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";

const contents = vi.fn();
vi.mock("@/lib/api-client", () => ({ songsApi: { contents: (...args: unknown[]) => contents(...args) } }));

const {
  clearOfflineLibrary,
  getOfflineSong,
  isOfflineLibraryEnabled,
  offlineLibraryStatus,
  setOfflineLibraryEnabled,
  subscribeOfflineLibrary,
  syncOfflineLibrary,
} = await import("@/lib/offline-library");

const entry = (id: string, content = `{title: ${id}}\n[G]${id}`, updatedAt = "2026-09-10T00:00:00.000Z") => ({
  song: { id, title: id, content, updatedAt },
  variations: [],
});

describe("offline library", () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearOfflineLibrary();
    contents.mockReset();
  });

  it("stores nothing and asks for nothing while it is off", async () => {
    expect(isOfflineLibraryEnabled()).toBe(false);
    await syncOfflineLibrary();
    expect(contents).not.toHaveBeenCalled();
    expect(await getOfflineSong("way-maker")).toBeNull();
    expect(offlineLibraryStatus()).toMatchObject({ enabled: false, count: 0, syncedAt: null });
  });

  it("keeps every chart when turned on, and opens any of them", async () => {
    contents.mockResolvedValueOnce({ fetchedAt: "2026-09-15T12:00:00.000Z", ids: ["way-maker", "covered"], songs: [entry("way-maker"), entry("covered")] });
    const status = await setOfflineLibraryEnabled(true);
    expect(contents).toHaveBeenCalledWith(undefined);
    expect(status).toMatchObject({ enabled: true, syncing: false, count: 2, syncedAt: "2026-09-15T12:00:00.000Z", error: null });
    expect((await getOfflineSong("covered"))?.song.content).toBe("{title: covered}\n[G]covered");
  });

  it("then fetches only what changed, overlapping the last sync, and drops what is gone", async () => {
    contents.mockResolvedValueOnce({ fetchedAt: "2026-09-15T12:00:00.000Z", ids: ["way-maker", "covered"], songs: [entry("way-maker"), entry("covered")] });
    await setOfflineLibraryEnabled(true);

    contents.mockResolvedValueOnce({ fetchedAt: "2026-09-15T13:00:00.000Z", ids: ["way-maker"], songs: [entry("way-maker", "{title: way-maker}\n[A]new key")] });
    const status = await syncOfflineLibrary();
    // ten minutes before the last sync, so a clock difference never skips an edit
    expect(contents).toHaveBeenLastCalledWith("2026-09-15T11:50:00.000Z");
    expect(status).toMatchObject({ count: 1, syncedAt: "2026-09-15T13:00:00.000Z" });
    expect((await getOfflineSong("way-maker"))?.song.content).toContain("[A]new key");
    expect(await getOfflineSong("covered")).toBeNull();
  });

  it("deletes the copy when turned off", async () => {
    contents.mockResolvedValueOnce({ fetchedAt: "2026-09-15T12:00:00.000Z", ids: ["way-maker"], songs: [entry("way-maker")] });
    await setOfflineLibraryEnabled(true);
    const status = await setOfflineLibraryEnabled(false);
    expect(status).toMatchObject({ enabled: false, count: 0, syncedAt: null });
    localStorage.setItem("vpc-music:offline:library-enabled", "true");
    expect(await getOfflineSong("way-maker")).toBeNull();
  });

  it("keeps the last copy and says why when a sync fails", async () => {
    contents.mockResolvedValueOnce({ fetchedAt: "2026-09-15T12:00:00.000Z", ids: ["way-maker"], songs: [entry("way-maker")] });
    await setOfflineLibraryEnabled(true);
    contents.mockRejectedValueOnce(new Error("Failed to fetch"));
    const status = await syncOfflineLibrary();
    expect(status).toMatchObject({ error: "Failed to fetch", count: 1, syncedAt: "2026-09-15T12:00:00.000Z" });
    expect(await getOfflineSong("way-maker")).not.toBeNull();
  });

  it("keeps nothing when turned off while a sync is on its way", async () => {
    let answer: (value: unknown) => void = () => {};
    contents.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const turningOn = setOfflineLibraryEnabled(true);
    await setOfflineLibraryEnabled(false);
    answer({ fetchedAt: "2026-09-15T12:00:00.000Z", ids: ["way-maker"], songs: [entry("way-maker")] });
    await turningOn;
    localStorage.setItem("vpc-music:offline:library-enabled", "true");
    expect(await getOfflineSong("way-maker")).toBeNull();
    expect(offlineLibraryStatus().count).toBe(0);
  });

  it("runs one sync at a time, and tells listeners when it starts and ends", async () => {
    contents.mockResolvedValue({ fetchedAt: "2026-09-15T12:00:00.000Z", ids: [], songs: [] });
    localStorage.setItem("vpc-music:offline:library-enabled", "true");
    const seen: boolean[] = [];
    const stop = subscribeOfflineLibrary((status) => seen.push(status.syncing));
    const [a, b] = [syncOfflineLibrary(), syncOfflineLibrary()];
    expect(a).toBe(b);
    await a;
    stop();
    expect(contents).toHaveBeenCalledTimes(1);
    expect(seen[0]).toBe(true);
    expect(seen.at(-1)).toBe(false);
  });
});
