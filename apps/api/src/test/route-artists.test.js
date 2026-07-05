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

const TEST_SECRET = "test-secret-for-artist-tests";
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
    orderBy: vi.fn(() => Promise.resolve(result)),
    limit: vi.fn(() => chain),
    then: (resolve) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

function createInsertChain(result) {
  const chain = {
    values: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve(result)),
  };
  return chain;
}

function createUpdateChain(result) {
  const chain = {
    set: vi.fn(() => chain),
    where: vi.fn(() => Promise.resolve(result)),
    returning: vi.fn(() => Promise.resolve(result)),
  };
  return chain;
}

function tokenFor(globalRole = "member") {
  return jwt.sign({ id: `user-${globalRole}`, role: globalRole }, TEST_SECRET, { expiresIn: "1h" });
}

function membership(role) {
  return createQueryChain([{ id: "org-1", name: "Test Church", role }]);
}

describe("Artists directory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReset();
    mockDb.insert.mockReset();
    mockDb.update.mockReset();
    mockDb.delete.mockReset();
  });

  it("lists artists for any org role (observer included)", async () => {
    const listChain = createQueryChain([
      { id: "a1", name: "Hillsong", genre: "Worship", verified: true, songCount: 4 },
    ]);
    mockDb.select
      .mockImplementationOnce(() => membership("observer"))
      .mockImplementationOnce(() => listChain);

    const res = await request(app)
      .get("/api/artists")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body.artists).toHaveLength(1);
    expect(res.body.artists[0].name).toBe("Hillsong");
  });

  it("creates an artist and back-fills matching songs", async () => {
    const duplicateChain = createQueryChain([]);
    const insertChain = createInsertChain([{ id: "a1", name: "Hillsong", organizationId: "org-1" }]);
    const backfillChain = createUpdateChain([]);
    mockDb.select
      .mockImplementationOnce(() => membership("musician"))
      .mockImplementationOnce(() => duplicateChain);
    mockDb.insert.mockImplementationOnce(() => insertChain);
    mockDb.update.mockImplementationOnce(() => backfillChain);

    const res = await request(app)
      .post("/api/artists")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ name: "  Hillsong  ", genre: "Worship" });

    expect(res.status).toBe(201);
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Hillsong", genre: "Worship", organizationId: "org-1" }),
    );
    expect(backfillChain.set).toHaveBeenCalledWith({ artistId: "a1" });
  });

  it("rejects duplicate artist names (400)", async () => {
    const duplicateChain = createQueryChain([{ id: "existing" }]);
    mockDb.select
      .mockImplementationOnce(() => membership("admin"))
      .mockImplementationOnce(() => duplicateChain);

    const res = await request(app)
      .post("/api/artists")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ name: "Hillsong" });

    expect(res.status).toBe(400);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("blocks observers from creating artists (403)", async () => {
    mockDb.select.mockImplementationOnce(() => membership("observer"));

    const res = await request(app)
      .post("/api/artists")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ name: "Hillsong" });

    expect(res.status).toBe(403);
  });

  it("resolve returns the existing artist without creating (idempotent)", async () => {
    const existingChain = createQueryChain([{ id: "a1", name: "Hillsong" }]);
    mockDb.select
      .mockImplementationOnce(() => membership("musician"))
      .mockImplementationOnce(() => existingChain);

    const res = await request(app)
      .post("/api/artists/resolve")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ name: "hillsong" });

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(false);
    expect(res.body.artist.id).toBe("a1");
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("resolve creates when missing", async () => {
    const missingChain = createQueryChain([]);
    const insertChain = createInsertChain([{ id: "a2", name: "New Artist", organizationId: "org-1" }]);
    const backfillChain = createUpdateChain([]);
    mockDb.select
      .mockImplementationOnce(() => membership("admin"))
      .mockImplementationOnce(() => missingChain);
    mockDb.insert.mockImplementationOnce(() => insertChain);
    mockDb.update.mockImplementationOnce(() => backfillChain);

    const res = await request(app)
      .post("/api/artists/resolve")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ name: "New Artist" });

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);
  });

  it("deletes an artist after unlinking songs (musician allowed)", async () => {
    const existsChain = createQueryChain([{ id: "a1", organizationId: "org-1" }]);
    const unlinkChain = createUpdateChain([]);
    const deleteChain = { where: vi.fn(() => Promise.resolve()) };
    mockDb.select
      .mockImplementationOnce(() => membership("musician"))
      .mockImplementationOnce(() => existsChain);
    mockDb.update.mockImplementationOnce(() => unlinkChain);
    mockDb.delete.mockImplementationOnce(() => deleteChain);

    const res = await request(app)
      .delete("/api/artists/a1")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(unlinkChain.set).toHaveBeenCalledWith({ artistId: null });
    expect(deleteChain.where).toHaveBeenCalled();
  });
});
