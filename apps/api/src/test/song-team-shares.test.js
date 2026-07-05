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

const TEST_SECRET = "test-secret-for-song-team-share-tests";
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

describe("Song team shares", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReset();
    mockDb.insert.mockReset();
    mockDb.update.mockReset();
    mockDb.delete.mockReset();
  });

  it("creates a reusable share team", async () => {
    const membershipChain = createQueryChain([{ id: "org-1", name: "Grace Church", role: "admin" }]);
    const validMembers = createQueryChain([
      { userId: "user-2", email: "band@test.com", displayName: "Band Member" },
      { userId: "user-3", email: "vox@test.com", displayName: "Vocal Lead" },
    ]);
    const insertTeam = createMutationChain([{ id: "team-1", name: "Band", createdAt: "2026-03-16T00:00:00Z", updatedAt: "2026-03-16T00:00:00Z" }]);
    const insertMembers = createMutationChain(undefined);

    mockDb.select
      .mockImplementationOnce(() => membershipChain)
      .mockImplementationOnce(() => validMembers);
    mockDb.insert
      .mockImplementationOnce(() => insertTeam)
      .mockImplementationOnce(() => insertMembers);

    const res = await request(app)
      .post("/api/share-teams")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ name: "Band", userIds: ["user-2", "user-3"] });

    expect(res.status).toBe(201);
    expect(res.body.team).toEqual({
      id: "team-1",
      name: "Band",
      createdAt: "2026-03-16T00:00:00Z",
      updatedAt: "2026-03-16T00:00:00Z",
      members: [
        { userId: "user-2", email: "band@test.com", displayName: "Band Member" },
        { userId: "user-3", email: "vox@test.com", displayName: "Vocal Lead" },
      ],
      memberUserIds: ["user-2", "user-3"],
      memberNames: ["Band Member", "Vocal Lead"],
      memberCount: 2,
    });
  });

  it("lists reusable share teams for the active organization", async () => {
    const membershipChain = createQueryChain([{ id: "org-1", name: "Grace Church", role: "admin" }]);
    const teamsChain = createQueryChain([{ id: "team-1", name: "Band", createdAt: "2026-03-16T00:00:00Z", updatedAt: "2026-03-16T00:00:00Z" }]);
    const teamMembersChain = createQueryChain([
      { teamId: "team-1", userId: "user-2", email: "band@test.com", displayName: "Band Member" },
    ]);

    mockDb.select
      .mockImplementationOnce(() => membershipChain)
      .mockImplementationOnce(() => teamsChain)
      .mockImplementationOnce(() => teamMembersChain);

    const res = await request(app)
      .get("/api/share-teams")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body.teams[0]).toEqual({
      id: "team-1",
      name: "Band",
      createdAt: "2026-03-16T00:00:00Z",
      updatedAt: "2026-03-16T00:00:00Z",
      members: [{ userId: "user-2", email: "band@test.com", displayName: "Band Member" }],
      memberUserIds: ["user-2"],
      memberNames: ["Band Member"],
      memberCount: 1,
    });
  });

  it("shares a song with a reusable team", async () => {
    const membershipChain = createQueryChain([{ id: "org-1", name: "Grace Church", role: "admin" }]);
    const songLookup = createQueryChain([{ id: "song-1", title: "Amazing Grace", organizationId: "org-1" }]);
    const teamLookup = createQueryChain([{ id: "team-1", name: "Band", organizationId: "org-1" }]);
    const existingShareLookup = createQueryChain([]);
    const insertShare = createMutationChain([{ id: "team-share-1", createdAt: "2026-03-16T00:00:00Z" }]);

    mockDb.select
      .mockImplementationOnce(() => membershipChain)
      .mockImplementationOnce(() => songLookup)
      .mockImplementationOnce(() => teamLookup)
      .mockImplementationOnce(() => existingShareLookup);
    mockDb.insert.mockImplementationOnce(() => insertShare);

    const res = await request(app)
      .post("/api/songs/song-1/team-shares")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ teamId: "team-1" });

    expect(res.status).toBe(201);
    expect(res.body.teamShare).toEqual({
      id: "team-share-1",
      teamId: "team-1",
      teamName: "Band",
      createdAt: "2026-03-16T00:00:00Z",
    });
  });

  it("lists team shares for a song", async () => {
    const membershipChain = createQueryChain([{ id: "org-1", name: "Grace Church", role: "admin" }]);
    const songLookup = createQueryChain([{ id: "song-1", title: "Amazing Grace", organizationId: "org-1" }]);
    const teamSharesChain = createQueryChain([{ id: "team-share-1", teamId: "team-1", teamName: "Band", createdAt: "2026-03-16T00:00:00Z" }]);

    mockDb.select
      .mockImplementationOnce(() => membershipChain)
      .mockImplementationOnce(() => songLookup)
      .mockImplementationOnce(() => teamSharesChain);

    const res = await request(app)
      .get("/api/songs/song-1/team-shares")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      teamShares: [{ id: "team-share-1", teamId: "team-1", teamName: "Band", createdAt: "2026-03-16T00:00:00Z" }],
    });
  });

  it("returns team-shared songs when scope=shared", async () => {
    const membershipChain = createQueryChain([{ id: "org-1", name: "Grace Church", role: "observer" }]);
    const directSharedIds = createQueryChain([]);
    const teamSharedIds = createQueryChain([{ songId: "song-9" }]);
    const organizationSharedIds = createQueryChain([]);
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

  it("allows a team-shared song to be viewed by a team member", async () => {
    const membershipChain = createQueryChain([]);
    const directSharedSongLookup = createQueryChain([]);
    const teamSharedSongLookup = createQueryChain([
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
      .mockImplementationOnce(() => directSharedSongLookup)
      .mockImplementationOnce(() => teamSharedSongLookup)
      .mockImplementationOnce(() => variationsChain);

    const res = await request(app)
      .get("/api/songs/song-9")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body.song.title).toBe("Shared Song");
  });
});
