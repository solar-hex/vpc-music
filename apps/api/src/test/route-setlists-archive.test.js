import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  // Real Drizzle transactions pass a `tx` with the same query-builder surface
  // as `db`; route through the same mocks so existing expectations hold.
  transaction: vi.fn((callback) => callback(mockDb)),
};

vi.mock("../../src/db.js", () => ({ db: mockDb, pool: {} }));

const TEST_SECRET = "test-secret-for-setlist-archive-tests";
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

function createUpdateChain(result) {
  const chain = {
    set: vi.fn(() => chain),
    where: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve(result)),
    then: (resolve) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

function createDeleteChain() {
  const chain = {
    where: vi.fn(() => Promise.resolve()),
  };
  return chain;
}

function tokenFor(globalRole = "member") {
  return jwt.sign({ id: `user-${globalRole}`, role: globalRole }, TEST_SECRET, { expiresIn: "1h" });
}

function membership(role) {
  return createQueryChain([{ id: "org-1", name: "Test Church", role }]);
}

describe("Setlists — archive / trash lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReset();
    mockDb.insert.mockReset();
    mockDb.update.mockReset();
    mockDb.delete.mockReset();
  });

  it("rejects an invalid view param", async () => {
    mockDb.select.mockImplementationOnce(() => membership("musician"));

    const res = await request(app)
      .get("/api/setlists?view=bogus")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(400);
  });

  it("archives a setlist as musician", async () => {
    const updateChain = createUpdateChain([{ id: "s1", isArchived: true }]);
    mockDb.select.mockImplementationOnce(() => membership("musician"));
    mockDb.update.mockImplementationOnce(() => updateChain);

    const res = await request(app)
      .post("/api/setlists/s1/archive")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ isArchived: true, archivedAt: expect.any(Date) }),
    );
  });

  it("blocks observers from archiving (403)", async () => {
    mockDb.select.mockImplementationOnce(() => membership("observer"));

    const res = await request(app)
      .post("/api/setlists/s1/archive")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(403);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("soft-deletes on DELETE (moves to trash, keeps rows)", async () => {
    const existsChain = createQueryChain([{ id: "s1" }]);
    const updateChain = createUpdateChain([]);
    mockDb.select
      .mockImplementationOnce(() => membership("admin"))
      .mockImplementationOnce(() => existsChain);
    mockDb.update.mockImplementationOnce(() => updateChain);

    const res = await request(app)
      .delete("/api/setlists/s1")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/trash/i);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ deletedAt: expect.any(Date) }));
    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it("restores a trashed setlist", async () => {
    const updateChain = createUpdateChain([{ id: "s1", deletedAt: null }]);
    mockDb.select.mockImplementationOnce(() => membership("musician"));
    mockDb.update.mockImplementationOnce(() => updateChain);

    const res = await request(app)
      .post("/api/setlists/s1/restore")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ deletedAt: null }));
  });

  it("permanently deletes as admin, unlinking events first", async () => {
    const existsChain = createQueryChain([{ id: "s1" }]);
    const eventUnlinkChain = createUpdateChain([]);
    mockDb.select
      .mockImplementationOnce(() => membership("admin"))
      .mockImplementationOnce(() => existsChain);
    mockDb.update.mockImplementationOnce(() => eventUnlinkChain);
    mockDb.delete
      .mockImplementationOnce(() => createDeleteChain())
      .mockImplementationOnce(() => createDeleteChain());

    const res = await request(app)
      .delete("/api/setlists/s1/permanent")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(eventUnlinkChain.set).toHaveBeenCalledWith({ setlistId: null });
    expect(mockDb.delete).toHaveBeenCalledTimes(2);
  });

  it("blocks musicians from permanent delete (403)", async () => {
    mockDb.select.mockImplementationOnce(() => membership("musician"));

    const res = await request(app)
      .delete("/api/setlists/s1/permanent")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(403);
    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it("global owner bypasses the admin check for permanent delete", async () => {
    const existsChain = createQueryChain([{ id: "s1" }]);
    const eventUnlinkChain = createUpdateChain([]);
    mockDb.select
      .mockImplementationOnce(() => membership("observer"))
      .mockImplementationOnce(() => existsChain);
    mockDb.update.mockImplementationOnce(() => eventUnlinkChain);
    mockDb.delete
      .mockImplementationOnce(() => createDeleteChain())
      .mockImplementationOnce(() => createDeleteChain());

    const res = await request(app)
      .delete("/api/setlists/s1/permanent")
      .set("Cookie", `token=${tokenFor("owner")}`);

    expect(res.status).toBe(200);
  });

  it("updates per-item performance metadata (capo, arrangement, cues)", async () => {
    const itemUpdateChain = createUpdateChain([{ id: "item-1", capo: 2, arrangement: "ACOUSTIC" }]);
    const setlistTouchChain = createUpdateChain([]);
    mockDb.select
      .mockImplementationOnce(() => membership("musician"))
      .mockImplementationOnce(() => createQueryChain([{ id: "s1", organizationId: "org-1" }]));
    mockDb.update
      .mockImplementationOnce(() => itemUpdateChain)
      .mockImplementationOnce(() => setlistTouchChain);

    const res = await request(app)
      .patch("/api/setlists/s1/songs/item-1")
      .set("Cookie", `token=${tokenFor()}`)
      .send({
        capo: 2,
        arrangement: "ACOUSTIC",
        duration: 300,
        transitionCues: [
          { type: "PRAYER", text: "  Short prayer  ", durationSec: "30" },
          { type: "BOGUS_TYPE", text: "dropped" },
          "not-an-object",
        ],
      });

    expect(res.status).toBe(200);
    expect(itemUpdateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        capo: 2,
        arrangement: "ACOUSTIC",
        duration: 300,
        transitionCues: [{ type: "PRAYER", text: "Short prayer", durationSec: 30 }],
      }),
    );
  });

  it("rejects invalid arrangement and capo values", async () => {
    mockDb.select
      .mockImplementationOnce(() => membership("admin"))
      .mockImplementationOnce(() => createQueryChain([{ id: "s1", organizationId: "org-1" }]));
    const badArrangement = await request(app)
      .patch("/api/setlists/s1/songs/item-1")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ arrangement: "JAZZ_ODYSSEY" });
    expect(badArrangement.status).toBe(400);

    mockDb.select
      .mockImplementationOnce(() => membership("admin"))
      .mockImplementationOnce(() => createQueryChain([{ id: "s1", organizationId: "org-1" }]));
    const badCapo = await request(app)
      .patch("/api/setlists/s1/songs/item-1")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ capo: 20 });
    expect(badCapo.status).toBe(400);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("blocks observers from updating item metadata (403)", async () => {
    mockDb.select.mockImplementationOnce(() => membership("observer"));

    const res = await request(app)
      .patch("/api/setlists/s1/songs/item-1")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ capo: 2 });

    expect(res.status).toBe(403);
  });

  it("accepts leader and tags on create", async () => {
    const insertChain = {
      values: vi.fn(() => insertChain),
      returning: vi.fn(() => Promise.resolve([{ id: "s-new" }])),
    };
    mockDb.select.mockImplementationOnce(() => membership("admin"));
    mockDb.insert.mockImplementationOnce(() => insertChain);

    const res = await request(app)
      .post("/api/setlists")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ name: "Sunday", leader: "Sam", tags: "worship,acoustic" });

    expect(res.status).toBe(201);
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ leader: "Sam", tags: "worship,acoustic" }),
    );
  });
});
