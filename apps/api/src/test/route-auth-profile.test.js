/**
 * Every auth response carries the caller's team. The web app reads the
 * active organization straight from the sign-in payload, so a login that
 * omitted `organizations` made a seeded member look like someone with no
 * team ("Ask your worship leader for an invite") until the next reload,
 * where `GET /auth/me` filled it in. Runs the real routes against pg-mem.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createPgMemDb } from "./helpers/pgMemDb.js";

const memDb = createPgMemDb();
vi.mock("../db.js", () => memDb);

const TEST_SECRET = "test-secret-for-auth-profile";
vi.mock("../config/env.js", () => ({
  env: {
    NODE_ENV: "test",
    JWT_SECRET: "test-secret-for-auth-profile",
    JWT_EXPIRES_IN: "180d",
    CORS_ORIGIN: "http://localhost:5176",
    FRONTEND_URL: "http://localhost:5176",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
  },
}));

const { app } = await import("../app.js");
const { organizations, organizationMembers, users } = await import("../schema/index.js");

const PASSWORD = "password123";
let org;
let musician;
let owner;
let invitee;

function cookieFor(user) {
  return `token=${jwt.sign({ id: user.id, email: user.email, role: user.role }, TEST_SECRET, { expiresIn: "1h" })}`;
}

beforeAll(async () => {
  const { db } = memDb;
  const passwordHash = await bcrypt.hash(PASSWORD, 4);

  [org] = await db.insert(organizations).values({ name: "Valley Praise Church" }).returning();

  [musician] = await db
    .insert(users)
    .values({ email: "keys@vpc.church", displayName: "Alex Rivera", role: "member", passwordHash })
    .returning();
  [owner] = await db
    .insert(users)
    .values({ email: "worship-leader@vpc.church", displayName: "Jordan Mitchell", role: "owner", passwordHash })
    .returning();
  // Invited: no password yet, so POST /auth/set-password signs them in.
  [invitee] = await db
    .insert(users)
    .values({ email: "bass@vpc.church", displayName: "Sam Lee", role: "member" })
    .returning();

  await db.insert(organizationMembers).values({ organizationId: org.id, userId: musician.id, role: "musician" });
  await db.insert(organizationMembers).values({ organizationId: org.id, userId: invitee.id, role: "observer" });
  // The owner deliberately has no membership row: they should still see the org.
});

describe("auth responses carry the team", () => {
  it("POST /auth/login returns the member's organizations", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: musician.email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.organizations).toEqual([{ id: org.id, name: "Valley Praise Church", role: "musician" }]);
  });

  it("GET /auth/me returns the same shape as login", async () => {
    const login = await request(app).post("/api/auth/login").send({ email: musician.email, password: PASSWORD });
    const me = await request(app).get("/api/auth/me").set("Cookie", cookieFor(musician));
    expect(me.status).toBe(200);
    expect(me.body.user.organizations).toEqual(login.body.user.organizations);
    expect(me.body.user.id).toBe(login.body.user.id);
    expect(me.body.user.email).toBe(login.body.user.email);
    expect(me.body.user.role).toBe(login.body.user.role);
  });

  it("a global owner sees an organization they hold no membership row in", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: owner.email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.organizations).toEqual([{ id: org.id, name: "Valley Praise Church", role: "admin" }]);
  });

  it("POST /auth/set-password signs an invited member in with their team", async () => {
    const res = await request(app).post("/api/auth/set-password").send({ email: invitee.email, password: "brand-new-password" });
    expect(res.status).toBe(200);
    expect(res.body.user.organizations).toEqual([{ id: org.id, name: "Valley Praise Church", role: "observer" }]);
  });

  it("POST /auth/register returns an empty team rather than no field at all", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "newcomer@vpc.church", password: "a-brand-new-password", displayName: "Newcomer" });
    expect(res.status).toBe(201);
    expect(res.body.user.organizations).toEqual([]);
  });
});
