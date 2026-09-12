/**
 * The site answers on both the bare domain and www, and a browser sends
 * whichever one it is on as the Origin. CORS_ORIGIN therefore takes a
 * comma-separated list. Before this it took a single string, so the moment
 * one address redirected to the other, sign-in failed with a CORS error and
 * nothing in the API logs explained why.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";

vi.mock("../db.js", () => ({ db: {}, pool: {} }));
vi.mock("../config/env.js", () => ({
  env: {
    JWT_SECRET: "test-secret-for-cors",
    CORS_ORIGIN: "",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
  },
}));

const ORIGINS = "https://vpcmusic.life,https://www.vpcmusic.life";

async function freshApp(corsOrigin) {
  vi.resetModules();
  process.env.CORS_ORIGIN = corsOrigin;
  const { app } = await import("../app.js");
  return app;
}

describe("CORS origins", () => {
  const original = process.env.CORS_ORIGIN;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (original === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = original;
  });

  it("allows every origin in the list", async () => {
    const app = await freshApp(ORIGINS);
    for (const origin of ["https://vpcmusic.life", "https://www.vpcmusic.life"]) {
      const res = await request(app).get("/health").set("Origin", origin);
      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe(origin);
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
    }
  });

  it("refuses an origin that is not listed", async () => {
    const app = await freshApp(ORIGINS);
    const res = await request(app).get("/health").set("Origin", "https://app.vpcmusic.life");
    // The request still answers; the browser is what blocks it, and it does
    // so precisely because this header is absent.
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("tolerates spaces around the separators", async () => {
    const app = await freshApp(" https://vpcmusic.life , https://www.vpcmusic.life ");
    const res = await request(app).get("/health").set("Origin", "https://www.vpcmusic.life");
    expect(res.headers["access-control-allow-origin"]).toBe("https://www.vpcmusic.life");
  });

  it("still accepts a single origin", async () => {
    const app = await freshApp("https://vpcmusic.life");
    const res = await request(app).get("/health").set("Origin", "https://vpcmusic.life");
    expect(res.headers["access-control-allow-origin"]).toBe("https://vpcmusic.life");
  });
});
