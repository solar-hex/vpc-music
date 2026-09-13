/**
 * Corpus identity helpers.
 *
 * Deliberately free of any database, dotenv or schema import so the corpus
 * build/scan scripts can load it without opening a Postgres connection.
 * This is the ONLY definition of a song's identity in the repo; the legacy
 * importer that used to carry a second copy is gone.
 */
import { createHash } from "node:crypto";

/**
 * Fixed namespace for the path -> id derivation. Never change it: ids must stay
 * stable across runs and machines, and rows already exist in production.
 *
 * Note this is a raw 16-byte constant, not a standard UUID namespace, so a
 * stock uuidv5() call will NOT reproduce these ids. Always call
 * `deterministicSongId` rather than reimplementing it.
 */
const ID_NAMESPACE = Buffer.from("6f1d2c1e0d0b4c1a9c6a3e2f8b7a5d41", "hex");

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeRelativePath(value) {
  return String(value || "").replace(/\\/g, "/");
}

/** UUID v5-style id from a file's relative path (forward slashes, lowercased). */
export function deterministicSongId(relativePath) {
  const digest = createHash("sha1")
    .update(ID_NAMESPACE)
    .update(`chrd:${normalizeRelativePath(relativePath).toLowerCase()}`)
    .digest();
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function normalizeTitle(title) {
  return String(title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function nullable(value) {
  return value === undefined || value === null || value === "" ? null : value;
}

/** Fields the loader owns; a song is "unchanged" when all of them match. */
export function songFingerprint(row) {
  return JSON.stringify({
    title: row.title,
    key: nullable(row.key),
    artist: nullable(row.artist),
    year: nullable(row.year),
    tempo: nullable(row.tempo),
    isDraft: Boolean(row.isDraft),
    content: row.content,
  });
}

/** Hex sha256 of a string or Buffer. */
export function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

/** Filesystem-safe slug for a corpus filename. ASCII, lowercase, <= 60 chars. */
export function slugifyTitle(title) {
  const slug = String(title || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "untitled";
}

/**
 * `<slug>--<first 8 of id>.chopro`. The id suffix disambiguates the draft/final
 * title pairs and repeated UPCI folder names, and lets a reviewer tell which
 * row a file is without opening it.
 */
export function corpusFileName(title, songId) {
  return `${slugifyTitle(title)}--${String(songId).slice(0, 8)}.chopro`;
}

/** Glob (`*`, `?`) to RegExp, anchored and case-insensitive. */
export function globToRegExp(glob) {
  const escaped = String(glob)
    .replace(/[.+^${}()|[\]\\]/g, (ch) => `\\${ch}`)
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}
