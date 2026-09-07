/**
 * Session lifetime: signing in sets a cookie that lives as long as the
 * token (180 days by default), `GET /auth/me` renews the cookie once the
 * token is past half of its life, and logout clears it with matching
 * attributes. Runs the real Express app against pg-mem.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createPgMemDb } from "./helpers/pgMemDb.js";

const memDb = createPgMemDb();
vi.mock("../db.js", () => memDb);

const TEST_SECRET = "test-secret-for-sessions";
vi.mock("../config/env.js", () => ({
  env: {
    NODE_ENV: "test",
    JWT_SECRET: "test-secret-for-sessions",
    JWT_EXPIRES_IN: "180d",
    CORS_ORIGIN: "http://localhost:5176",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
  },
}));

const { app } = await import("../app.js");
const { users } = await import("../schema/index.js");

const DAY = 24 * 60 * 60;
const LIFETIME = 180 * DAY;
const PASSWORD = "correct horse battery";
let user;

function cookieHeader(res) {
  const header = res.headers["set-cookie"];
  if (!header) return null;
  return (Array.isArray(header) ? header : [header]).find((c) => c.startsWith("token=")) ?? null;
}

function maxAgeOf(cookie) {
  const match = /Max-Age=(\d+)/.exec(cookie);
  return match ? Number(match[1]) : null;
}

function tokenIssued(secondsAgo) {
  const iat = Math.floor(Date.now() / 1000) - secondsAgo;
  return jwt.sign({ id: user.id, email: user.email, role: user.role, iat }, TEST_SECRET, { expiresIn: LIFETIME });
}

beforeAll(async () => {
  const { db } = memDb;
  [user] = await db
    .insert(users)
    .values({ email: "kevin@vpc.church", displayName: "Kevin", role: "member", passwordHash: await bcrypt.hash(PASSWORD, 4) })
    .returning();
});

describe("session cookie", () => {
  it("login sets an HttpOnly, SameSite=Lax cookie that lives as long as the token", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: user.email, password: PASSWORD });
    expect(res.status).toBe(200);
    const cookie = cookieHeader(res);
    expect(cookie).toBeTruthy();
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Secure"); // NODE_ENV=test; staging and production set it
    const maxAge = maxAgeOf(cookie);
    expect(maxAge).toBeGreaterThan(LIFETIME - 10);
    expect(maxAge).toBeLessThanOrEqual(LIFETIME);
    const exp = jwt.decode(res.body.token).exp;
    expect(exp - Math.floor(Date.now() / 1000)).toBeGreaterThan(LIFETIME - 10);
  });

  it("GET /auth/me re-issues the cookie once the token is past half of its life", async () => {
    const old = tokenIssued(100 * DAY);
    const res = await request(app).get("/api/auth/me").set("Cookie", `token=${old}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
    const cookie = cookieHeader(res);
    expect(cookie).toBeTruthy();
    const fresh = cookie.slice("token=".length).split(";")[0];
    expect(fresh).not.toBe(old);
    expect(jwt.verify(fresh, TEST_SECRET).id).toBe(user.id);
    expect(maxAgeOf(cookie)).toBeGreaterThan(LIFETIME - 10);
  });

  it("GET /auth/me leaves a young cookie alone", async () => {
    const young = tokenIssued(5 * DAY);
    const res = await request(app).get("/api/auth/me").set("Cookie", `token=${young}`);
    expect(res.status).toBe(200);
    expect(cookieHeader(res)).toBeNull();
  });

  it("GET /auth/me does not start a cookie session for a bearer token", async () => {
    const old = tokenIssued(100 * DAY);
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${old}`);
    expect(res.status).toBe(200);
    expect(cookieHeader(res)).toBeNull();
  });

  it("logout clears the cookie", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(200);
    const cookie = cookieHeader(res);
    expect(cookie).toMatch(/^token=;/);
    expect(cookie).toContain("Expires=Thu, 01 Jan 1970");
    expect(cookie).toContain("Path=/");
  });
});
