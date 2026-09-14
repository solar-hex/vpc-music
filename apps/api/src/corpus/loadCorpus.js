/**
 * corpus → songs. The only writer.
 *
 * Phase 2 of the two-phase pipeline. It reads the committed corpus and nothing
 * else — never a source tree, never a converter. That separation is the point:
 * conversion cannot touch the database, and every format converges here.
 *
 *   build:  sources → corpus/songs/*.chopro     (no DB access at all)
 *   load:   corpus  → songs table               (this)
 *
 * Safety properties, in order of how much they matter:
 *  - Dry run by default. Nothing is written without an explicit apply.
 *  - A song whose file no longer matches its recorded hash is a HARD ERROR.
 *    That is the failure mode that would quietly turn the corpus back into the
 *    file library the database replaced.
 *  - `--fields` limits a run to the columns it owns, so an enrichment pass can
 *    never disturb the seven fields the chart itself owns.
 *  - Superseded copies are skipped, never written.
 *  - One transaction. Nothing half-applies.
 */
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { songs } from "../schema/index.js";
import { formatTagField, hasChords } from "@vpc-music/shared";
import { nullable, sha256 } from "./identity.js";
import { parseHeader, splitHeader } from "./enrich.js";
import { resolveCreator, resolveOrganization } from "./dbLookup.js";

const BATCH_SIZE = 50;

/**
 * Which columns a run is allowed to touch.
 *
 * `core` is exactly the set the legacy importer owns, so the two can coexist
 * without fighting. `tags` is ours alone — the importer excludes it from its
 * fingerprint, so theme labels survive a re-import.
 */
export const FIELD_SETS = {
  core: ["title", "key", "artist", "year", "tempo", "content", "isDraft"],
  tags: ["tags"],
  // `aka` joins tags as ours: the legacy importer never wrote it, so a reviewed
  // alternate title cannot be clobbered by a re-import.
  all: ["title", "key", "artist", "year", "tempo", "content", "isDraft", "tags", "aka", "status"],
};

/** Read every manifest in the corpus. */
export async function readManifests(corpusRoot) {
  const dir = join(corpusRoot, "manifest");
  if (!existsSync(dir)) throw new Error(`No corpus manifests at ${dir}`);
  const out = [];
  for (const file of (await readdir(dir)).sort()) {
    if (file.endsWith(".json")) out.push(JSON.parse(await readFile(join(dir, file), "utf8")));
  }
  return out;
}

/**
 * Turn the corpus into rows, verifying each file against its recorded hash.
 *
 * @returns {Promise<{rows: Array, skipped: Array, tampered: Array}>}
 */
