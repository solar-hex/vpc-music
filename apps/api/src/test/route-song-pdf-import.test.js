/**
 * Importing a chord chart PDF in the app, read on the server by the library's
 * own converter. It used to need a PDF.co key that production never had, so
 * every import answered "not available".
 *
 * The PDFs are written here, by hand, so the test needs no fixture files.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createPgMemDb } from "./helpers/pgMemDb.js";

const memDb = createPgMemDb();
vi.mock("../db.js", () => memDb);

const TEST_SECRET = "test-secret-for-pdf-import";
vi.mock("../config/env.js", () => ({
  env: { JWT_SECRET: "test-secret-for-pdf-import", CORS_ORIGIN: "http://localhost:5176", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" },
}));

const { app } = await import("../app.js");
const { organizations, users, organizationMembers } = await import("../schema/index.js");

/** A one-page PDF with Helvetica text at the given positions (x, y from the top). */
function pdfWithText(runs) {
  const escape = (text) => text.replace(/[\\()]/g, (c) => `\\${c}`);
  const stream = runs.map(({ text, x, y, size = 12 }) => `BT /F1 ${size} Tf ${x} ${792 - y} Td (${escape(text)}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

const CHART = pdfWithText([
  { text: "Morning Light", x: 72, y: 60, size: 20 },
  { text: "Key: D  Tempo: 72", x: 72, y: 84 },
  { text: "Verse 1", x: 72, y: 130 },
  ...[
    ["D", "G", "A"],
    ["Bm", "G", "D"],
    ["D", "A", "G"],
    ["Em", "A", "D"],
  ].flatMap((chords, row) => [
    ...chords.map((chord, i) => ({ text: chord, x: 72 + i * 90, y: 160 + row * 40 })),
    { text: ["Morning light is breaking over", "Every hill and every sea", "All creation sings of mercy", "Rising up in harmony"][row], x: 72, y: 174 + row * 40 },
  ]),
  { text: "Chorus", x: 72, y: 340 },
  { text: "G", x: 72, y: 370 },
  { text: "D", x: 180, y: 370 },
  { text: "We will sing of your glory", x: 72, y: 384 },
]);

let bandId, musician;

beforeAll(async () => {
  const { db } = memDb;
  const [band] = await db.insert(organizations).values({ name: "VPC Band" }).returning();
  bandId = band.id;
  const [keys] = await db.insert(users).values({ email: "keys@vpc.church", displayName: "Keys", role: "member" }).returning();
  await db.insert(organizationMembers).values({ organizationId: band.id, userId: keys.id, role: "musician" });
  musician = `token=${jwt.sign({ id: keys.id, role: "member" }, TEST_SECRET, { expiresIn: "1h" })}`;
});

const upload = (path, buffer, filename = "Morning Light.pdf", type = "application/pdf") =>
  request(app).post(path).set("Cookie", musician).set("X-Organization-Id", bandId).attach("file", buffer, { filename, contentType: type });

describe("PDF import", () => {
  it("previews a chord chart PDF without any outside service", async () => {
    const res = await upload("/api/songs/import/pdf/preview", CHART);
    expect(res.status).toBe(200);
    expect(res.body.metadata).toMatchObject({ title: "Morning Light", key: "D", tempo: 72 });
    expect(res.body.chordPro).toContain("{comment: Verse 1}");
    expect(res.body.chordPro).toMatch(/\[D\]Morning/);
    expect(res.body.chordPro).not.toContain("Key: D");
  });

  it("imports it as a song", async () => {
    const res = await upload("/api/songs/import/pdf", CHART);
    expect(res.status).toBe(201);
    expect(res.body.song).toMatchObject({ title: "Morning Light", key: "D", tempo: 72 });
    expect(res.body.song.content).toContain("{comment: Chorus}");
  });

  it("says plainly when a PDF has no text to read", async () => {
    const res = await upload("/api/songs/import/pdf/preview", pdfWithText([{ text: "x", x: 72, y: 72 }]), "scan.pdf");
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/no text to read/);
  });

  it("refuses a file that is not a PDF, and one over the size limit, as the sender's mistake", async () => {
    const text = await upload("/api/songs/import/pdf/preview", Buffer.from("not a pdf"), "notes.txt", "text/plain");
    expect(text.status).toBe(400);
    expect(text.body.error.message).toBe("Only PDF files are allowed");
    const huge = await upload("/api/songs/import/pdf/preview", Buffer.alloc(10 * 1024 * 1024 + 1), "huge.pdf");
    expect(huge.status).toBe(413);
    expect(huge.body.error.message).toBe("That file is too big to upload");
  });
});
