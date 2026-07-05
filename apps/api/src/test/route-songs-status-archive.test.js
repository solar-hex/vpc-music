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

const TEST_SECRET = "test-secret-for-song-status-tests";
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
    offset: vi.fn(() => Promise.resolve(result)),
    then: (resolve) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

function createUpdateChain(result) {
  const chain = {
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

function membership(role) {
  return createQueryChain([{ id: "org-1", name: "Test Church", role }]);
}

describe("Songs — status / archive / favorites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReset();
    mockDb.insert.mockReset();
    mockDb.update.mockReset();
    mockDb.delete.mockReset();
  });

  it("sets a song status as musician", async () => {
    const updateChain = createUpdateChain([{ id: "song-1", status: "in_rehearsal" }]);
    mockDb.select.mockImplementationOnce(() => membership("musician"));
    mockDb.update.mockImplementationOnce(() => updateChain);

    const res = await request(app)
      .patch("/api/songs/song-1/status")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ status: "in_rehearsal" });

    expect(res.status).toBe(200);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ status: "in_rehearsal" }));
  });

  it("clears a status with null", async () => {
    const updateChain = createUpdateChain([{ id: "song-1", status: null }]);
    mockDb.select.mockImplementationOnce(() => membership("admin"));
    mockDb.update.mockImplementationOnce(() => updateChain);

    const res = await request(app)
      .patch("/api/songs/song-1/status")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ status: null });

    expect(res.status).toBe(200);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ status: null }));
  });

  it("rejects an invalid status value (400)", async () => {
    mockDb.select.mockImplementationOnce(() => membership("admin"));

    const res = await request(app)
      .patch("/api/songs/song-1/status")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ status: "totally_bogus" });

    expect(res.status).toBe(400);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("blocks observers from setting status (403)", async () => {
    mockDb.select.mockImplementationOnce(() => membership("observer"));

    const res = await request(app)
      .patch("/api/songs/song-1/status")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ status: "ready" });

    expect(res.status).toBe(403);
  });

  it("soft-deletes a song on DELETE", async () => {
    const existsChain = createQueryChain([{ id: "song-1" }]);
    const updateChain = createUpdateChain([]);
    mockDb.select
      .mockImplementationOnce(() => membership("musician"))
      .mockImplementationOnce(() => existsChain);
    mockDb.update.mockImplementationOnce(() => updateChain);

    const res = await request(app)
      .delete("/api/songs/song-1")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/trash/i);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ deletedAt: expect.any(Date) }));
    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it("permanent delete is admin-only (403 for musician)", async () => {
    mockDb.select.mockImplementationOnce(() => membership("musician"));

    const res = await request(app)
      .delete("/api/songs/song-1/permanent")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(403);
    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it("archives a song as musician", async () => {
    const updateChain = createUpdateChain([{ id: "song-1", isArchived: true }]);
    mockDb.select.mockImplementationOnce(() => membership("musician"));
    mockDb.update.mockImplementationOnce(() => updateChain);

    const res = await request(app)
      .post("/api/songs/song-1/archive")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ isArchived: true, archivedAt: expect.any(Date) }),
    );
  });

  it("lets observers favorite a song (personal action)", async () => {
    const songChain = createQueryChain([{ id: "song-1" }]);
    const insertChain = {
      values: vi.fn(() => insertChain),
      onConflictDoNothing: vi.fn(() => Promise.resolve()),
    };
    mockDb.select
      .mockImplementationOnce(() => membership("observer"))
      .mockImplementationOnce(() => songChain);
    mockDb.insert.mockImplementationOnce(() => insertChain);

    const res = await request(app)
      .post("/api/songs/song-1/favorite")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(201);
    expect(insertChain.values).toHaveBeenCalledWith({ songId: "song-1", userId: "user-member" });
  });

  it("removes a favorite", async () => {
    const deleteChain = { where: vi.fn(() => Promise.resolve()) };
    mockDb.select.mockImplementationOnce(() => membership("observer"));
    mockDb.delete.mockImplementationOnce(() => deleteChain);

    const res = await request(app)
      .delete("/api/songs/song-1/favorite")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(deleteChain.where).toHaveBeenCalledTimes(1);
  });

  it("returns empty list when filtering favorites and user has none", async () => {
    const favoritesChain = createQueryChain([]);
    mockDb.select
      .mockImplementationOnce(() => membership("musician"))
      .mockImplementationOnce(() => favoritesChain);

    const res = await request(app)
      .get("/api/songs?favorites=true")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ songs: [], total: 0 });
  });
});
