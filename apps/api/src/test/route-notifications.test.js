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

const TEST_SECRET = "test-secret-for-notification-tests";
vi.mock("../../src/config/env.js", () => ({
  env: {
    JWT_SECRET: TEST_SECRET,
    CORS_ORIGIN: "http://localhost:5176",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
  },
}));

const { app } = await import("../../src/app.js");
const { notifyOrgMembers, notifyUser } = await import("../../src/features/notifications/service.js");

function createQueryChain(result) {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(result)),
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

function tokenFor(userId = "user-1") {
  return jwt.sign({ id: userId, role: "member" }, TEST_SECRET, { expiresIn: "1h" });
}

describe("Notifications API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReset();
    mockDb.insert.mockReset();
    mockDb.update.mockReset();
    mockDb.delete.mockReset();
  });

  it("requires authentication (401)", async () => {
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(401);
  });

  it("lists own notifications only (scoped by userId in query)", async () => {
    const listChain = createQueryChain([
      { id: "n1", userId: "user-1", type: "event", title: "Upcoming event", readAt: null },
    ]);
    mockDb.select.mockImplementationOnce(() => listChain);

    const res = await request(app)
      .get("/api/notifications")
      .set("Cookie", `token=${tokenFor("user-1")}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(1);
    expect(listChain.where).toHaveBeenCalledTimes(1);
  });

  it("returns unread count", async () => {
    const countChain = createQueryChain([{ count: 3 }]);
    mockDb.select.mockImplementationOnce(() => countChain);

    const res = await request(app)
      .get("/api/notifications/unread-count")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
  });

  it("marks one read, 404 when not owned", async () => {
    const missChain = createUpdateChain([]);
    mockDb.update.mockImplementationOnce(() => missChain);

    const res = await request(app)
      .post("/api/notifications/other-users-notification/read")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(404);
  });

  it("marks all read", async () => {
    const updateChain = createUpdateChain([]);
    mockDb.update.mockImplementationOnce(() => updateChain);

    const res = await request(app)
      .post("/api/notifications/read-all")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(updateChain.set).toHaveBeenCalledWith({ readAt: expect.any(Date) });
  });

  it("clears all own notifications", async () => {
    const deleteChain = { where: vi.fn(() => Promise.resolve()) };
    mockDb.delete.mockImplementationOnce(() => deleteChain);

    const res = await request(app)
      .delete("/api/notifications")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(deleteChain.where).toHaveBeenCalledTimes(1);
  });
});

describe("Notification producers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReset();
    mockDb.insert.mockReset();
  });

  it("notifyOrgMembers inserts one row per recipient, excluding the actor", async () => {
    const membersChain = createQueryChain([
      { userId: "actor", role: "admin" },
      { userId: "u2", role: "musician" },
      { userId: "u3", role: "observer" },
    ]);
    const insertChain = { values: vi.fn(() => Promise.resolve()) };
    mockDb.select.mockImplementationOnce(() => membersChain);
    mockDb.insert.mockImplementationOnce(() => insertChain);

    await notifyOrgMembers(
      "org-1",
      { type: "event", title: "New event", linkPath: "/dashboard" },
      { excludeUserId: "actor" },
    );

    expect(insertChain.values).toHaveBeenCalledWith([
      expect.objectContaining({ userId: "u2", type: "event", title: "New event" }),
      expect.objectContaining({ userId: "u3", type: "event", title: "New event" }),
    ]);
  });

  it("notifyOrgMembers filters by role when requested", async () => {
    const membersChain = createQueryChain([
      { userId: "u1", role: "admin" },
      { userId: "u2", role: "musician" },
    ]);
    const insertChain = { values: vi.fn(() => Promise.resolve()) };
    mockDb.select.mockImplementationOnce(() => membersChain);
    mockDb.insert.mockImplementationOnce(() => insertChain);

    await notifyOrgMembers("org-1", { type: "team", title: "Invite" }, { roles: ["admin"] });

    expect(insertChain.values).toHaveBeenCalledWith([
      expect.objectContaining({ userId: "u1" }),
    ]);
  });

  it("producers swallow DB failures instead of throwing", async () => {
    mockDb.select.mockImplementationOnce(() => {
      throw new Error("db down");
    });
    await expect(notifyOrgMembers("org-1", { type: "event", title: "X" })).resolves.toBeUndefined();

    mockDb.insert.mockImplementationOnce(() => {
      throw new Error("db down");
    });
    await expect(notifyUser("u1", { type: "team", title: "X" })).resolves.toBeUndefined();
  });
});
