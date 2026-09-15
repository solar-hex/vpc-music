/**
 * Normalise an artist credit.
 *
 * An "artist" here is often an organisation rather than a person — Indiana
 * Bible College, Elevation Worship, The Pentecostals of Katy — and a chart may
 * credit either the spelled-out name or its initials. Both should land on one
 * value, spelled out, with the common short form in parentheses so it stays
 * searchable:
 *
 *   "IBC"                    -> "Indiana Bible College (IBC)"
 *   "Indiana Bible College"  -> "Indiana Bible College (IBC)"
 *   "Charity Gale"           -> "Charity Gayle"
 *
 * The table lives in `corpus/artists.json`, committed and hand-editable, for
 * the same reason the theme lexicon does: it is a judgement call that a person
 * should be able to correct without touching code.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_TABLE = resolve(__dirname, "../../../../corpus/artists.json");

let cached = null;

export function loadArtistTable(path = DEFAULT_TABLE) {
  if (cached && cached.path === path) return cached.data;
  // The API image carries no corpus: there, an import keeps credits as printed
  // rather than failing, the way the other corpus ledgers read as empty.
  const data = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  // Case-insensitive lookups, built once.
  data._aliases = new Map(Object.entries(data.aliases || {}).map(([k, v]) => [k.toLowerCase(), v]));
  // Keyed lowercase for lookup, but carrying the table's own spelling so a
  // lowercase credit comes back properly cased.
  data._initialisms = new Map(
    Object.entries(data.initialisms || {}).map(([k, v]) => [k.toLowerCase(), { name: k, initials: v }]),
  );
  data._ignore = new Set((data.ignore || []).map((s) => s.toLowerCase()));
  cached = { path, data };
  return data;
}

/** Trim, collapse whitespace, straighten quotes, drop a trailing separator. */
export function cleanArtist(value) {
  return String(value || "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .replace(/^[\s,;–—-]+|[\s,;–—-]+$/g, "")
    .trim();
}

/**
 * @param {string} value
 * @returns {string|null} the canonical credit, or null when there isn't one
 */
export function normalizeArtist(value, options = {}) {
  const table = options.table ?? loadArtistTable(options.tablePath);
  let name = cleanArtist(value);
  if (!name) return null;

  // Strip a short form the chart already appended, so it is not doubled.
  const already = name.match(/^(.*?)\s*\(([A-Za-z.&' -]{2,20})\)$/);
  if (already) name = cleanArtist(already[1]);

  if (table._ignore.has(name.toLowerCase())) return null;

  const alias = table._aliases.get(name.toLowerCase());
  if (alias) name = alias;

  if (table._ignore.has(name.toLowerCase())) return null;

  const known = table._initialisms.get(name.toLowerCase());
  return known ? `${known.name} (${known.initials})` : name;
}

/**
 * Every credit on a chart, normalised and de-duplicated. A chart may name a
 * performer and its songwriters separately; both are worth keeping, but the
 * performer is the one that goes in `songs.artist`.
 */
export function normalizeCredits({ artist, writers } = {}, options = {}) {
  const performer = normalizeArtist(artist, options);
  const writerList = String(writers || "")
    .split(/\s*,\s*|\s+&\s+|\s+and\s+/i)
    .map((w) => cleanArtist(w))
    .filter((w) => w.length > 2 && /[a-z]/i.test(w));
  return {
    artist: performer,
    writers: writerList.length > 0 ? [...new Set(writerList)].join(", ") : null,
  };
}
