import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("../../src/db.js", () => ({ db: mockDb, pool: {} }));

const TEST_SECRET = "test-secret-for-song-filter-tests";
vi.mock("../../src/config/env.js", () => ({
  env: {
    JWT_SECRET: TEST_SECRET,
    CORS_ORIGIN: "http://localhost:5176",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
  },
}));

const { app } = await import("../../src/app.js");

function createQueryChain(result) {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    as: vi.fn(() => chain),
    offset: vi.fn(() => Promise.resolve(result)),
    then: (resolve) => Promise.resolve(result).then(resolve),
  };

  return chain;
}

function tokenFor(globalRole = "member") {
  return jwt.sign({ id: `user-${globalRole}`, role: globalRole }, TEST_SECRET, { expiresIn: "1h" });
}

describe("Song list filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReset();
    mockDb.insert.mockReset();
    mockDb.update.mockReset();
    mockDb.delete.mockReset();
  });

  it("returns filtered songs and filtered totals when tempo range params are provided", async () => {
    const membershipChain = createQueryChain([{ id: "org-1", name: "Test Church", role: "admin" }]);
    const listChain = createQueryChain([
      { id: "song-1", title: "Amazing Grace", aka: "Grace Song", key: "G", tempo: 72, artist: "Newton", tags: "hymn" },
    ]);
    const countChain = createQueryChain([{ count: 1 }]);
    const favoritesChain = createQueryChain([]);

    mockDb.select
      .mockImplementationOnce(() => membershipChain)
      .mockImplementationOnce(() => listChain)
      .mockImplementationOnce(() => countChain)
      .mockImplementationOnce(() => favoritesChain);

    const res = await request(app)
      .get("/api/songs?q=grace&tag=hymn&key=G&tempoMin=70&tempoMax=90")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      songs: [
        { id: "song-1", title: "Amazing Grace", aka: "Grace Song", key: "G", tempo: 72, artist: "Newton", tags: "hymn", isFavorite: false },
      ],
      total: 1,
    });
    expect(listChain.where).toHaveBeenCalledTimes(1);
    expect(listChain.limit).toHaveBeenCalledWith(50);
    expect(listChain.offset).toHaveBeenCalledWith(0);
    expect(countChain.where).toHaveBeenCalledTimes(1);
  });

  it("returns filtered songs when a category query is provided", async () => {
    const membershipChain = createQueryChain([{ id: "org-1", name: "Test Church", role: "admin" }]);
    const listChain = createQueryChain([
      { id: "song-1", title: "Amazing Grace", category: "Church", key: "G", tempo: 72, artist: "Newton", tags: "hymn" },
    ]);
    const countChain = createQueryChain([{ count: 1 }]);
    const favoritesChain = createQueryChain([]);

    mockDb.select
      .mockImplementationOnce(() => membershipChain)
      .mockImplementationOnce(() => listChain)
      .mockImplementationOnce(() => countChain)
      .mockImplementationOnce(() => favoritesChain);

    const res = await request(app)
      .get("/api/songs?category=Church")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      songs: [
        { id: "song-1", title: "Amazing Grace", category: "Church", key: "G", tempo: 72, artist: "Newton", tags: "hymn", isFavorite: false },
      ],
      total: 1,
    });
    expect(listChain.where).toHaveBeenCalledTimes(1);
    expect(countChain.where).toHaveBeenCalledTimes(1);
  });

  it("returns filtered songs when a song group query is provided", async () => {
    const membershipChain = createQueryChain([{ id: "org-1", name: "Test Church", role: "admin" }]);
    const groupedSongsChain = createQueryChain([{ songId: "song-1" }]);
    const listChain = createQueryChain([
      { id: "song-1", title: "Amazing Grace", category: "Church", key: "G", tempo: 72, artist: "Newton", tags: "hymn" },
    ]);
    const countChain = createQueryChain([{ count: 1 }]);
    const favoritesChain = createQueryChain([]);

    mockDb.select
      .mockImplementationOnce(() => membershipChain)
      .mockImplementationOnce(() => groupedSongsChain)
      .mockImplementationOnce(() => listChain)
      .mockImplementationOnce(() => countChain)
      .mockImplementationOnce(() => favoritesChain);

    const res = await request(app)
      .get("/api/songs?groupId=group-1")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      songs: [
        { id: "song-1", title: "Amazing Grace", category: "Church", key: "G", tempo: 72, artist: "Newton", tags: "hymn", isFavorite: false },
      ],
      total: 1,
    });
    expect(groupedSongsChain.where).toHaveBeenCalledTimes(1);
    expect(listChain.where).toHaveBeenCalledTimes(1);
    expect(countChain.where).toHaveBeenCalledTimes(1);
  });

  it("returns unique song categories for the active organization", async () => {
    const membershipChain = createQueryChain([{ id: "org-1", name: "Test Church", role: "admin" }]);
    const categoryChain = createQueryChain([
      { category: "Church" },
      { category: "Wedding" },
      { category: "Church" },
      { category: null },
    ]);

    mockDb.select
      .mockImplementationOnce(() => membershipChain)
      .mockImplementationOnce(() => categoryChain);

    const res = await request(app)
      .get("/api/songs/categories")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ categories: ["Church", "Wedding"] });
    expect(categoryChain.where).toHaveBeenCalledTimes(1);
  });

  it("matches alternate names in the text search query", async () => {
    const membershipChain = createQueryChain([{ id: "org-1", name: "Test Church", role: "admin" }]);
    const listChain = createQueryChain([
      { id: "song-1", title: "Amazing Grace", aka: "Grace Song", key: "G", tempo: 72, artist: "Newton", tags: "hymn" },
    ]);
    const countChain = createQueryChain([{ count: 1 }]);
    const favoritesChain = createQueryChain([]);

    mockDb.select
      .mockImplementationOnce(() => membershipChain)
      .mockImplementationOnce(() => listChain)
      .mockImplementationOnce(() => countChain)
      .mockImplementationOnce(() => favoritesChain);

    const res = await request(app)
      .get("/api/songs?q=grace%20song")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      songs: [
        { id: "song-1", title: "Amazing Grace", aka: "Grace Song", key: "G", tempo: 72, artist: "Newton", tags: "hymn", isFavorite: false },
      ],
      total: 1,
    });
    expect(listChain.where).toHaveBeenCalledTimes(1);
    expect(countChain.where).toHaveBeenCalledTimes(1);
  });

  it("supports most-used sorting on the song list", async () => {
    const membershipChain = createQueryChain([{ id: "org-1", name: "Test Church", role: "admin" }]);
    const usageAggregateChain = createQueryChain([]);
    const listChain = createQueryChain([
      { id: "song-2", title: "How Great", aka: null, key: "C", tempo: 120, artist: "Tomlin", tags: "worship" },
    ]);
    const countChain = createQueryChain([{ count: 1 }]);
    const favoritesChain = createQueryChain([]);

    mockDb.select
      .mockImplementationOnce(() => membershipChain)
      .mockImplementationOnce(() => usageAggregateChain)
      .mockImplementationOnce(() => listChain)
      .mockImplementationOnce(() => countChain)
      .mockImplementationOnce(() => favoritesChain);

    const res = await request(app)
      .get("/api/songs?sort=mostUsed")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      songs: [
        { id: "song-2", title: "How Great", aka: null, key: "C", tempo: 120, artist: "Tomlin", tags: "worship", isFavorite: false },
      ],
      total: 1,
    });
    expect(usageAggregateChain.groupBy).toHaveBeenCalledTimes(1);
    expect(listChain.leftJoin).toHaveBeenCalledTimes(1);
    expect(listChain.orderBy).toHaveBeenCalledTimes(1);
  });
});
