/**
 * GET /songs/contents: every chart a member can open, for offline mode.
 *
 * What must hold: every member gets their church's charts (observers too),
 * nobody gets another church's or someone else's personal song, trash and the
 * archive stay out, and a later sync gets only what changed plus the full list
 * of ids so a device can drop what is gone.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createPgMemDb } from "./helpers/pgMemDb.js";

const memDb = createPgMemDb();
vi.mock("../db.js", () => memDb);

const TEST_SECRET = "test-secret-for-contents";
vi.mock("../config/env.js", () => ({
  env: { JWT_SECRET: "test-secret-for-contents", CORS_ORIGIN: "http://localhost:5176", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" },
}));

const { app } = await import("../app.js");
const { eq } = await import("drizzle-orm");
const { organizations, users, organizationMembers, songs, songVariations } = await import("../schema/index.js");

const cookie = (user) => `token=${jwt.sign({ id: user.id, role: user.role }, TEST_SECRET, { expiresIn: "1h" })}`;
const ids = {};
let bandId, observer, musician, outsider;

beforeAll(async () => {
  const { db } = memDb;
  const [band] = await db.insert(organizations).values({ name: "VPC Band" }).returning();
  const [other] = await db.insert(organizations).values({ name: "Another Church" }).returning();
  bandId = band.id;
  const [watcher] = await db.insert(users).values({ email: "watch@vpc.church", displayName: "Watch", role: "member" }).returning();
  const [keys] = await db.insert(users).values({ email: "keys@vpc.church", displayName: "Keys", role: "member" }).returning();
  const [elsewhere] = await db.insert(users).values({ email: "admin@else.church", displayName: "Else", role: "member" }).returning();
  await db.insert(organizationMembers).values({ organizationId: band.id, userId: watcher.id, role: "observer" });
  await db.insert(organizationMembers).values({ organizationId: band.id, userId: keys.id, role: "musician" });
  await db.insert(organizationMembers).values({ organizationId: other.id, userId: elsewhere.id, role: "admin" });
  observer = cookie(watcher);
  musician = cookie(keys);
  outsider = cookie(elsewhere);

  const old = new Date("2026-09-01T00:00:00Z");
  const add = async (name, values) => {
    [{ id: ids[name] }] = await db
      .insert(songs)
      .values({ title: name, content: `{title: ${name}}\n[G]${name}`, organizationId: band.id, createdBy: keys.id, updatedAt: old, ...values })
      .returning();
  };
  await add("Way Maker", {});
  await add("Draft Song", { isDraft: true });
  await add("Archived", { isArchived: true });
  await add("Trashed", { deletedAt: new Date() });
  await add("Keys Private", { tier: "personal" });
  await add("Their Song", { organizationId: other.id, createdBy: elsewhere.id });
  await add("Varied", {});
  const [variation] = await db.insert(songVariations).values({ songId: ids.Varied, name: "Acoustic", key: "D", content: "{title: Varied}\n[D]The acoustic one" }).returning();
  await db.update(songs).set({ defaultVariationId: variation.id, updatedAt: old }).where(eq(songs.id, ids.Varied));
});

const contents = (who = observer, query = "") =>
  request(app).get(`/api/songs/contents${query}`).set("Cookie", who).set("X-Organization-Id", bandId);
const titles = (res) => res.body.songs.map((entry) => entry.song.title).sort();

describe("GET /songs/contents", () => {
  it("gives any member every chart they can open, with its content, and nothing else", async () => {
    const res = await contents();
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(titles(res)).toEqual(["Draft Song", "Varied", "Way Maker"]);
    const wayMaker = res.body.songs.find((entry) => entry.song.title === "Way Maker");
    expect(wayMaker.song.content).toBe("{title: Way Maker}\n[G]Way Maker");
    expect(wayMaker.variations).toEqual([]);
    expect([...res.body.ids].sort()).toEqual([ids["Draft Song"], ids.Varied, ids["Way Maker"]].sort());
  });

  it("includes personal songs for their owner only", async () => {
    expect(titles(await contents(musician))).toContain("Keys Private");
    expect(titles(await contents(observer))).not.toContain("Keys Private");
  });

  it("carries the default variation the chart page shows", async () => {
    const varied = (await contents()).body.songs.find((entry) => entry.song.title === "Varied");
    expect(varied.variations).toEqual([expect.objectContaining({ key: "D", content: "{title: Varied}\n[D]The acoustic one" })]);
  });

  it("sends only what changed since the last sync, and still every id", async () => {
    const first = await contents();
    await memDb.db.update(songs).set({ content: "{title: Way Maker}\n[A]Changed", updatedAt: new Date(Date.now() + 1000) }).where(eq(songs.id, ids["Way Maker"]));
    const next = await contents(observer, `?since=${encodeURIComponent(first.body.fetchedAt)}`);
    expect(titles(next)).toEqual(["Way Maker"]);
    expect(next.body.songs[0].song.content).toContain("[A]Changed");
    expect(next.body.ids).toHaveLength(3);
  });

  it("refuses a since that is not a date, and anyone signed out", async () => {
    expect((await contents(observer, "?since=yesterday-ish")).status).toBe(400);
    expect((await request(app).get("/api/songs/contents")).status).toBe(401);
  });

  it("never gives another church's charts, whatever organization is asked for", async () => {
    const res = await contents(outsider);
    expect(res.body.songs?.map((entry) => entry.song.title) ?? []).not.toContain("Way Maker");
  });
});
