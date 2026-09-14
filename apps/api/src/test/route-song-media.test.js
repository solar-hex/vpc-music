/**
 * GET /songs/:id/media/:key — the route that lets a browser play a song's
 * private audio. It is a signing oracle for a private bucket, so the tests
 * lean on what it REFUSES as much as what it does.
 *
 * Runs the real Express app and real Drizzle queries against pg-mem. Only the
 * presigner is stubbed, so no test ever reaches the network.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createPgMemDb } from "./helpers/pgMemDb.js";

const memDb = createPgMemDb();
vi.mock("../db.js", () => memDb);

const TEST_SECRET = "test-secret-for-song-media";
const STORE = {
  S3_ENABLED: true,
  S3_ACCESS_KEY: "AKIA-test",
  S3_SECRET_KEY: "secret-test",
  S3_BUCKET: "proj-vpcmusic",
  S3_REGION: "us-central-1",
  S3_ENDPOINT: "https://s3.us-central-1.wasabisys.com",
  S3_ROOT_PATH: "v1/prd",
};
vi.mock("../config/env.js", () => ({
  env: {
    JWT_SECRET: "test-secret-for-song-media",
    CORS_ORIGIN: "http://localhost:5176",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    ...{
      S3_ENABLED: true,
      S3_ACCESS_KEY: "AKIA-test",
      S3_SECRET_KEY: "secret-test",
      S3_BUCKET: "proj-vpcmusic",
      S3_REGION: "us-central-1",
      S3_ENDPOINT: "https://s3.us-central-1.wasabisys.com",
      S3_ROOT_PATH: "v1/prd",
    },
  },
}));

const signed = vi.fn(async (_client, command) => `https://signed.example/${command.input.Key}?X-Amz-Signature=abc`);
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: (...args) => signed(...args) }));

const { app } = await import("../app.js");
const { objectKeyFromUrl } = await import("../features/songs/mediaRoutes.js");
const { organizations, users, organizationMembers, songs } = await import("../schema/index.js");

const BASE = `${STORE.S3_ENDPOINT}/${STORE.S3_BUCKET}`;
const SOPRANO = `${BASE}/v1/prd/media/songs/all-hail/audio/soprano.mp3`;
const CHART = `${BASE}/v1/prd/media/songs/all-hail/charts/chord_chart.pdf`;

let bandCookie, strangerCookie, songId, foreignSongId, badHostSongId;

const token = (user) => `token=${jwt.sign({ id: user.id, role: user.role }, TEST_SECRET, { expiresIn: "1h" })}`;

beforeAll(async () => {
  const { db } = memDb;
  const [band] = await db.insert(organizations).values({ name: "VPC Band" }).returning();
  const [other] = await db.insert(organizations).values({ name: "Another Church" }).returning();
  const [singer] = await db.insert(users).values({ email: "alto@vpc.church", displayName: "Alto", role: "member" }).returning();
  const [stranger] = await db.insert(users).values({ email: "someone@else.church", displayName: "Else", role: "member" }).returning();
  await db.insert(organizationMembers).values({ organizationId: band.id, userId: singer.id, role: "observer" });
  await db.insert(organizationMembers).values({ organizationId: other.id, userId: stranger.id, role: "admin" });
  bandCookie = token(singer);
  strangerCookie = token(stranger);

  const content = [
    "{title: All Hail}",
    `{x_audio_soprano: ${SOPRANO}}`,
    "{x_audio_alto:}",
    `{x_chart_chord_chart: ${CHART}}`,
    "",
    "[G]All hail",
  ].join("\n");
  [{ id: songId }] = await db.insert(songs).values({ title: "All Hail", content, organizationId: band.id, createdBy: singer.id }).returning();
  [{ id: foreignSongId }] = await db
    .insert(songs)
    .values({ title: "Their Song", content: `{title: Their Song}\n{x_audio_soprano: ${SOPRANO}}\n`, organizationId: other.id, createdBy: stranger.id })
    .returning();
  [{ id: badHostSongId }] = await db
    .insert(songs)
    .values({
      title: "Planted Link",
      content: "{title: Planted Link}\n{x_audio_soprano: https://evil.example.com/proj-vpcmusic/v1/prd/secret.mp3}\n",
      organizationId: band.id,
      createdBy: singer.id,
    })
    .returning();
});

describe("GET /songs/:id/media/:key", () => {
  it("redirects a member to a signed URL for that song's file", async () => {
    signed.mockClear();
    const res = await request(app).get(`/api/songs/${songId}/media/x_audio_soprano`).set("Cookie", bandCookie);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("X-Amz-Signature");
    // The key signed is the object inside the bucket, not the whole URL.
    expect(signed.mock.calls[0][1].input).toMatchObject({ Bucket: "proj-vpcmusic", Key: "v1/prd/media/songs/all-hail/audio/soprano.mp3" });
    expect(signed.mock.calls[0][2]).toEqual({ expiresIn: 900 });
  });

  it("never lets the redirect be cached, because the signed URL expires", async () => {
    const res = await request(app).get(`/api/songs/${songId}/media/x_audio_soprano`).set("Cookie", bandCookie);
    expect(res.headers["cache-control"]).toBe("private, no-store");
  });

  it("serves a chart PDF the same way", async () => {
    const res = await request(app).get(`/api/songs/${songId}/media/x_chart_chord_chart`).set("Cookie", bandCookie);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("chord_chart.pdf");
  });

  it("requires sign-in", async () => {
    const res = await request(app).get(`/api/songs/${songId}/media/x_audio_soprano`);
    expect(res.status).toBe(401);
  });

  it("answers 404 for a song in another organization, the same as a missing one", async () => {
    signed.mockClear();
    const foreign = await request(app).get(`/api/songs/${foreignSongId}/media/x_audio_soprano`).set("Cookie", bandCookie);
    expect(foreign.status).toBe(404);
    const missing = await request(app).get("/api/songs/00000000-0000-4000-8000-000000000000/media/x_audio_soprano").set("Cookie", bandCookie);
    expect(missing.status).toBe(404);
    // Same message too, so the response cannot be used to learn an id exists.
    expect(foreign.body.error.message).toBe(missing.body.error.message);
    expect(signed).not.toHaveBeenCalled();
  });

  it("does not let an outsider reach a band song", async () => {
    const res = await request(app).get(`/api/songs/${songId}/media/x_audio_soprano`).set("Cookie", strangerCookie);
    expect(res.status).toBe(404);
  });

  it("refuses to sign a URL that is not in the configured bucket", async () => {
    // Song content is editable, so the stored URL is untrusted input. Signing
    // it blindly would turn this route into a way to mint links to anything.
    signed.mockClear();
    const res = await request(app).get(`/api/songs/${badHostSongId}/media/x_audio_soprano`).set("Cookie", bandCookie);
    expect(res.status).toBe(400);
    expect(signed).not.toHaveBeenCalled();
  });

  it("rejects anything that is not a media directive", async () => {
    signed.mockClear();
    for (const key of ["title", "x_theme", "x_audio", "X_AUDIO_SOPRANO", "x_audio_..%2F..%2Fsecret"]) {
      const res = await request(app).get(`/api/songs/${songId}/media/${key}`).set("Cookie", bandCookie);
      expect([400, 404]).toContain(res.status);
    }
    expect(signed).not.toHaveBeenCalled();
  });

  it("answers 404 for a media directive the song does not carry, or carries empty", async () => {
    const absent = await request(app).get(`/api/songs/${songId}/media/x_audio_tenor`).set("Cookie", bandCookie);
    expect(absent.status).toBe(404);
    const empty = await request(app).get(`/api/songs/${songId}/media/x_audio_alto`).set("Cookie", bandCookie);
    expect(empty.status).toBe(404);
  });
});

describe("objectKeyFromUrl", () => {
  it("returns the key inside our bucket", () => {
    expect(objectKeyFromUrl(SOPRANO, STORE)).toBe("v1/prd/media/songs/all-hail/audio/soprano.mp3");
  });

  it("drops a query string or fragment", () => {
    expect(objectKeyFromUrl(`${SOPRANO}?foo=bar#x`, STORE)).toBe("v1/prd/media/songs/all-hail/audio/soprano.mp3");
  });

  it("refuses another host, another bucket, and a lookalike prefix", () => {
    expect(objectKeyFromUrl("https://evil.example.com/proj-vpcmusic/v1/a.mp3", STORE)).toBeNull();
    expect(objectKeyFromUrl(`${STORE.S3_ENDPOINT}/other-bucket/v1/a.mp3`, STORE)).toBeNull();
    expect(objectKeyFromUrl(`${STORE.S3_ENDPOINT}/proj-vpcmusic-evil/v1/a.mp3`, STORE)).toBeNull();
  });

  it("refuses traversal and empty segments", () => {
    expect(objectKeyFromUrl(`${BASE}/v1/../../secret.mp3`, STORE)).toBeNull();
    expect(objectKeyFromUrl(`${BASE}/v1//a.mp3`, STORE)).toBeNull();
    expect(objectKeyFromUrl(`${BASE}/`, STORE)).toBeNull();
  });

  it("refuses when the store is not configured", () => {
    expect(objectKeyFromUrl(SOPRANO, { ...STORE, S3_BUCKET: "" })).toBeNull();
  });
});
