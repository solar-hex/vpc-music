/**
 * A song belongs to its church. Every route that reads or changes one song by
 * id must answer another church's people exactly as if the song did not exist,
 * even an admin with every permission in their own church.
 *
 * These routes used to look the song up by id alone: archive, unarchive,
 * restore, permanent delete, status, favorite, history, usage, set lists,
 * variations and the four exports. Runs the real app against pg-mem.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createPgMemDb } from "./helpers/pgMemDb.js";

const memDb = createPgMemDb();
vi.mock("../db.js", () => memDb);

const TEST_SECRET = "test-secret-for-church-scope";
vi.mock("../config/env.js", () => ({
  env: { JWT_SECRET: "test-secret-for-church-scope", CORS_ORIGIN: "http://localhost:5176", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" },
}));

const { app } = await import("../app.js");
const { eq } = await import("drizzle-orm");
const { organizations, users, organizationMembers, songs, songVariations, songUsages } = await import("../schema/index.js");

const cookie = (user) => `token=${jwt.sign({ id: user.id, role: user.role }, TEST_SECRET, { expiresIn: "1h" })}`;
let band, other, lead, keys, watcher, outsider;
let songId, personalId, globalId, variationId, usageId;

beforeAll(async () => {
  const { db } = memDb;
  [band] = await db.insert(organizations).values({ name: "VPC Band" }).returning();
  [other] = await db.insert(organizations).values({ name: "Another Church" }).returning();
  const person = async (email, org, role) => {
    const [user] = await db.insert(users).values({ email, displayName: email, role: "member" }).returning();
    await db.insert(organizationMembers).values({ organizationId: org.id, userId: user.id, role });
    return user;
  };
  const leadUser = await person("lead@vpc.church", band, "admin");
  const keysUser = await person("keys@vpc.church", band, "musician");
  const watcherUser = await person("watch@vpc.church", band, "observer");
  const outsiderUser = await person("admin@else.church", other, "admin");
  lead = cookie(leadUser);
  keys = cookie(keysUser);
  watcher = cookie(watcherUser);
  outsider = cookie(outsiderUser);

  [{ id: songId }] = await db.insert(songs).values({ title: "Way Maker", content: "{title: Way Maker}\n[E]Way maker", organizationId: band.id, createdBy: leadUser.id }).returning();
  [{ id: personalId }] = await db.insert(songs).values({ title: "Keys Sketch", content: "[C]Sketch", organizationId: band.id, createdBy: keysUser.id, tier: "personal" }).returning();
  [{ id: globalId }] = await db.insert(songs).values({ title: "Core Hymn", content: "[G]Core", organizationId: other.id, createdBy: outsiderUser.id, tier: "global" }).returning();
  [{ id: variationId }] = await db.insert(songVariations).values({ songId, name: "Acoustic", content: "[D]Acoustic", key: "D" }).returning();
  [{ id: usageId }] = await db.insert(songUsages).values({ songId, usedAt: "2026-09-13", organizationId: band.id, recordedBy: leadUser.id }).returning();
});

const as = (who, org, req) => req.set("Cookie", who).set("X-Organization-Id", org.id);
const song = async (id) => (await memDb.db.select().from(songs).where(eq(songs.id, id)))[0];

describe("another church's admin", () => {
  const routes = () => [
    ["delete", `/api/songs/${songId}/permanent`],
    ["post", `/api/songs/${songId}/restore`],
    ["post", `/api/songs/${songId}/archive`],
    ["post", `/api/songs/${songId}/unarchive`],
    ["patch", `/api/songs/${songId}/status`, { status: "ready" }],
    ["post", `/api/songs/${songId}/favorite`],
    ["get", `/api/songs/${songId}/setlists`],
    ["get", `/api/songs/${songId}/history`],
    ["get", `/api/songs/${songId}/usage`],
    ["post", `/api/songs/${songId}/usage`, { usedAt: "2026-09-14" }],
    ["delete", `/api/songs/${songId}/usage/${usageId}`],
    ["post", `/api/songs/${songId}/variations`, { name: "Theirs", content: "[C]x" }],
    ["put", `/api/songs/${songId}/variations/${variationId}`, { content: "[C]overwritten" }],
    ["delete", `/api/songs/${songId}/variations/${variationId}`],
    ["get", `/api/songs/${songId}/export/chordpro`],
    ["get", `/api/songs/${songId}/export/onsong`],
    ["get", `/api/songs/${songId}/export/text`],
    ["get", `/api/songs/${songId}/export/pdf`],
  ];

  it("finds nothing at any route that takes a song id, and changes nothing", async () => {
    for (const [method, url, body] of routes()) {
      const res = await as(outsider, other, request(app)[method](url)).send(body);
      expect(res.status, `${method.toUpperCase()} ${url}`).toBe(404);
    }
    const after = await song(songId);
    expect(after).toMatchObject({ isArchived: false, status: null, deletedAt: null });
    const [variation] = await memDb.db.select().from(songVariations).where(eq(songVariations.id, variationId));
    expect(variation.content).toBe("[D]Acoustic");
    expect(await memDb.db.select().from(songUsages).where(eq(songUsages.id, usageId))).toHaveLength(1);
  });

  it("can still read a song from the global library", async () => {
    const res = await as(keys, band, request(app).get(`/api/songs/${globalId}/export/chordpro`));
    expect(res.status).toBe(200);
    expect(res.text).toContain("[G]Core");
  });
});

describe("the song's own church", () => {
  it("archives and brings back a song", async () => {
    expect((await as(keys, band, request(app).post(`/api/songs/${songId}/archive`))).status).toBe(200);
    expect((await song(songId)).isArchived).toBe(true);
    expect((await as(keys, band, request(app).post(`/api/songs/${songId}/unarchive`))).status).toBe(200);
    expect((await song(songId)).isArchived).toBe(false);
  });

  it("downloads a chart from a plain link, which carries no organization header", async () => {
    const res = await request(app).get(`/api/songs/${songId}/export/text`).set("Cookie", watcher);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Way maker");
  });

  it("reads usage and history, and logs a play", async () => {
    expect((await as(watcher, band, request(app).get(`/api/songs/${songId}/usage`))).body.usages).toHaveLength(1);
    expect((await as(watcher, band, request(app).get(`/api/songs/${songId}/history`))).status).toBe(200);
    expect((await as(keys, band, request(app).post(`/api/songs/${songId}/usage`)).send({ usedAt: "2026-09-14" })).status).toBe(201);
  });

  it("keeps someone's personal song theirs to download", async () => {
    expect((await request(app).get(`/api/songs/${personalId}/export/chordpro`).set("Cookie", watcher)).status).toBe(404);
    expect((await request(app).get(`/api/songs/${personalId}/export/chordpro`).set("Cookie", keys)).status).toBe(200);
  });

  it("answers a malformed id with a 404, not a database error", async () => {
    expect((await as(lead, band, request(app).post("/api/songs/not-a-song/archive"))).status).toBe(404);
  });
});
