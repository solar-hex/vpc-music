/**
 * Regression guard for a real, previously-shipped bug: every setlist
 * mutation/read-by-id route (GET /:id, GET /:id/export/zip, PUT /:id,
 * POST /:id/approve|archive|unarchive|restore|complete|reopen,
 * DELETE /:id, DELETE /:id/permanent, POST /:id/songs,
 * PUT /:id/songs, PATCH /:id/songs/:songItemId, DELETE /:id/songs/:songItemId)
 * resolved the target row by `eq(setlists.id, req.params.id)` alone, never
 * checking it belonged to the caller's organization. `req.org` reflects only
 * the CALLER's own membership (see middlewares/orgContext.js) — it has no
 * relationship to which org actually owns the :id in the URL. Any
 * authenticated member of ANY org, holding the right permission in THEIR OWN
 * org, could view, export, edit, reorder, archive, or delete another org's
 * setlist just by knowing its id.
 *
 * Runs the ACTUAL Express app and ACTUAL Drizzle queries against pg-mem with
 * two real, separate organizations — not hand-rolled mocks — so a regression
 * here would show up as a real cross-tenant data leak, not just a mock
 * assertion.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createPgMemDb } from "./helpers/pgMemDb.js";

const memDb = createPgMemDb();
vi.mock("../db.js", () => memDb);

const TEST_SECRET = "test-secret-for-setlist-cross-org";
vi.mock("../config/env.js", () => ({
  env: {
    JWT_SECRET: TEST_SECRET,
    CORS_ORIGIN: "http://localhost:5176",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
  },
}));

const { app } = await import("../app.js");
const { organizations, users, organizationMembers, setlists, songs } = await import("../schema/index.js");

let orgACookie, orgBCookie, orgBId, setlistAId, songAId;

beforeAll(async () => {
  const { db } = memDb;

  const [orgA] = await db.insert(organizations).values({ name: "Org A Church" }).returning();
  const [orgB] = await db.insert(organizations).values({ name: "Org B Church" }).returning();
  orgBId = orgB.id;

  const [userA] = await db.insert(users).values({ email: "leader@org-a.church", displayName: "Org A Leader", role: "member" }).returning();
  const [userB] = await db.insert(users).values({ email: "leader@org-b.church", displayName: "Org B Leader", role: "member" }).returning();

  await db.insert(organizationMembers).values({ organizationId: orgA.id, userId: userA.id, role: "admin" });
  await db.insert(organizationMembers).values({ organizationId: orgB.id, userId: userB.id, role: "admin" });

  orgACookie = `token=${jwt.sign({ id: userA.id, role: userA.role }, TEST_SECRET, { expiresIn: "1h" })}`;
  orgBCookie = `token=${jwt.sign({ id: userB.id, role: userB.role }, TEST_SECRET, { expiresIn: "1h" })}`;

  const [setlistA] = await db.insert(setlists).values({ name: "Org A's Private Setlist", organizationId: orgA.id, createdBy: userA.id }).returning();
  setlistAId = setlistA.id;

  const [songA] = await db.insert(songs).values({ title: "Org A Song", organizationId: orgA.id, content: "{title: Org A Song}", createdBy: userA.id }).returning();
  songAId = songA.id;
});

describe("setlist routes are organization-scoped (cross-org isolation)", () => {
  it("org B cannot GET org A's setlist by id", async () => {
    const res = await request(app).get(`/api/setlists/${setlistAId}`).set("Cookie", orgBCookie).set("X-Organization-Id", orgBId);
    expect(res.status).toBe(404);
  });

  it("org B cannot export org A's setlist", async () => {
    const res = await request(app).get(`/api/setlists/${setlistAId}/export/zip`).set("Cookie", orgBCookie).set("X-Organization-Id", orgBId);
    expect(res.status).toBe(404);
  });

  it("org B cannot rename org A's setlist via PUT", async () => {
    const res = await request(app)
      .put(`/api/setlists/${setlistAId}`)
      .set("Cookie", orgBCookie)
      .set("X-Organization-Id", orgBId)
      .send({ name: "Hijacked" });
    expect(res.status).toBe(404);

    const stillOwned = await request(app).get(`/api/setlists/${setlistAId}`).set("Cookie", orgACookie);
    expect(stillOwned.body.setlist.name).toBe("Org A's Private Setlist");
  });

  it("org B cannot archive org A's setlist", async () => {
    const res = await request(app).post(`/api/setlists/${setlistAId}/archive`).set("Cookie", orgBCookie).set("X-Organization-Id", orgBId);
    expect(res.status).toBe(404);
  });

  it("org B cannot add a song to org A's setlist", async () => {
    const res = await request(app)
      .post(`/api/setlists/${setlistAId}/songs`)
      .set("Cookie", orgBCookie)
      .set("X-Organization-Id", orgBId)
      .send({ songId: songAId });
    expect(res.status).toBe(404);
  });

  it("org B cannot soft-delete org A's setlist", async () => {
    const res = await request(app).delete(`/api/setlists/${setlistAId}`).set("Cookie", orgBCookie).set("X-Organization-Id", orgBId);
    expect(res.status).toBe(404);

    const stillThere = await request(app).get(`/api/setlists/${setlistAId}`).set("Cookie", orgACookie);
    expect(stillThere.status).toBe(200);
  });

  it("org B cannot permanently delete org A's setlist", async () => {
    const res = await request(app).delete(`/api/setlists/${setlistAId}/permanent`).set("Cookie", orgBCookie).set("X-Organization-Id", orgBId);
    expect(res.status).toBe(404);

    const stillThere = await request(app).get(`/api/setlists/${setlistAId}`).set("Cookie", orgACookie);
    expect(stillThere.status).toBe(200);
  });

  it("org A can still fully manage its own setlist", async () => {
    const res = await request(app)
      .put(`/api/setlists/${setlistAId}`)
      .set("Cookie", orgACookie)
      .send({ name: "Renamed by owner" });
    expect(res.status).toBe(200);
    expect(res.body.setlist.name).toBe("Renamed by owner");
  });
});
