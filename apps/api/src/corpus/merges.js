/**
 * Songs merged from several copies, and what each took from the others.
 *
 * `pnpm corpus:dedupe --apply` supersedes the copies of one song in favour of
 * the best of them and records here the details the winner lacked — the
 * artist, tempo and album of the publisher's PDF behind the church's own chart.
 * `corpus:build` reads it and writes those details into the winner's file, so
 * a rebuild keeps them and the decision stays in git.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = resolve(__dirname, "../../../../corpus/merges.json");

/**
 * @param {string} [path]
 * @returns {Map<string, {artist?:string, tempo?:string, time?:string, year?:string, x_album?:string, x_writers?:string, aka?:string[]}>}
 */
export function loadMerges(path = DEFAULT_PATH) {
  const file = existsSync(path) ? path : join(process.cwd(), "corpus", "merges.json");
  if (!existsSync(file)) return new Map();
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  return new Map(Object.entries(parsed.songs || {}).map(([id, entry]) => [id, entry.carry || {}]));
}