export async function readCorpusRows(corpusRoot, { fields = "core" } = {}) {
  const manifests = await readManifests(corpusRoot);
  const rows = [];
  const skipped = [];
  const tampered = [];
  const missing = [];

  for (const manifest of manifests) {
    for (const song of manifest.songs) {
      if (song.decision && song.decision !== "song") {
        skipped.push({ songId: song.songId, title: song.title, reason: song.decision });
        continue;
      }
      const path = join(corpusRoot, song.file);
      if (!existsSync(path)) {
        missing.push({ songId: song.songId, file: song.file });
        continue;
      }
      const content = await readFile(path, "utf8");
      if (sha256(content) !== song.contentSha256) {
        tampered.push({ songId: song.songId, file: song.file, title: song.title });
        continue;
      }

      /*
       * The FILE is the record, not the manifest's copy of it. The manifest
       * stores what the converter read; the file also carries what enrichment
       * worked out afterwards — 92 songs have a tempo derived from a media
       * filename that the manifest never learned. Reading the manifest here
       * meant those tempos existed in the corpus and never reached the app.
       *
       * Everything else agrees exactly (title, key, artist, year and themes
       * were compared across all 909 live songs), so the manifest is the
       * fallback, and `isDraft` still comes from it — a review state is not a
       * fact about the chart.
       */
      const header = parseHeader(splitHeader(content).header);
      const directive = (name) => nullable(header.get(name));
      // `songs.tempo` is an integer column, and `fingerprint` is JSON — so a
      // directive's "72" would never equal a stored 72 and every run would
      // rewrite every tempo. Idempotence is the whole point of the loader.
      const tempoOf = (value) => {
        const n = Number(value);
        return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
      };
      const fileThemes = (directive("x_theme") || "").split(",").map((t) => t.trim()).filter(Boolean);
      const themes = fileThemes.length > 0 ? fileThemes : song.themes || [];
      // Flags ride in the same column, namespaced apart: `flag:unlisted` is a
      // property of the song, `theme:blood` is what it is about.
      const flags = (directive("x_flag") || "").split(",").map((f) => f.trim()).filter(Boolean);
      const lyricsOnly = !hasChords(content);

      rows.push({
        id: song.songId,
        title: directive("title") ?? song.title,
        aka: directive("x_aka"),
        key: directive("key") ?? nullable(song.metadata?.key),
        artist: directive("artist") ?? nullable(song.metadata?.artist),
        year: directive("year") ?? nullable(song.metadata?.year),
        tempo: tempoOf(directive("tempo") ?? song.metadata?.tempo),
        content,
        /*
         * A lyrics sheet is a finished lyrics sheet, not a half-finished chart.
         * The converters mark it a draft because it has no chords, but that
         * reason is carried by `status` below, which the app renders as
         * "Lyrics only". Being a draft as well hid a fifth of the library for
         * no reason, so a lyrics sheet is listed — unless it is flagged
         * unlisted, because the song list hides by `isDraft` and the old
         * site's tilde has to keep working.
         */
        isDraft: lyricsOnly && !flags.includes("unlisted") ? false : Boolean(song.metadata?.isDraft),
        /*
         * A musician reaching for a chart needs to know before they open it
         * that there are no chords in it. This is what says so, and it gives
         * the `status` enum its first real use.
         */
        status: lyricsOnly ? "missing_chords" : null,
        tags: formatTagField({ flags, themes }) || null,
        source: manifest.sourceType,
      });
    }
  }

  if (tampered.length > 0) {
    const list = tampered.slice(0, 5).map((t) => `  ${t.file}`).join("\n");
    throw new Error(
      `${tampered.length} corpus file(s) no longer match the hash recorded for them:\n${list}\n` +
        `They were edited by hand. Edit the song in the app and run corpus:export, ` +
        `or re-run corpus:build to regenerate them.`,
    );
  }

  return { rows, skipped, missing, fields: FIELD_SETS[fields] ?? FIELD_SETS.core };
}

/** The fields this run owns, as a comparable string. */
export function fingerprint(row, fields) {
  const picked = {};
  for (const f of fields) picked[f] = f === "isDraft" ? Boolean(row[f]) : nullable(row[f]);
  return JSON.stringify(picked);
}

/**
 * Decide insert / update / unchanged for every row, against what is already
 * in the org. Pure — it takes the existing rows rather than fetching them.
 */
export function planCorpusLoad({ rows, existingById, fields }) {
  const entries = [];
  const counts = { rows: rows.length, inserts: 0, updates: 0, unchanged: 0, drafts: 0 };

  for (const row of rows) {
    const existing = existingById.get(row.id);
    const action = !existing
      ? "insert"
      : fingerprint(existing, fields) === fingerprint(row, fields)
        ? "unchanged"
        : "update";
    entries.push({ action, row });
    counts[action === "insert" ? "inserts" : action === "update" ? "updates" : "unchanged"] += 1;
    if (row.isDraft) counts.drafts += 1;
  }

  // Rows in the org that the corpus does not know about. Reported, never
  // touched — they may be songs someone wrote in the app.
  const corpusIds = new Set(rows.map((r) => r.id));
  const foreign = [...existingById.values()].filter((s) => !corpusIds.has(s.id));

  return { entries, counts, foreign };
}

