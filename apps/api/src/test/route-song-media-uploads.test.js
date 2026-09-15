/**
 * Uploading a song's recordings and charts: a signed link straight to storage.
 *
 * What must hold: only people who can edit songs get a link, only for a song
 * in their own church, only for a file kind that cannot run when opened, and
 * every upload lands under a new name in that song's folder so nothing already
 * pointed at is ever overwritten.
 *
 * Runs the real Express app against pg-mem. Only the presigner is stubbed.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createPgMemDb } from "./helpers/pgMemDb.js";

const memDb = createPgMemDb();
vi.mock("../db.js", () => memDb);

const TEST_SECRET = "test-secret-for-uploads";
vi.mock("../config/env.js", () => ({
  env: {
    JWT_SECRET: "test-secret-for-uploads",
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

const signed = vi.fn(async (_client, command) => `https://signed.example/${command.input.Key}?X-Amz-Signature=put`);
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: (...args) => signed(...args) }));

const { app } = await import("../app.js");
const { MEDIA_DIRECTIVE_KEY, directiveName, objectKeyFromUrl } = await import("../features/songs/mediaRoutes.js");
const { organizations, users, organizationMembers, songs } = await import("../schema/index.js");

const cookie = (user) => `token=${jwt.sign({ id: user.id, role: user.role }, TEST_SECRET, { expiresIn: "1h" })}`;
let bandId, musician, observer, stranger, songId, foreignSongId;

beforeAll(async () => {
  const { db } = memDb;
  const [band] = await db.insert(organizations).values({ name: "VPC Band" }).returning();
  const [other] = await db.insert(organizations).values({ name: "Another Church" }).returning();
  bandId = band.id;
  const [keys] = await db.insert(users).values({ email: "keys@vpc.church", displayName: "Keys", role: "member" }).returning();
  const [watcher] = await db.insert(users).values({ email: "watch@vpc.church", displayName: "Watch", role: "member" }).returning();
  const [outsider] = await db.insert(users).values({ email: "admin@else.church", displayName: "Else", role: "member" }).returning();
  await db.insert(organizationMembers).values({ organizationId: band.id, userId: keys.id, role: "musician" });
  await db.insert(organizationMembers).values({ organizationId: band.id, userId: watcher.id, role: "observer" });
  await db.insert(organizationMembers).values({ organizationId: other.id, userId: outsider.id, role: "admin" });
  musician = cookie(keys);
  observer = cookie(watcher);
  stranger = cookie(outsider);
  [{ id: songId }] = await db.insert(songs).values({ title: "Way Maker", content: "{title: Way Maker}\n[E]Way maker", organizationId: band.id, createdBy: keys.id }).returning();
  [{ id: foreignSongId }] = await db.insert(songs).values({ title: "Their Song", content: "[C]Theirs", organizationId: other.id, createdBy: outsider.id }).returning();
});

const upload = (id, body, who = musician) =>
  request(app).post(`/api/songs/${id}/media/uploads`).set("Cookie", who).set("X-Organization-Id", bandId).send(body);

describe("POST /songs/:id/media/uploads", () => {
  it("gives an editor a signed upload for a part, under the song's own folder", async () => {
    const res = await upload(songId, { slot: "alto", filename: "Way Maker - Alto.MP3", size: 8_000_000 });
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.body).toMatchObject({ method: "PUT", headers: { "Content-Type": "audio/mpeg" }, directive: "x_audio_alto", kind: "audio" });

    const key = res.body.url.replace("https://s3.us-central-1.wasabisys.com/proj-vpcmusic/", "");
    expect(key).toMatch(new RegExp(`^v1/prd/media/songs/way-maker--${songId.slice(0, 8)}/audio/alto-[a-z0-9]+\\.mp3$`));
    // the URL it hands back is one the player will sign later
    expect(objectKeyFromUrl(res.body.url, { S3_ENDPOINT: "https://s3.us-central-1.wasabisys.com", S3_BUCKET: "proj-vpcmusic" })).toBe(key);
    const command = signed.mock.calls.at(-1)[1];
    expect(command.input).toMatchObject({ Bucket: "proj-vpcmusic", Key: key, ContentType: "audio/mpeg" });
    expect(MEDIA_DIRECTIVE_KEY.test(res.body.directive)).toBe(true);
  });

  it("never reuses a name, so an upload cannot overwrite a file something points at", async () => {
    const first = await upload(songId, { slot: "chord_chart", filename: "chart.pdf", size: 1000 });
    const second = await upload(songId, { slot: "chord_chart", filename: "chart.pdf", size: 1000 });
    expect(first.body.directive).toBe("x_chart_chord_chart");
    expect(first.body.url).not.toBe(second.body.url);
  });

  it("keeps anything else as its own file, stored by what kind of file it is", async () => {
    const pdf = await upload(songId, { filename: "Bass Chart (Capo 2).pdf", size: 1000 });
    expect(pdf.body).toMatchObject({ directive: "x_file_bass_chart_capo_2", kind: "chart" });
    expect(pdf.body.url).toContain("/charts/bass-chart-capo-2-");
    const doc = await upload(songId, { filename: "Arrangement notes.docx", size: 1000 });
    expect(doc.body).toMatchObject({ directive: "x_file_arrangement_notes", kind: "file" });
    expect(doc.body.url).toContain("/files/arrangement-notes-");
    const video = await upload(songId, { filename: "rehearsal.mp4", size: 1000 });
    expect(video.body.kind).toBe("file");
    // stored with a type a browser can play or show
    expect(video.body.headers["Content-Type"]).toBe("video/mp4");
    expect((await upload(songId, { slot: "tenor", filename: "tenor.flac", size: 1000 })).body.headers["Content-Type"]).toBe("audio/flac");
  });

  it("refuses files that could run when opened, empty files, and huge ones", async () => {
    for (const filename of ["page.html", "logo.svg", "script.js", "tool.exe", "noextension"]) {
      expect((await upload(songId, { filename, size: 1000 })).status, filename).toBe(400);
    }
    expect((await upload(songId, { filename: "alto.mp3", size: 0 })).status).toBe(400);
    expect((await upload(songId, { filename: "alto.wav", size: 251 * 1024 * 1024 })).status).toBe(400);
  });

  it("keeps a part to its kind, and only offers the parts it knows", async () => {
    expect((await upload(songId, { slot: "alto", filename: "alto.pdf", size: 1000 })).body.error.message).toMatch(/audio file/);
    expect((await upload(songId, { slot: "number_chart", filename: "numbers.mp3", size: 1000 })).body.error.message).toMatch(/PDF or an image/);
    for (const slot of ["../../etc", "constructor", "__proto__"]) {
      expect((await upload(songId, { slot, filename: "alto.mp3", size: 1000 })).body.error?.message, slot).toBe("Not a file this song can be asked for");
    }
  });

  it("is for editors in the song's own church", async () => {
    expect((await upload(songId, { slot: "alto", filename: "alto.mp3", size: 1000 }, observer)).status).toBe(403);
    expect([403, 404]).toContain((await upload(songId, { slot: "alto", filename: "alto.mp3", size: 1000 }, stranger)).status);
    expect((await upload(foreignSongId, { slot: "alto", filename: "alto.mp3", size: 1000 })).status).toBe(404);
    expect((await request(app).post(`/api/songs/${songId}/media/uploads`).send({ filename: "a.mp3", size: 1 })).status).toBe(401);
  });
});

describe("directiveName", () => {
  it("makes a directive-safe name from any filename", () => {
    expect(directiveName("Alto Part (v2).mp3")).toBe("alto_part_v2");
    expect(directiveName("Café Numéro.pdf")).toBe("cafe_numero");
    expect(directiveName("!!!.pdf")).toBe("file");
    expect(directiveName(`${"long ".repeat(20)}.pdf`).length).toBeLessThanOrEqual(40);
  });

  it("lets the player open other files too", () => {
    expect(MEDIA_DIRECTIVE_KEY.test("x_file_arrangement_notes")).toBe(true);
    expect(MEDIA_DIRECTIVE_KEY.test("x_dropbox")).toBe(false);
  });
});
