/**
 * Duplicate review: finding copies of one song, merging them, and marking two
 * songs as different.
 *
 * Runs the real Express app and real Drizzle queries against pg-mem. The tests
 * lean on what must not happen: a song from another church showing up or
 * being merged, an observer merging, a merge over someone's newer edit, and a
 * copy merged twice.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createPgMemDb } from "./helpers/pgMemDb.js";

const memDb = createPgMemDb();
vi.mock("../db.js", () => memDb);

const TEST_SECRET = "test-secret-for-duplicates";
vi.mock("../config/env.js", () => ({
  env: { JWT_SECRET: "test-secret-for-duplicates", CORS_ORIGIN: "http://localhost:5176", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" },
}));

const { app } = await import("../app.js");
const { eq } = await import("drizzle-orm");
const { activityLog, organizations, users, organizationMembers, songs } = await import("../schema/index.js");

const PRESS_ON = [
  "We press on through every trial and every storm that comes our way",
  "We press on with eyes on Jesus holding to the hand that holds the day",
  "Nothing in this world can move us we will keep the faith and run the race",
  "Till we see Him face to face we press on",
];

const CHURCH_CHART = [
  "{title: Press On}",
  "{key: G}",
  "{x_source: chrd:press_on.chrd}",
  "",
  "{comment: Verse 1}",
  ...PRESS_ON.map((line) => `[G]${line.replace(" ", " [C]")}`),
].join("\n");

const LYRIC_SHEET = ["{title: We press on}", "{x_source: docx:We press on.docx}", "", "{comment: Chorus}", ...PRESS_ON].join("\n");

const OTHER_SONG = [
  "{title: Morning Light}",
  "{key: D}",
  "",
  "[D]Morning light is breaking over every hill and every sea",
  "[G]All creation sings of mercy rising up in harmony",
].join("\n");

const cookie = (user) => `token=${jwt.sign({ id: user.id, role: user.role }, TEST_SECRET, { expiresIn: "1h" })}`;

let bandId, musician, observer, stranger, chartId, sheetId, otherId, foreignId, archivedId;

beforeEach(async () => {
  const { db } = memDb;
  await db.delete(activityLog);
  await db.delete(songs);
  await db.delete(organizationMembers);
  await db.delete(users);
  await db.delete(organizations);

  const [band] = await db.insert(organizations).values({ name: "VPC Band" }).returning();
  const [elsewhere] = await db.insert(organizations).values({ name: "Another Church" }).returning();
  bandId = band.id;
  const [keys] = await db.insert(users).values({ email: "keys@vpc.church", displayName: "Keys", role: "member" }).returning();
  const [watcher] = await db.insert(users).values({ email: "watch@vpc.church", displayName: "Watch", role: "member" }).returning();
  const [outsider] = await db.insert(users).values({ email: "admin@else.church", displayName: "Else", role: "member" }).returning();
  await db.insert(organizationMembers).values({ organizationId: band.id, userId: keys.id, role: "musician" });
  await db.insert(organizationMembers).values({ organizationId: band.id, userId: watcher.id, role: "observer" });
  await db.insert(organizationMembers).values({ organizationId: elsewhere.id, userId: outsider.id, role: "admin" });
  musician = cookie(keys);
  observer = cookie(watcher);
  stranger = cookie(outsider);

  const add = async (values) => (await db.insert(songs).values({ createdBy: keys.id, organizationId: band.id, ...values }).returning())[0].id;
  sheetId = await add({ title: "We press on", content: LYRIC_SHEET, isDraft: false, status: "missing_chords" });
  chartId = await add({ title: "Press On", key: "G", content: CHURCH_CHART, isDraft: false });
  otherId = await add({ title: "Morning Light", key: "D", content: OTHER_SONG });
  archivedId = await add({ title: "Press On (old)", content: CHURCH_CHART, isArchived: true });
  foreignId = await add({ title: "Press On", content: CHURCH_CHART, organizationId: elsewhere.id, createdBy: outsider.id });
});

const as = (req, who = musician) => req.set("Cookie", who).set("X-Organization-Id", bandId);
const list = (who) => as(request(app).get("/api/songs/duplicates"), who);
const merge = (keepId, body, who) => as(request(app).post(`/api/songs/${keepId}/merge`), who).send(body);
const row = async (id) => (await memDb.db.select().from(songs).where(eq(songs.id, id)))[0];

describe("finding duplicates", () => {
  it("pairs copies whose words match even when their titles do not, the fuller chart on the left", async () => {
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.body.pairs).toHaveLength(1);
    const [pair] = res.body.pairs;
    expect(pair.left).toMatchObject({ id: chartId, title: "Press On", source: "chrd", chords: 8 });
    expect(pair.right).toMatchObject({ id: sheetId, title: "We press on", source: "docx", chords: 0 });
    expect(pair.overlap).toBe(1);
    // an archived copy and another church's copy never appear
    const ids = res.body.pairs.flatMap((p) => [p.left.id, p.right.id]);
    expect(ids).not.toContain(archivedId);
    expect(ids).not.toContain(foreignId);
    expect(ids).not.toContain(otherId);
  });

  it("is for people who can edit songs", async () => {
    expect((await list(observer)).status).toBe(403);
  });
});

describe("merging", () => {
  it("keeps one song with the chart it was given, and archives the other pointing at it", async () => {
    const merged = `${CHURCH_CHART.replace("{key: G}", "{artist: Kevin Duncan}\n{key: A}\n{tempo: 72}")}\n\n{comment: Chorus}\nTill we see Him face to face`;
    const res = await merge(chartId, { otherId: sheetId, content: merged });
    expect(res.status).toBe(200);
    expect(res.body.merged).toEqual({ id: sheetId, title: "We press on" });

    const kept = await row(chartId);
    expect(kept.content).toBe(merged);
    // the song's columns follow the chart, as a save in the editor does
    expect(kept).toMatchObject({ title: "Press On", artist: "Kevin Duncan", key: "A", tempo: 72, isArchived: false });

    const copy = await row(sheetId);
    expect(copy.isArchived).toBe(true);
    expect(copy.content).toContain(`{x_merged_into: ${chartId}}`);
    expect(copy.content).toContain("Till we see Him face to face we press on");

    // archived, so the song list leaves it out; it is off the duplicate list too
    expect((await list()).body.pairs).toEqual([]);
  });

  it("leaves a column alone when the chart has no line for it", async () => {
    const res = await merge(chartId, { otherId: sheetId, content: "[G]We press on" });
    expect(res.status).toBe(200);
    expect(await row(chartId)).toMatchObject({ title: "Press On", key: "G" });
  });

  it("will not merge a song from another church, or anything for an observer", async () => {
    expect((await merge(chartId, { otherId: foreignId, content: CHURCH_CHART })).status).toBe(404);
    expect((await merge(foreignId, { otherId: chartId, content: CHURCH_CHART })).status).toBe(404);
    expect((await merge(chartId, { otherId: sheetId, content: CHURCH_CHART }, observer)).status).toBe(403);
    // someone from another church is held to their own, where these songs do not exist
    expect([403, 404]).toContain((await merge(chartId, { otherId: sheetId, content: CHURCH_CHART }, stranger)).status);
    expect((await row(sheetId)).isArchived).toBe(false);
    expect((await row(foreignId)).isArchived).toBe(false);
  });

  it("refuses a song into itself, an empty chart, and a copy already merged", async () => {
    expect((await merge(chartId, { otherId: chartId, content: CHURCH_CHART })).status).toBe(400);
    expect((await merge(chartId, { otherId: sheetId, content: "   " })).status).toBe(400);
    expect((await merge(chartId, { otherId: archivedId, content: CHURCH_CHART })).status).toBe(409);
  });

  it("refuses to merge over a change someone made after the page was opened", async () => {
    const opened = (await row(sheetId)).updatedAt;
    await memDb.db.update(songs).set({ content: `${LYRIC_SHEET}\nA line added elsewhere`, updatedAt: new Date(Date.now() + 5000) }).where(eq(songs.id, sheetId));
    const res = await merge(chartId, { otherId: sheetId, content: CHURCH_CHART, otherUpdatedAt: opened });
    expect(res.status).toBe(409);
    expect((await row(sheetId)).isArchived).toBe(false);
    expect((await row(chartId)).content).toBe(CHURCH_CHART);
  });

  it("brings a merged copy back", async () => {
    await merge(chartId, { otherId: sheetId, content: CHURCH_CHART });
    const res = await as(request(app).post(`/api/songs/${sheetId}/unmerge`));
    expect(res.status).toBe(200);
    const copy = await row(sheetId);
    expect(copy.isArchived).toBe(false);
    expect(copy.content).toBe(LYRIC_SHEET);
    expect((await list()).body.pairs).toHaveLength(1);
    // and only a merged copy can be unmerged
    expect((await as(request(app).post(`/api/songs/${otherId}/unmerge`))).status).toBe(400);
  });
});

describe("marking two songs as different", () => {
  const mark = (id, body, who) => as(request(app).post(`/api/songs/${id}/distinct`), who).send(body);

  it("takes the pair off the list for good, and can be undone", async () => {
    const res = await mark(chartId, { otherId: sheetId });
    expect(res.status).toBe(200);
    expect((await row(chartId)).content).toContain(`{x_distinct: ${sheetId}}`);
    expect((await row(sheetId)).content).toContain(`{x_distinct: ${chartId}}`);
    expect((await list()).body.pairs).toEqual([]);

    expect((await mark(chartId, { otherId: sheetId, distinct: false })).status).toBe(200);
    expect((await row(chartId)).content).not.toContain("x_distinct");
    expect((await list()).body.pairs).toHaveLength(1);
  });

  it("keeps every song a chart was marked against", async () => {
    await mark(chartId, { otherId: sheetId });
    await mark(chartId, { otherId: otherId });
    const ids = [sheetId, otherId].sort().join("; ");
    expect((await row(chartId)).content).toContain(`{x_distinct: ${ids}}`);
  });

  it("will not touch another church's song", async () => {
    expect((await mark(chartId, { otherId: foreignId })).status).toBe(404);
    expect((await row(chartId)).content).toBe(CHURCH_CHART);
  });
});
