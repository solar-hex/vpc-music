/**
 * Object store live smoke test — hits real Wasabi.
 *
 * Auto-skips when S3_BUCKET / S3_ACCESS_KEY are absent, so CI skips it and a
 * configured machine runs it. Modelled on floline's avatar live test.
 *
 *   pnpm --filter @vpc-music/api test src/test/object-store-live.test.js
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { describe, expect, it } from "vitest";

// Load apps/api/.env so S3_* are present when run from the repo root.
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const {
  deleteObject,
  getObjectBuffer,
  headObject,
  isObjectStoreConfigured,
  listObjects,
  putObject,
  withRoot,
  contentTypeFor,
} = await import("../corpus/objectStore.js");

// Resolved through config/env.js so this also proves the WASABI_* -> S3_*
// fallback works, rather than reading process.env a second, divergent way.
const { env: s3Config } = await import("../config/env.js");

// Opt-in rather than auto-run: this hits the network, and the repo is shared
// with another session whose `pnpm test:all` must not depend on Wasabi.
//   S3_LIVE_TESTS=1 pnpm --filter @vpc-music/api test src/test/object-store-live.test.js
const hasS3 = isObjectStoreConfigured(s3Config) && process.env.S3_LIVE_TESTS === "1";

describe("object store helpers (no network)", () => {
  it("prefixes keys with the root path, idempotently", () => {
    const c = { S3_ROOT_PATH: "v1/prd" };
    expect(withRoot("media/songs/a/audio/alto.m4a", c)).toBe("v1/prd/media/songs/a/audio/alto.m4a");
    expect(withRoot("/media/x", c)).toBe("v1/prd/media/x");
    // already prefixed — must not double up
    expect(withRoot("v1/prd/media/x", c)).toBe("v1/prd/media/x");
    expect(withRoot("media/x", { S3_ROOT_PATH: "" })).toBe("media/x");
  });

  it("maps media extensions to sensible content types", () => {
    expect(contentTypeFor("a/b/alto.m4a")).toBe("audio/mp4");
    expect(contentTypeFor("chord-chart.PDF")).toBe("application/pdf");
    expect(contentTypeFor("song.chopro")).toBe("text/plain; charset=utf-8");
    expect(contentTypeFor("loop.mp3")).toBe("audio/mpeg");
    expect(contentTypeFor("mystery.xyz")).toBe("application/octet-stream");
  });

  it("reports configuration accurately", () => {
    expect(isObjectStoreConfigured({ S3_BUCKET: "b", S3_ACCESS_KEY: "k", S3_SECRET_KEY: "s" })).toBe(true);
    expect(isObjectStoreConfigured({ S3_BUCKET: "", S3_ACCESS_KEY: "k", S3_SECRET_KEY: "s" })).toBe(false);
    expect(isObjectStoreConfigured({ S3_BUCKET: "b", S3_ACCESS_KEY: "", S3_SECRET_KEY: "s" })).toBe(false);
  });
});

describe.skipIf(!hasS3)("object store live round trip", () => {
  const key = "media/__smoke_test__/probe.txt";
  const body = Buffer.from("vpc-music object store smoke\n");

  it("can PUT, HEAD, GET, LIST and DELETE on Wasabi", async () => {
    await putObject(key, body, { config: s3Config, contentType: "text/plain" });

    const head = await headObject(key, { config: s3Config });
    expect(head).not.toBeNull();
    expect(head.size).toBe(body.length);

    const fetched = await getObjectBuffer(key, { config: s3Config });
    expect(fetched.toString()).toBe(body.toString());

    const listed = await listObjects("media/__smoke_test__/", { config: s3Config });
    expect(listed.map((o) => o.key)).toContain(withRoot(key, s3Config));

    await deleteObject(key, { config: s3Config });
    expect(await headObject(key, { config: s3Config })).toBeNull();
  }, 60_000);
});
