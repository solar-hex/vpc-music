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

const TEST_SECRET = "test-secret-for-custom-role-tests";
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
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve) => Promise.resolve(result).then(resolve),
  };
  // limit() ends most chains; make it awaitable too
  chain.limit = vi.fn(() => ({ then: (resolve) => Promise.resolve(result).then(resolve) }));
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

/** Membership row; customRoleId simulates the overlay. */
function membership(role, customRoleId = null) {
  return createQueryChain([{ id: "org-1", name: "Test Church", role, customRoleId }]);
}

describe("Custom roles — permission overlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReset();
    mockDb.insert.mockReset();
    mockDb.update.mockReset();
    mockDb.delete.mockReset();
  });

  it("grants access when the custom role includes the permission (observer base + songs:edit)", async () => {
    // Base observer would be 403, but the custom role grants songs:edit
    const customRoleLookup = createQueryChain([{ permissions: ["songs:edit"] }]);
    const existsChain = createQueryChain([{ id: "song-1" }]);
    const updateChain = createUpdateChain([]);
    mockDb.select
      .mockImplementationOnce(() => membership("observer", "role-song-editor"))
      .mockImplementationOnce(() => customRoleLookup)
      .mockImplementationOnce(() => existsChain);
    mockDb.update.mockImplementationOnce(() => updateChain);

    const res = await request(app)
      .delete("/api/songs/song-1")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
  });

  it("denies access when the custom role lacks the permission (musician base minus setlists:edit)", async () => {
    // Base musician could edit setlists; custom role restricts to songs only
    const customRoleLookup = createQueryChain([{ permissions: ["songs:edit"] }]);
    mockDb.select
      .mockImplementationOnce(() => membership("musician", "role-song-only"))
      .mockImplementationOnce(() => customRoleLookup);

    const res = await request(app)
      .post("/api/setlists")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ name: "Blocked" });

    expect(res.status).toBe(403);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("members without a custom role keep exact base-role behavior", async () => {
    mockDb.select.mockImplementationOnce(() => membership("observer"));

    const res = await request(app)
      .post("/api/setlists")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ name: "Blocked" });

    expect(res.status).toBe(403);
  });
});

describe("Roles CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReset();
    mockDb.insert.mockReset();
    mockDb.update.mockReset();
    mockDb.delete.mockReset();
  });

  it("lists system + custom roles for any member", async () => {
    const baseCounts = createQueryChain([
      { role: "admin", count: 1 },
      { role: "musician", count: 3 },
    ]);
    const customRolesChain = createQueryChain([
      { id: "r1", name: "Song Editor", permissions: ["songs:edit"], memberCount: 2 },
    ]);
    mockDb.select
      .mockImplementationOnce(() => membership("observer"))
      .mockImplementationOnce(() => baseCounts)
      .mockImplementationOnce(() => customRolesChain);

    const res = await request(app)
      .get("/api/roles")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    const names = res.body.roles.map((role) => role.name);
    expect(names).toContain("Worship Leader");
    expect(names).toContain("Musician");
    expect(names).toContain("Observer");
    expect(names).toContain("Song Editor");
    const system = res.body.roles.find((role) => role.id === "admin");
    expect(system.isSystem).toBe(true);
    expect(system.memberCount).toBe(1);
  });

  it("creates a custom role (admin), dropping unknown permission ids", async () => {
    const duplicateChain = createQueryChain([]);
    const insertChain = createInsertChain([
      { id: "r1", name: "Song Editor", permissions: ["songs:edit"] },
    ]);
    mockDb.select
      .mockImplementationOnce(() => membership("admin"))
      .mockImplementationOnce(() => duplicateChain);
    mockDb.insert.mockImplementationOnce(() => insertChain);

    const res = await request(app)
      .post("/api/roles")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ name: "Song Editor", permissions: ["songs:edit", "bogus:permission"] });

    expect(res.status).toBe(201);
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Song Editor", permissions: ["songs:edit"] }),
    );
  });

  it("blocks musicians from managing roles (403)", async () => {
    mockDb.select.mockImplementationOnce(() => membership("musician"));

    const res = await request(app)
      .post("/api/roles")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ name: "Nope", permissions: [] });

    expect(res.status).toBe(403);
  });

  it("deleting a custom role resets its members to base role", async () => {
    const existsChain = createQueryChain([{ id: "r1" }]);
    const resetChain = createUpdateChain([]);
    const deleteChain = { where: vi.fn(() => Promise.resolve()) };
    mockDb.select
      .mockImplementationOnce(() => membership("admin"))
      .mockImplementationOnce(() => existsChain);
    mockDb.update.mockImplementationOnce(() => resetChain);
    mockDb.delete.mockImplementationOnce(() => deleteChain);

    const res = await request(app)
      .delete("/api/roles/r1")
      .set("Cookie", `token=${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(resetChain.set).toHaveBeenCalledWith({ customRoleId: null });
    expect(deleteChain.where).toHaveBeenCalled();
  });

  it("assigns a custom role to a member via admin route", async () => {
    const membershipLookup = createQueryChain([{ id: "m1", userId: "u2" }]);
    const roleLookup = createQueryChain([{ id: "r1" }]);
    const updateChain = createUpdateChain([]);
    mockDb.select
      .mockImplementationOnce(() => membership("admin"))
      .mockImplementationOnce(() => membershipLookup)
      .mockImplementationOnce(() => roleLookup);
    mockDb.update.mockImplementationOnce(() => updateChain);
    // Post-update notification lookup (notifyUser insert)
    mockDb.insert.mockImplementation(() => ({ values: vi.fn(() => Promise.resolve()) }));

    const res = await request(app)
      .put("/api/admin/users/u2/role")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ customRoleId: "r1" });

    expect(res.status).toBe(200);
    expect(updateChain.set).toHaveBeenCalledWith({ customRoleId: "r1" });
  });
});
