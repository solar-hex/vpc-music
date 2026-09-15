/**
 * Share links: one chart, read only, for someone outside the church.
 *
 * The link is a bearer credential, so the tests lean on what it must NOT give
 * away: other songs, the Dropbox folder, the church's bookkeeping, a link that
 * was turned off, or a song in another organization.
 *
 * Runs the real Express app and real Drizzle queries against pg-mem. Only the
 * presigner is stubbed, so no test reaches the network.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createPgMemDb } from "./helpers/pgMemDb.js";

const memDb = createPgMemDb();
vi.mock("../db.js", () => memDb);

const TEST_SECRET = "test-secret-for-share-links";
vi.mock("../config/env.js", () => ({
  env: {
    JWT_SECRET: "test-secret-for-share-links",
    CORS_ORIGIN: "http://localhost:5176",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    S3_ENABLED: true,
    S3_ACCESS_KEY: "AKIA-test",
    S3_SECRET_KEY: "secret-test",
    S3_BUCKET: "proj-vpcmusic",
    S3_REGION: "us-central-1",
    S3_ENDPOINT: "https://s3.us-central-1.wasabisys.com",
    S3_ROOT_PATH: "v1/prd",
  },
}));

const signed = vi.fn(async (_client, command) => `https://signed.example/${command.input.Key}?X-Amz-Signature=abc`);
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: (...args) => signed(...args) }));

const { app } = await import("../app.js");
const { publicChart } = await import("../features/share/routes.js");
const { organizations, users, organizationMembers, songs, songVariations, shareTokens } = await import("../schema/index.js");

const BASE = "https://s3.us-central-1.wasabisys.com/proj-vpcmusic";
const SOPRANO = `${BASE}/v1/prd/media/songs/covered/audio/soprano.mp3`;
const CHART = `${BASE}/v1/prd/media/songs/covered/charts/chord-chart.pdf`;
const DROPBOX = "https://www.dropbox.com/scl/fo/abc/UPCI?rlkey=xyz&subpath=%2FCovered";

const CONTENT = [
  "{title: Covered}",
  "{key: Eb}",
  "{x_verified: number chart, 99% of 48 chords}",
  "{x_theme: blood, cross}",
  "{x_source: pdf:UPCI Music/Covered/Covered - Chord Chart.pdf}",
  `{x_dropbox: ${DROPBOX}}`,
  `{x_audio_soprano: ${SOPRANO}}`,
  "{x_audio_alto:}",
  `{x_chart_chord_chart: ${CHART}}`,
  "",
  "{comment: Verse 1}",
  "[Eb]No more sacrificing lambs,",
].join("\n");

const cookie = (user) => `token=${jwt.sign({ id: user.id, role: user.role }, TEST_SECRET, { expiresIn: "1h" })}`;

let musician, observer, stranger, songId, foreignSongId, variedSongId, trashedSongId, bandId;

beforeAll(async () => {
  const { db } = memDb;
  const [band] = await db.insert(organizations).values({ name: "VPC Band" }).returning();
  const [other] = await db.insert(organizations).values({ name: "Another Church" }).returning();
  bandId = band.id;
  const [keys] = await db.insert(users).values({ email: "keys@vpc.church", displayName: "Keys", role: "member" }).returning();
  const [watcher] = await db.insert(users).values({ email: "watch@vpc.church", displayName: "Watch", role: "member" }).returning();
  const [elsewhere] = await db.insert(users).values({ email: "admin@else.church", displayName: "Else", role: "member" }).returning();
  await db.insert(organizationMembers).values({ organizationId: band.id, userId: keys.id, role: "musician" });
  await db.insert(organizationMembers).values({ organizationId: band.id, userId: watcher.id, role: "observer" });
  await db.insert(organizationMembers).values({ organizationId: other.id, userId: elsewhere.id, role: "admin" });
  musician = cookie(keys);
  observer = cookie(watcher);
  stranger = cookie(elsewhere);

  [{ id: songId }] = await db
    .insert(songs)
    .values({ title: "Covered", artist: "Mark Yandris", key: "Eb", tempo: 143, content: CONTENT, organizationId: band.id, createdBy: keys.id, tags: "flag:unlisted, theme:blood", isDraft: true })
    .returning();
  [{ id: foreignSongId }] = await db
    .insert(songs)
    .values({ title: "Their Song", content: "{title: Their Song}\n[C]Theirs", organizationId: other.id, createdBy: elsewhere.id })
    .returning();
  [{ id: variedSongId }] = await db
    .insert(songs)
    .values({ title: "Varied", key: "G", content: "{title: Varied}\n[G]The original", organizationId: band.id, createdBy: keys.id })
    .returning();
  const [variation] = await db
    .insert(songVariations)
    .values({ songId: variedSongId, name: "Acoustic", key: "D", content: "{title: Varied}\n[D]The acoustic one" })
    .returning();
  await db.update(songs).set({ defaultVariationId: variation.id }).where((await import("drizzle-orm")).eq(songs.id, variedSongId));
  [{ id: trashedSongId }] = await db
    .insert(songs)
    .values({ title: "Binned", content: "[C]Gone", organizationId: band.id, createdBy: keys.id, deletedAt: new Date() })
    .returning();
});

const share = (id, cookieHeader = musician, body = {}) =>
  request(app).post(`/api/songs/${id}/share`).set("Cookie", cookieHeader).set("X-Organization-Id", bandId).send(body);
const tokenOf = (res) => res.body.shareUrl.replace("/shared/", "");

describe("making a share link", () => {
  it("gives a musician a link to the song", async () => {
    const res = await share(songId);
    expect(res.status).toBe(201);
    expect(res.body.shareUrl).toMatch(/^\/shared\/[A-Za-z0-9_-]{43}$/);
  });

  it("hands back the same link when asked again, instead of another permanent one", async () => {
    const first = await share(songId);
    const second = await share(songId);
    expect(second.status).toBe(200);
    expect(tokenOf(second)).toBe(tokenOf(first));
  });

  it("does not let an observer share", async () => {
    expect((await share(songId, observer)).status).toBe(403);
  });

  it("does not share a song from another organization", async () => {
    // It used to check only that the song existed somewhere.
    expect((await share(foreignSongId)).status).toBe(404);
  });

  it("requires sign-in", async () => {
    expect((await request(app).post(`/api/songs/${songId}/share`)).status).toBe(401);
  });
});

describe("opening a share link", () => {
  it("shows the chart without signing in", async () => {
    const token = tokenOf(await share(songId));
    const res = await request(app).get(`/api/shared/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.song).toMatchObject({ title: "Covered", artist: "Mark Yandris", key: "Eb", tempo: 143 });
    expect(res.body.song.content).toContain("[Eb]No more sacrificing lambs,");
  });

  it("gives away nothing beyond the chart", async () => {
    const token = tokenOf(await share(songId));
    const { body, headers } = await request(app).get(`/api/shared/${token}`);
    expect(Object.keys(body.song).sort()).toEqual(["artist", "content", "key", "status", "tempo", "title", "year"]);
    // The Dropbox link opens the whole shared folder, not just this song.
    expect(body.song.content).not.toContain("dropbox");
    expect(body.song.content).not.toMatch(/x_source|x_verified|x_theme/);
    // Media keeps its name for the player, not the storage address.
    expect(body.song.content).not.toContain("wasabisys");
    expect(body.song.content).toContain("{x_audio_soprano: https://media.invalid/x_audio_soprano}");
    expect(body.song.content).toContain("{x_audio_alto:}");
    expect(headers["cache-control"]).toBe("private, no-store");
  });

  it("shows the chart a member sees when the song has a default variation", async () => {
    const token = tokenOf(await share(variedSongId));
    const { body } = await request(app).get(`/api/shared/${token}`);
    expect(body.song.key).toBe("D");
    expect(body.song.content).toContain("[D]The acoustic one");
  });

  it("refuses a token that was never issued", async () => {
    expect((await request(app).get(`/api/shared/${"x".repeat(43)}`)).status).toBe(404);
  });

  it("refuses an expired link", async () => {
    const res = await share(songId, musician, { expiresInDays: 1 });
    await memDb.db
      .update(shareTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where((await import("drizzle-orm")).eq(shareTokens.token, tokenOf(res)));
    expect((await request(app).get(`/api/shared/${tokenOf(res)}`)).status).toBe(410);
  });

  it("stops showing a song that was moved to the trash", async () => {
    const [created] = await memDb.db.insert(shareTokens).values({ token: "t".repeat(43), songId: trashedSongId }).returning();
    expect((await request(app).get(`/api/shared/${created.token}`)).status).toBe(404);
  });
});

describe("stopping sharing", () => {
  it("turns off every link the song has, and the next share is a new link", async () => {
    const old = tokenOf(await share(songId));
    const extra = tokenOf(await share(songId, musician, { fresh: true }));

    const res = await request(app).delete(`/api/songs/${songId}/shares`).set("Cookie", musician).set("X-Organization-Id", bandId);
    expect(res.status).toBe(200);
    expect(res.body.revoked).toBeGreaterThanOrEqual(2);

    for (const token of [old, extra]) expect((await request(app).get(`/api/shared/${token}`)).status).toBe(410);

    const next = await share(songId);
    expect(next.status).toBe(201);
    expect(tokenOf(next)).not.toBe(old);
  });

  it("does not let an observer stop sharing", async () => {
    const res = await request(app).delete(`/api/songs/${songId}/shares`).set("Cookie", observer).set("X-Organization-Id", bandId);
    expect(res.status).toBe(403);
  });

  it("does not let another organization turn off one of our links", async () => {
    const token = tokenOf(await share(songId));
    const [row] = await memDb.db.select().from(shareTokens).where((await import("drizzle-orm")).eq(shareTokens.token, token));
    const res = await request(app).delete(`/api/songs/${songId}/shares/${row.id}`).set("Cookie", stranger);
    expect(res.status).toBe(404);
    expect((await request(app).get(`/api/shared/${token}`)).status).toBe(200);
  });
});

describe("playing a shared song's media", () => {
  it("signs that song's own audio and PDFs through the link", async () => {
    signed.mockClear();
    const token = tokenOf(await share(songId));
    const audio = await request(app).get(`/api/shared/${token}/media/x_audio_soprano`);
    expect(audio.status).toBe(302);
    expect(signed.mock.calls[0][1].input).toMatchObject({ Bucket: "proj-vpcmusic", Key: "v1/prd/media/songs/covered/audio/soprano.mp3" });
    expect(audio.headers["cache-control"]).toBe("private, no-store");
    expect((await request(app).get(`/api/shared/${token}/media/x_chart_chord_chart`)).status).toBe(302);
  });

  it("will not sign the Dropbox link or anything that is not media", async () => {
    const token = tokenOf(await share(songId));
    expect((await request(app).get(`/api/shared/${token}/media/x_dropbox`)).status).toBe(400);
  });

  it("will not sign media the song does not have", async () => {
    const token = tokenOf(await share(songId));
    expect((await request(app).get(`/api/shared/${token}/media/x_audio_tenor`)).status).toBe(404);
    expect((await request(app).get(`/api/shared/${token}/media/x_audio_alto`)).status).toBe(404);
  });

  it("stops playing once the link is turned off", async () => {
    const token = tokenOf(await share(songId));
    await request(app).delete(`/api/songs/${songId}/shares`).set("Cookie", musician).set("X-Organization-Id", bandId);
    expect((await request(app).get(`/api/shared/${token}/media/x_audio_soprano`)).status).toBe(410);
  });
});

describe("publicChart", () => {
  it("keeps the chart and its directives, drops the bookkeeping", () => {
    expect(publicChart(CONTENT).split("\n")).toEqual([
      "{title: Covered}",
      "{key: Eb}",
      "{x_audio_soprano: https://media.invalid/x_audio_soprano}",
      "{x_audio_alto:}",
      "{x_chart_chord_chart: https://media.invalid/x_chart_chord_chart}",
      "",
      "{comment: Verse 1}",
      "[Eb]No more sacrificing lambs,",
    ]);
  });
});
