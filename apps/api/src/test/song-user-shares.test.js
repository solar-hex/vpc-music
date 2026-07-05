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

const TEST_SECRET = "test-secret-for-song-user-share-tests";
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

function createMutationChain(result) {
  const chain = {
    values: vi.fn(() => chain),
    set: vi.fn(() => chain),
    where: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve(result)),
    then: (resolve) => Promise.resolve(result).then(resolve),
  };

  return chain;
}

function tokenFor(globalRole = "member") {
  return jwt.sign({ id: `user-${globalRole}`, role: globalRole }, TEST_SECRET, { expiresIn: "1h" });
}

describe("Song direct user shares", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReset();
    mockDb.insert.mockReset();
    mockDb.update.mockReset();
    mockDb.delete.mockReset();
  });

  it("creates a direct user share for an existing account", async () => {
    const membershipChain = createQueryChain([{ id: "org-1", name: "Grace Church", role: "admin" }]);
    const songLookup = createQueryChain([{ id: "song-1", title: "Amazing Grace", organizationId: "org-1" }]);
    const userLookup = createQueryChain([{ id: "user-2", email: "shared@test.com", displayName: "Shared User" }]);
    const existingShareLookup = createQueryChain([]);
    const insertShare = createMutationChain([{ id: "share-1", createdAt: "2026-03-16T12:00:00Z" }]);

    mockDb.select
      .mockImplementationOnce(() => membershipChain)
      .mockImplementationOnce(() => songLookup)
      .mockImplementationOnce(() => userLookup)
      .mockImplementationOnce(() => existingShareLookup);
    mockDb.insert.mockImplementationOnce(() => insertShare);

    const res = await request(app)
      .post("/api/songs/song-1/direct-shares")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ email: "shared@test.com" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      directShare: {
        id: "share-1",
        userId: "user-2",
        email: "shared@test.com",
        displayName: "Shared User",
        createdAt: "2026-03-16T12:00:00Z",
      },
    });
    expect(insertShare.values).toHaveBeenCalledWith({
      songId: "song-1",
      sharedWithUserId: "user-2",
      createdBy: "user-member",
    });
  });

  it("lists direct user shares for an organization song", async () => {
    const membershipChain = createQueryChain([{ id: "org-1", name: "Grace Church", role: "admin" }]);
    const songLookup = createQueryChain([{ id: "song-1", title: "Amazing Grace", organizationId: "org-1" }]);
    const directSharesChain = createQueryChain([
      { id: "share-1", userId: "user-2", email: "shared@test.com", displayName: "Shared User", createdAt: "2026-03-16T12:00:00Z" },
    ]);

    mockDb.select
      .mockImplementationOnce(() => membershipChain)
      .mockImplementationOnce(() => songLookup)
      .mockImplementationOnce(() => directSharesChain);

    const res = await request(app)
      .get("/api/songs/song-1/direct-shares")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      directShares: [
        { id: "share-1", userId: "user-2", email: "shared@test.com", displayName: "Shared User", createdAt: "2026-03-16T12:00:00Z" },
      ],
    });
  });

  it("removes a direct user share", async () => {
    const membershipChain = createQueryChain([{ id: "org-1", name: "Grace Church", role: "admin" }]);
    const songLookup = createQueryChain([{ id: "song-1", title: "Amazing Grace", organizationId: "org-1" }]);
    const existingShareLookup = createQueryChain([{ id: "share-1" }]);
    const deleteChain = { where: vi.fn(() => Promise.resolve()) };

    mockDb.select
      .mockImplementationOnce(() => membershipChain)
      .mockImplementationOnce(() => songLookup)
      .mockImplementationOnce(() => existingShareLookup);
    mockDb.delete.mockImplementationOnce(() => deleteChain);

    const res = await request(app)
      .delete("/api/songs/song-1/direct-shares/share-1")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Direct share removed" });
  });

  it("returns songs shared directly with the current user when scope=shared", async () => {
    const membershipChain = createQueryChain([{ id: "org-1", name: "Grace Church", role: "observer" }]);
    const sharedIdsChain = createQueryChain([{ songId: "song-9" }]);
    const sharedTeamIdsChain = createQueryChain([]);
    const sharedOrganizationIdsChain = createQueryChain([]);
    const listChain = createQueryChain([
      {
        id: "song-9",
        title: "Shared Song",
        aka: null,
        category: "Special",
        key: "G",
        tempo: 90,
        artist: "Leader",
        tags: "acoustic",
        isDraft: false,
        createdAt: "2026-03-01T00:00:00Z",
        updatedAt: "2026-03-10T00:00:00Z",
        sharedWithMe: true,
        organizationName: "Mercy Chapel",
      },
    ]);
    const countChain = createQueryChain([{ count: 1 }]);
    const favoritesChain = createQueryChain([]);

    mockDb.select
      .mockImplementationOnce(() => membershipChain)
      .mockImplementationOnce(() => sharedIdsChain)
      .mockImplementationOnce(() => sharedTeamIdsChain)
      .mockImplementationOnce(() => sharedOrganizationIdsChain)
      .mockImplementationOnce(() => listChain)
      .mockImplementationOnce(() => countChain)
      .mockImplementationOnce(() => favoritesChain);

    const res = await request(app)
      .get("/api/songs?scope=shared")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      songs: [
        {
          id: "song-9",
          title: "Shared Song",
          aka: null,
          category: "Special",
          key: "G",
          tempo: 90,
          artist: "Leader",
          tags: "acoustic",
          isDraft: false,
          createdAt: "2026-03-01T00:00:00Z",
          updatedAt: "2026-03-10T00:00:00Z",
          sharedWithMe: true,
          organizationName: "Mercy Chapel",
          isFavorite: false,
        },
      ],
      total: 1,
    });
  });

  it("allows a directly shared song to be viewed without org membership to the source org", async () => {
    const membershipChain = createQueryChain([]);
    const sharedSongLookup = createQueryChain([
      {
        id: "song-9",
        title: "Shared Song",
        aka: null,
        category: null,
        key: "G",
        tempo: 90,
        artist: "Leader",
        shout: null,
        year: null,
        tags: "acoustic",
        content: "[G]Shared",
        isDraft: false,
        defaultVariationId: null,
        organizationId: "org-2",
        createdBy: "user-5",
        createdAt: "2026-03-01T00:00:00Z",
        updatedAt: "2026-03-10T00:00:00Z",
      },
    ]);
    const variationsChain = createQueryChain([]);

    mockDb.select
      .mockImplementationOnce(() => membershipChain)
      .mockImplementationOnce(() => sharedSongLookup)
      .mockImplementationOnce(() => variationsChain);

    const res = await request(app)
      .get("/api/songs/song-9")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body.song.title).toBe("Shared Song");
    expect(res.body.variations).toEqual([]);
  });
});
