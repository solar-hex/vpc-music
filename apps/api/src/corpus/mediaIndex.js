/**
 * Look up a song's media from the committed NDJSON ledgers.
 *
 * Media folders are named by the source tree and songs by their title, so the
 * two only meet through the title matcher — exact matching finds a fraction of
 * the real links.
 */
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { matchTitles } from "./titleMatch.js";

/**
 * Where the originals live, so a chart can point at an alternative source.
 * A shared-folder link plus the file's path inside it is unambiguous, and
 * survives the local copy being moved or lost.
 */
export const DROPBOX_ROOTS = [
  {
    prefix: "UPCI Song Parts TG",
    url: "https://www.dropbox.com/scl/fo/myezotku0yxt1y2elwnh7/AIftAUzuICIcjcCcx2x6Xqw?rlkey=28zhlw8ae4orji684sn6a7ld9",
  },
  {
    prefix: "VPC Choir",
    url: "https://www.dropbox.com/scl/fo/myezotku0yxt1y2elwnh7/AIftAUzuICIcjcCcx2x6Xqw?rlkey=28zhlw8ae4orji684sn6a7ld9",
  },
];

/** A browsable deep link to the folder a file came from. */
export function dropboxLinkFor(sourcePath) {
  if (!sourcePath) return null;
  const root = DROPBOX_ROOTS.find((r) => sourcePath.startsWith(r.prefix));
  if (!root) return null;
  const folder = sourcePath.split("/").slice(0, -1).join("/");
  return `${root.url}&subpath=${encodeURIComponent("/" + folder)}`;
}

/** Public address of an object. Access is still controlled — the bucket is private. */
export function objectUrl(key, { endpoint, bucket } = {}) {
  const ep = (endpoint || process.env.WASABI_ENDPOINT || process.env.S3_ENDPOINT || "https://s3.us-central-1.wasabisys.com").replace(/\/+$/, "");
  const b = bucket || process.env.WASABI_BUCKET || process.env.S3_BUCKET || "proj-vpcmusic";
  return `${ep}/${b}/${String(key).replace(/^\/+/, "")}`;
}

/**
 * Build a lookup keyed by song title.
 * @returns {{ forTitle(title): { media: Array<{key,url,bpm}>, tempo: number|null, dropboxUrl: string|null }, size: number }}
 */
export async function loadMediaIndex(corpusRoot, options = {}) {
  const dir = join(corpusRoot, "media");
  const byFolder = new Map();
  const seen = new Set();

  /*
   * MP3 copies of WAV and AIFF parts (corpus:transcode). A chart links the
   * copy under the original's part name, so the player's buttons stay the
   * same and only what they play gets smaller and plays everywhere.
   */
  const transcodedPath = join(dir, "transcoded.json");
  const transcoded = existsSync(transcodedPath)
    ? JSON.parse(await readFile(transcodedPath, "utf8")).files || {}
    : {};

  if (existsSync(dir)) {
    for (const name of (await readdir(dir)).sort()) {
      if (!name.endsWith(".ndjson")) continue;
      for (const line of (await readFile(join(dir, name), "utf8")).trim().split("\n")) {
        if (!line) continue;
        const rec = JSON.parse(line);
        if (!rec.songName || !rec.key) continue;
        if (seen.has(rec.key)) continue; // the ledgers overlap
        seen.add(rec.key);
        if (!byFolder.has(rec.songName)) byFolder.set(rec.songName, []);
        byFolder.get(rec.songName).push(rec);
      }
    }
  }

  const folderNames = [...byFolder.keys()];
  let resolve = () => ({ media: [], tempo: null, dropboxUrl: null });

  if (folderNames.length > 0) {
    // Matching is title -> folder, so it is built lazily per title lookup with
    // a cache: the caller asks about one song at a time.
    const cache = new Map();
    resolve = (title) => {
      if (cache.has(title)) return cache.get(title);
      const { matched, probable } = matchTitles(folderNames, [{ id: "t", title, aka: null }]);
      const names = [...matched, ...probable].map((m) => m.title);
      const records = names.flatMap((n) => byFolder.get(n) || []);
      const bpms = [...new Set(records.map((r) => r.bpm).filter(Boolean))];
      const result = {
        media: records.map((r) => ({ key: r.key, url: objectUrl(transcoded[r.key]?.key ?? r.key, options), bpm: r.bpm ?? null })),
        // Only when the sources agree — a disagreement is a data question, not
        // something to guess at.
        tempo: bpms.length === 1 ? bpms[0] : null,
        dropboxUrl: records.length > 0 ? dropboxLinkFor(records[0].path) : null,
      };
      cache.set(title, result);
      return result;
    };
  }

  return { forTitle: resolve, size: folderNames.length };
}