export function formatLoadReport(report) {
  const lines = [
    "VPC Music Corpus Load",
    "=====================",
    `Mode: ${report.dryRun ? "DRY RUN (nothing written)" : "APPLIED"}`,
    `Corpus: ${report.corpusRoot}`,
    `Database: ${report.host ?? "(unknown host)"} / ${report.database ?? "?"}`,
    `Organization: ${report.organization.name} (${report.organization.id})`,
    `Created by: ${report.createdBy.email}`,
    `Fields this run owns: ${report.fields.join(", ")}`,
    "",
    "Plan",
    `- Corpus songs: ${report.counts.rows}  (skipped as superseded: ${report.skipped.length})`,
    `- Inserts: ${report.counts.inserts}`,
    `- Updates: ${report.counts.updates}`,
    `- Unchanged: ${report.counts.unchanged}`,
    `- Drafts among them: ${report.counts.drafts}`,
    `- Rows in this org the corpus does not know about: ${report.foreign.length}`,
    ...(report.archived?.length
      ? [`- Superseded duplicates retired (is_archived, reversible): ${report.archived.length}`]
      : []),
  ];
  if (report.missing.length > 0) {
    lines.push("", `Manifest entries with no file (${report.missing.length})`);
    for (const m of report.missing.slice(0, 10)) lines.push(`- ${m.file}`);
  }
  if (report.foreign.length > 0) {
    lines.push("", `Left untouched — not from the corpus (${report.foreign.length})`);
    for (const f of report.foreign.slice(0, 20)) lines.push(`- ${f.id}  ${f.title}`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * @param {object} options
 * @param {string} options.corpusRoot
 * @param {string} options.org            id or exact name
 * @param {string} [options.createdBy]    email
 * @param {"core"|"tags"|"all"} [options.fields]
 * @param {boolean} [options.dryRun]
 * @param {boolean} [options.archiveSuperseded] retire rows the corpus superseded
 * @param {{database?: object, log?: Function}} [deps]
 */
export async function runCorpusLoad(options, { database, log = console.log } = {}) {
  if (!database) throw new Error("runCorpusLoad needs a database");
  const fieldSet = FIELD_SETS[options.fields ?? "core"];
  if (!fieldSet) throw new Error(`--fields must be one of: ${Object.keys(FIELD_SETS).join(", ")}`);

  const organization = await resolveOrganization(database, options.org);
  const creator = await resolveCreator(database, organization, options.createdBy);

  const { rows, skipped, missing } = await readCorpusRows(options.corpusRoot, { fields: options.fields });

  const existingInOrg = await database
    .select({
      id: songs.id, title: songs.title, aka: songs.aka, key: songs.key, artist: songs.artist,
      year: songs.year, tempo: songs.tempo, content: songs.content,
      isDraft: songs.isDraft, tags: songs.tags, status: songs.status, isArchived: songs.isArchived,
    })
    .from(songs)
    .where(eq(songs.organizationId, organization.id));
  const existingById = new Map(existingInOrg.map((s) => [s.id, s]));

  const plan = planCorpusLoad({ rows, existingById, fields: fieldSet });

  /*
   * A supersede decision made after a load leaves the loser sitting in the
   * library as a duplicate: the loader skips it, so it is never updated and
   * never removed. Retiring it is `is_archived = true` — the list endpoint
   * already excludes archived songs and `POST /songs/:id/unarchive` puts one
   * back, so the decision stays reversible. NEVER a delete.
   */
  const supersededIds = new Set(skipped.filter((s) => s.reason !== "song").map((s) => s.songId));
  const toArchive = options.archiveSuperseded
    ? [...existingById.values()].filter((s) => supersededIds.has(s.id) && !s.isArchived)
    : [];

  const report = {
    dryRun: options.dryRun !== false,
    corpusRoot: options.corpusRoot,
    organization,
    createdBy: creator,
    fields: fieldSet,
    counts: plan.counts,
    skipped,
    missing,
    foreign: plan.foreign,
    archived: toArchive.map((s) => ({ id: s.id, title: s.title })),
    host: options.host,
    database: options.database,
    entries: plan.entries.map((e) => ({ id: e.row.id, title: e.row.title, action: e.action })),
  };

  if (report.dryRun) {
    const tail = toArchive.length > 0 ? `, ${toArchive.length} to archive` : "";
    log(`Dry run: ${plan.counts.inserts} to insert, ${plan.counts.updates} to update, ${plan.counts.unchanged} unchanged${tail}.`);
    return report;
  }

  const inserts = plan.entries
    .filter((e) => e.action === "insert")
    .map((e) => {
      const row = { id: e.row.id, tier: "organization", organizationId: organization.id, createdBy: creator.id };
      // An insert has to carry the columns that make a valid row, whatever
      // this run's field mask is — a song with no content is not a song.
      for (const f of FIELD_SETS.all) {
        if (fieldSet.includes(f) || f === "title" || f === "content") row[f] = e.row[f];
      }
      return row;
    });
  const updates = plan.entries.filter((e) => e.action === "update");

  await database.transaction(async (tx) => {
    for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
      await tx.insert(songs).values(inserts.slice(i, i + BATCH_SIZE));
    }
    for (const entry of updates) {
      const patch = {};
      for (const f of fieldSet) patch[f] = entry.row[f];
      await tx.update(songs).set({ ...patch, updatedAt: new Date() }).where(eq(songs.id, entry.row.id));
    }
    for (const row of toArchive) {
      await tx
        .update(songs)
        .set({ isArchived: true, archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(songs.id, row.id));
    }
  });

  const archivedTail = toArchive.length > 0 ? `, ${toArchive.length} archived` : "";
  log(`Applied: ${inserts.length} inserted, ${updates.length} updated, ${plan.counts.unchanged} unchanged${archivedTail}.`);
  return report;
}
