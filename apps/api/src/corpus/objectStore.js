/**
 * Object storage (Wasabi, S3-compatible).
 *
 * floline keeps its S3 calls inline in a route; this is the same client
 * configuration factored into a wrapper, because the corpus tooling needs
 * upload / download / list / exists from several places.
 *
 * Keys are always built by `mediaKey()` in ./mediaParts.js so the store mirrors
 * the corpus naming, and `S3_ROOT_PATH` prefixes everything (e.g. `v1/prd`).
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname } from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "../config/env.js";

const CONTENT_TYPES = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webp": "image/webp",
  ".aif": "audio/aiff",
  ".aiff": "audio/aiff",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".txt": "text/plain; charset=utf-8",
  ".chopro": "text/plain; charset=utf-8",
  ".json": "application/json",
  ".ndjson": "application/x-ndjson",
  ".mid": "audio/midi",
  ".zip": "application/zip",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export function contentTypeFor(filename) {
  return CONTENT_TYPES[extname(String(filename)).toLowerCase()] || "application/octet-stream";
}

/**
 * True when the store is switched on and enough config is present.
 * `S3_ENABLED` defaults to true, so only an explicit `WASABI_ENABLED=false`
 * turns it off.
 */
export function isObjectStoreConfigured(config = env) {
  if (config.S3_ENABLED === false) return false;
  return Boolean(config.S3_BUCKET && config.S3_ACCESS_KEY && config.S3_SECRET_KEY);
}

let cached = null;

/** Shared client. Pass `config` in tests to avoid the module-level env. */
export function getClient(config = env) {
  if (config === env && cached) return cached;
  const client = new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY,
      secretAccessKey: config.S3_SECRET_KEY,
    },
  });
  if (config === env) cached = client;
  return client;
}

/** Prefix a key with S3_ROOT_PATH unless it already carries it. */
export function withRoot(key, config = env) {
  const root = String(config.S3_ROOT_PATH || "").replace(/^\/+|\/+$/g, "");
  const clean = String(key).replace(/^\/+/, "");
  if (!root) return clean;
  return clean.startsWith(`${root}/`) ? clean : `${root}/${clean}`;
}

/** Does this object already exist? Returns its size, or null. */
export async function headObject(key, { config = env, client = null } = {}) {
  const s3 = client || getClient(config);
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: config.S3_BUCKET, Key: withRoot(key, config) }));
    return { size: r.ContentLength, etag: r.ETag, contentType: r.ContentType };
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NotFound") return null;
    throw error;
  }
}

/**
 * Upload a Buffer or stream. `size` is required for a stream, because S3 needs
 * a content length and a stream cannot report one.
 */
export async function putObject(key, body, { contentType, size, config = env, client = null } = {}) {
  const s3 = client || getClient(config);
  const Key = withRoot(key, config);
  await s3.send(
    new PutObjectCommand({
      Bucket: config.S3_BUCKET,
      Key,
      Body: body,
      ContentType: contentType || contentTypeFor(key),
      ...(size !== undefined ? { ContentLength: size } : {}),
    }),
  );
  return Key;
}

/** Upload a local file by path, streaming it rather than reading it all in. */
export async function putFile(key, filePath, options = {}) {
  const info = await stat(filePath);
  return putObject(key, createReadStream(filePath), {
    ...options,
    size: info.size,
    contentType: options.contentType || contentTypeFor(filePath),
  });
}

/** Fetch an object as a Buffer. */
export async function getObjectBuffer(key, { config = env, client = null } = {}) {
  const s3 = client || getClient(config);
  const r = await s3.send(new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: withRoot(key, config) }));
  const chunks = [];
  for await (const chunk of r.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function deleteObject(key, { config = env, client = null } = {}) {
  const s3 = client || getClient(config);
  await s3.send(new DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key: withRoot(key, config) }));
}

/** List every key under a prefix, following continuation tokens. */
export async function listObjects(prefix = "", { config = env, client = null, limit = Infinity } = {}) {
  const s3 = client || getClient(config);
  const out = [];
  let token;
  do {
    const r = await s3.send(
      new ListObjectsV2Command({
        Bucket: config.S3_BUCKET,
        Prefix: withRoot(prefix, config),
        ContinuationToken: token,
      }),
    );
    for (const o of r.Contents || []) {
      out.push({ key: o.Key, size: o.Size, etag: o.ETag, lastModified: o.LastModified });
      if (out.length >= limit) return out;
    }
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return out;
}
