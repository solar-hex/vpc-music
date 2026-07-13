import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  // Real Drizzle transactions pass a `tx` with the same query-builder surface
  // as `db`; route through the same mocks so existing insert expectations hold.
  transaction: vi.fn((callback) => callback(mockDb)),
};

vi.mock("../../src/db.js", () => ({ db: mockDb, pool: {} }));

const TEST_SECRET = "test-secret-for-planning-tests";
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
    groupBy: vi.fn(() => chain),
    limit: vi.fn(() => ({ then: (resolve) => Promise.resolve(result).then(resolve) })),
    then: (resolve) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

function createInsertChain(result) {
  const chain = {
    values: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve(result)),
    onConflictDoUpdate: vi.fn(() => chain),
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

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.select.mockReset();
  mockDb.insert.mockReset();
  mockDb.update.mockReset();
  mockDb.delete.mockReset();
});

describe("Role gating on new planning surfaces (observer 403)", () => {
  const writeCalls = [
    { method: "post", path: "/api/albums", body: { title: "A" } },
    { method: "post", path: "/api/setlists/templates", body: { title: "T", structure: [{ label: "Opener" }] } },
    { method: "post", path: "/api/rehearsals", body: { rehearsalDate: "2099-01-01T10:00:00Z" } },
    { method: "post", path: "/api/events/e1/complete", body: null },
    { method: "post", path: "/api/setlists/s1/approve", body: null },
  ];

  for (const call of writeCalls) {
    it(`${call.method.toUpperCase()} ${call.path} → 403 for observer`, async () => {
      mockDb.select.mockImplementationOnce(() => membership("observer"));
      const req = request(app)[call.method](call.path).set("Cookie", `token=${tokenFor()}`);
      if (call.body) req.send(call.body);
      const res = await req;
      expect(res.status).toBe(403);
    });
  }

  it("musicians cannot approve setlists (admin permission)", async () => {
    mockDb.select.mockImplementationOnce(() => membership("musician"));
    const res = await request(app)
      .post("/api/setlists/s1/approve")
      .set("Cookie", `token=${tokenFor()}`);
    expect(res.status).toBe(403);
  });
});

describe("Event completion writes song plays", () => {
  it("marks completed, logs one usage per song, completes the set list", async () => {
    const eventLookup = createQueryChain([
      { id: "e1", title: "Sunday", date: "2026-07-05T10:00:00Z", status: "scheduled", setlistId: "s1" },
    ]);
    const eventUpdate = createUpdateChain([{ id: "e1", status: "completed" }]);
    const itemsChain = createQueryChain([{ songId: "song-1" }, { songId: "song-2" }, { songId: null }]);
    const usagesInsert = createInsertChain([]);
    const setlistUpdate = createUpdateChain([]);
    const activityInsert = createInsertChain([]);

    mockDb.select
      .mockImplementationOnce(() => membership("musician"))
      .mockImplementationOnce(() => eventLookup)
      .mockImplementationOnce(() => itemsChain);
    mockDb.update
      .mockImplementationOnce(() => eventUpdate)
      .mockImplementationOnce(() => setlistUpdate);
    mockDb.insert
      .mockImplementationOnce(() => usagesInsert)
      .mockImplementationOnce(() => activityInsert);

    const res = await request(app)
      .post("/api/events/e1/complete")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body.playsLogged).toBe(2); // null slot skipped
    expect(eventUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed", completedAt: expect.any(Date) }),
    );
    const usageRows = usagesInsert.values.mock.calls[0][0];
    expect(usageRows).toHaveLength(2);
    expect(usageRows[0]).toMatchObject({ songId: "song-1", eventId: "e1", organizationId: "org-1" });
    expect(setlistUpdate.set).toHaveBeenCalledWith(expect.objectContaining({ status: "complete" }));
  });

  it("refuses to complete twice (400)", async () => {
    const eventLookup = createQueryChain([{ id: "e1", status: "completed", setlistId: null }]);
    mockDb.select
      .mockImplementationOnce(() => membership("admin"))
      .mockImplementationOnce(() => eventLookup);

    const res = await request(app)
      .post("/api/events/e1/complete")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(400);
  });
});

describe("Templates apply creates labelled empty slots", () => {
  it("creates a set list with one row per slot (songId null)", async () => {
    const templateLookup = createQueryChain([
      { id: "t1", title: "Sunday shape", description: null, structure: [{ label: "Fast opener" }, { label: "Slow" }] },
    ]);
    const setlistInsert = createInsertChain([{ id: "s-new", name: "Sunday shape" }]);
    const slotsInsert = createInsertChain([]);
    const activityInsert = createInsertChain([]);

    mockDb.select
      .mockImplementationOnce(() => membership("musician"))
      .mockImplementationOnce(() => templateLookup);
    mockDb.insert
      .mockImplementationOnce(() => setlistInsert)
      .mockImplementationOnce(() => slotsInsert)
      .mockImplementationOnce(() => activityInsert);

    const res = await request(app)
      .post("/api/setlists/templates/t1/apply")
      .set("Cookie", `token=${tokenFor()}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.slotCount).toBe(2);
    const slotRows = slotsInsert.values.mock.calls[0][0];
    expect(slotRows).toEqual([
      expect.objectContaining({ songId: null, slotLabel: "Fast opener", position: 1 }),
      expect.objectContaining({ songId: null, slotLabel: "Slow", position: 2 }),
    ]);
  });
});

describe("Availability self-service", () => {
  it("members can set their own availability", async () => {
    const upsertChain = createInsertChain([{ userId: "user-member", date: "2099-01-01", status: "available" }]);
    mockDb.select.mockImplementationOnce(() => membership("observer"));
    mockDb.insert.mockImplementationOnce(() => upsertChain);

    const res = await request(app)
      .put("/api/availability")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ date: "2099-01-01", status: "available" });

    expect(res.status).toBe(200);
  });

  it("members cannot edit someone else's row (403)", async () => {
    mockDb.select.mockImplementationOnce(() => membership("musician"));

    const res = await request(app)
      .put("/api/availability")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ userId: "someone-else", date: "2099-01-01", status: "available" });

    expect(res.status).toBe(403);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("admins can edit anyone's row", async () => {
    const upsertChain = createInsertChain([{ userId: "someone-else", date: "2099-01-01", status: "tentative" }]);
    mockDb.select.mockImplementationOnce(() => membership("admin"));
    mockDb.insert.mockImplementationOnce(() => upsertChain);

    const res = await request(app)
      .put("/api/availability")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ userId: "someone-else", date: "2099-01-01", status: "tentative" });

    expect(res.status).toBe(200);
  });
});

describe("Activity log access", () => {
  it("is admin-only (403 for musician)", async () => {
    mockDb.select.mockImplementationOnce(() => membership("musician"));
    const res = await request(app)
      .get("/api/activity")
      .set("Cookie", `token=${tokenFor()}`);
    expect(res.status).toBe(403);
  });

  it("returns entries for admins", async () => {
    const entriesChain = createQueryChain([
      { id: "a1", action: "song.created", actorName: "Sam", createdAt: "2026-07-01T00:00:00Z" },
    ]);
    mockDb.select
      .mockImplementationOnce(() => membership("admin"))
      .mockImplementationOnce(() => entriesChain);

    const res = await request(app)
      .get("/api/activity")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(1);
  });
});
