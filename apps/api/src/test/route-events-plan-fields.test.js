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

const TEST_SECRET = "test-secret-for-event-plan-tests";
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
    where: vi.fn(() => chain),
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

describe("Events — plan fields (theme, preparedBy, team)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReset();
    mockDb.insert.mockReset();
    mockDb.update.mockReset();
    mockDb.delete.mockReset();
  });

  it("creates an event with plan fields as musician", async () => {
    const insertChain = createInsertChain([{ id: "e1", title: "Sunday", theme: "Gratitude" }]);
    mockDb.select.mockImplementationOnce(() => membership("musician"));
    mockDb.insert.mockImplementationOnce(() => insertChain);

    const res = await request(app)
      .post("/api/events")
      .set("Cookie", `token=${tokenFor()}`)
      .send({
        title: "Sunday",
        date: "2099-01-05T10:00:00.000Z",
        theme: "Gratitude",
        preparedBy: "user-lead",
        team: [
          { userId: "u1", name: "Alex", role: "Drums" },
          { name: "  Jo  " },
          { name: "" }, // dropped — empty name
          "garbage", // dropped — not an object
        ],
      });

    expect(res.status).toBe(201);
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Sunday",
        theme: "Gratitude",
        preparedBy: "user-lead",
        team: [
          { userId: "u1", name: "Alex", role: "Drums" },
          { name: "Jo" },
        ],
      }),
    );
  });

  it("stores null when team payload is not an array", async () => {
    const insertChain = createInsertChain([{ id: "e1" }]);
    mockDb.select.mockImplementationOnce(() => membership("admin"));
    mockDb.insert.mockImplementationOnce(() => insertChain);

    const res = await request(app)
      .post("/api/events")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ title: "Sunday", date: "2099-01-05T10:00:00.000Z", team: "not-an-array" });

    expect(res.status).toBe(201);
    expect(insertChain.values).toHaveBeenCalledWith(expect.objectContaining({ team: null }));
  });

  it("updates plan fields as admin", async () => {
    const existingChain = createQueryChain([{ id: "e1" }]);
    const updateChain = createUpdateChain([{ id: "e1", theme: "Renewal" }]);
    mockDb.select
      .mockImplementationOnce(() => membership("admin"))
      .mockImplementationOnce(() => existingChain);
    mockDb.update.mockImplementationOnce(() => updateChain);

    const res = await request(app)
      .put("/api/events/e1")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ theme: "Renewal", team: [{ name: "Sam", role: "Keys" }] });

    expect(res.status).toBe(200);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ theme: "Renewal", team: [{ name: "Sam", role: "Keys" }] }),
    );
  });

  it("leaves team untouched on update when not provided", async () => {
    const existingChain = createQueryChain([{ id: "e1" }]);
    const updateChain = createUpdateChain([{ id: "e1" }]);
    mockDb.select
      .mockImplementationOnce(() => membership("admin"))
      .mockImplementationOnce(() => existingChain);
    mockDb.update.mockImplementationOnce(() => updateChain);

    const res = await request(app)
      .put("/api/events/e1")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ title: "Renamed" });

    expect(res.status).toBe(200);
    const setArg = updateChain.set.mock.calls[0][0];
    expect(setArg).not.toHaveProperty("team");
  });

  it("rejects event creation for observers (403)", async () => {
    mockDb.select.mockImplementationOnce(() => membership("observer"));

    const res = await request(app)
      .post("/api/events")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ title: "Sunday", date: "2099-01-05T10:00:00.000Z", theme: "Hope" });

    expect(res.status).toBe(403);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("rejects event update for observers (403)", async () => {
    mockDb.select.mockImplementationOnce(() => membership("observer"));

    const res = await request(app)
      .put("/api/events/e1")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ theme: "Hope" });

    expect(res.status).toBe(403);
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});

describe("Organizations — GET /current/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReset();
  });

  it("returns members for any org role, including observer", async () => {
    const membersChain = createQueryChain([
      { userId: "u1", displayName: "Alex", role: "admin" },
      { userId: "u2", displayName: "Jo", role: "observer" },
    ]);
    mockDb.select
      .mockImplementationOnce(() => membership("observer"))
      .mockImplementationOnce(() => membersChain);

    const res = await request(app)
      .get("/api/organizations/current/members")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(2);
    expect(res.body.members[0]).toEqual({ userId: "u1", displayName: "Alex", role: "admin" });
  });

  it("requires an org context (400 when user has no org)", async () => {
    mockDb.select.mockImplementationOnce(() => createQueryChain([]));

    const res = await request(app)
      .get("/api/organizations/current/members")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(400);
  });

  it("requires authentication (401 without token)", async () => {
    const res = await request(app).get("/api/organizations/current/members");
    expect(res.status).toBe(401);
  });
});
