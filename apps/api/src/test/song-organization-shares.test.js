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

const TEST_SECRET = "test-secret-for-song-organization-share-tests";
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

describe("Song organization shares", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReset();
    mockDb.insert.mockReset();
    mockDb.update.mockReset();
    mockDb.delete.mockReset();
  });

  it("lists other organizations available for sharing", async () => {
    const membershipChain = createQueryChain([{ id: "org-1", name: "Grace Church", role: "admin" }]);
    const organizationsChain = createQueryChain([
      { id: "org-1", name: "Grace Church" },
      { id: "org-2", name: "Mercy Chapel" },
      { id: "org-3", name: "River City Worship" },
    ]);

    mockDb.select
      .mockImplementationOnce(() => membershipChain)
      .mockImplementationOnce(() => organizationsChain);

    const res = await request(app)
      .get("/api/share-organizations")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      organizations: [
        { id: "org-2", name: "Mercy Chapel" },
        { id: "org-3", name: "River City Worship" },
      ],
    });
  });

  it("creates batch organization shares for selected songs", async () => {
    const membershipChain = createQueryChain([{ id: "org-1", name: "Grace Church", role: "admin" }]);
    const songsChain = createQueryChain([
      { id: "song-1", title: "Amazing Grace" },
      { id: "song-2", title: "Build My Life" },
    ]);
    const targetOrganizationsChain = createQueryChain([
      { id: "org-2", name: "Mercy Chapel" },
      { id: "org-3", name: "River City Worship" },
    ]);
    const existingSharesChain = createQueryChain([{ songId: "song-1", organizationId: "org-2" }]);
    const insertShares = createMutationChain(undefined);

    mockDb.select
      .mockImplementationOnce(() => membershipChain)
      .mockImplementationOnce(() => songsChain)
      .mockImplementationOnce(() => targetOrganizationsChain)
      .mockImplementationOnce(() => existingSharesChain);
    mockDb.insert.mockImplementationOnce(() => insertShares);

    const res = await request(app)
      .post("/api/songs/batch/organization-shares")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ songIds: ["song-1", "song-2"], organizationIds: ["org-2", "org-3"] });

    expect(res.status).toBe(201);
    expect(insertShares.values).toHaveBeenCalledWith([
      { songId: "song-1", sharedWithOrganizationId: "org-3", createdBy: "user-member" },
      { songId: "song-2", sharedWithOrganizationId: "org-2", createdBy: "user-member" },
      { songId: "song-2", sharedWithOrganizationId: "org-3", createdBy: "user-member" },
    ]);
    expect(res.body).toEqual({
      sharedSongs: 2,
      targetOrganizations: 2,
      createdShares: 3,
      skippedShares: 1,
    });
  });

  it("lists current organization share assignments for selected songs", async () => {
    const membershipChain = createQueryChain([{ id: "org-1", name: "Grace Church", role: "admin" }]);
    const songsChain = createQueryChain([
      { id: "song-1", title: "Amazing Grace" },
      { id: "song-2", title: "Build My Life" },
    ]);
    const sharesChain = createQueryChain([
      { songId: "song-1", organizationId: "org-2" },
      { songId: "song-2", organizationId: "org-3" },
    ]);

    mockDb.select
      .mockImplementationOnce(() => membershipChain)
      .mockImplementationOnce(() => songsChain)
      .mockImplementationOnce(() => sharesChain);

    const res = await request(app)
      .get("/api/songs/batch/organization-shares?songId=song-1&songId=song-2")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      shares: [
        { songId: "song-1", organizationId: "org-2" },
        { songId: "song-2", organizationId: "org-3" },
      ],
    });
  });

  it("edits batch organization shares by adding and removing organizations", async () => {
    const membershipChain = createQueryChain([{ id: "org-1", name: "Grace Church", role: "admin" }]);
    const songsChain = createQueryChain([
      { id: "song-1", title: "Amazing Grace" },
      { id: "song-2", title: "Build My Life" },
    ]);
    const targetOrganizationsChain = createQueryChain([
      { id: "org-2", name: "Mercy Chapel" },
      { id: "org-3", name: "River City Worship" },
    ]);
    const existingAddSharesChain = createQueryChain([{ songId: "song-1", organizationId: "org-3" }]);
    const existingRemoveSharesChain = createQueryChain([
      { songId: "song-1", organizationId: "org-2" },
      { songId: "song-2", organizationId: "org-2" },
    ]);
    const insertShares = createMutationChain(undefined);
    const deleteChain = { where: vi.fn(() => Promise.resolve()) };

    mockDb.select
      .mockImplementationOnce(() => membershipChain)
      .mockImplementationOnce(() => songsChain)
      .mockImplementationOnce(() => targetOrganizationsChain)
      .mockImplementationOnce(() => existingAddSharesChain)
      .mockImplementationOnce(() => existingRemoveSharesChain);
    mockDb.insert.mockImplementationOnce(() => insertShares);
    mockDb.delete.mockImplementationOnce(() => deleteChain);

    const res = await request(app)
      .patch("/api/songs/batch/organization-shares")
      .set("Cookie", `token=${tokenFor()}`)
      .send({
        songIds: ["song-1", "song-2"],
        addOrganizationIds: ["org-3"],
        removeOrganizationIds: ["org-2"],
      });

    expect(res.status).toBe(200);
    expect(insertShares.values).toHaveBeenCalledWith([
      { songId: "song-2", sharedWithOrganizationId: "org-3", createdBy: "user-member" },
    ]);
    expect(deleteChain.where).toHaveBeenCalled();
    expect(res.body).toEqual({
      sharedSongs: 2,
      createdShares: 1,
      removedShares: 2,
      skippedShares: 1,
    });
  });

  it("returns organization-shared songs when scope=shared", async () => {
    const membershipChain = createQueryChain([{ id: "org-1", name: "Grace Church", role: "observer" }]);
    const directSharedIds = createQueryChain([]);
    const teamSharedIds = createQueryChain([]);
    const organizationSharedIds = createQueryChain([{ songId: "song-9" }]);
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
      .mockImplementationOnce(() => directSharedIds)
      .mockImplementationOnce(() => teamSharedIds)
      .mockImplementationOnce(() => organizationSharedIds)
      .mockImplementationOnce(() => listChain)
      .mockImplementationOnce(() => countChain)
      .mockImplementationOnce(() => favoritesChain);

    const res = await request(app)
      .get("/api/songs?scope=shared")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.songs[0].organizationName).toBe("Mercy Chapel");
  });

  it("allows an organization-shared song to be viewed from the recipient org", async () => {
    const membershipChain = createQueryChain([{ id: "org-1", name: "Grace Church", role: "observer" }]);
    const orgSongLookup = createQueryChain([]);
    const directSharedSongLookup = createQueryChain([]);
    const teamSharedSongLookup = createQueryChain([]);
    const organizationSharedSongLookup = createQueryChain([
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
      .mockImplementationOnce(() => orgSongLookup)
      .mockImplementationOnce(() => directSharedSongLookup)
      .mockImplementationOnce(() => teamSharedSongLookup)
      .mockImplementationOnce(() => organizationSharedSongLookup)
      .mockImplementationOnce(() => variationsChain);

    const res = await request(app)
      .get("/api/songs/song-9")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body.song.title).toBe("Shared Song");
    expect(res.body.variations).toEqual([]);
  });
});
