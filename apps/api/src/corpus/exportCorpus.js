/**
 * songs → corpus. The way back.
 *
 * Musicians edit charts in the app and write new ones there. Without this, the
 * corpus is a one-way snapshot that goes stale the moment anyone touches a
 * song, and the claim that the files are the durable copy stops being true.
 *
 * The conflict rule is the important part. The manifest records the hash of
 * every file as last written, so:
 *
 *   file changed on disk  +  row changed in the app  ->  CONFLICT, reported
 *   only the row changed                             ->  write the file
 *   only the file changed                            ->  left alone, reported
 *   neither                                          ->  nothing to do
 *
 * A conflict is never resolved automatically. This is the one place where
 * guessing costs someone the work they did.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { songs } from "../schema/index.js";
import { corpusFileName, sha256 } from "./identity.js";
import { resolveOrganization } from "./dbLookup.js";

/** Where a song exported from the app lives when it came from no source file. */
export const APP_SOURCE = "app";

export async function readManifestIndex(corpusRoot) {
  const dir = join(corpusRoot, "manifest");
  const bySongId = new Map();
  const manifests = [];
  if (!existsSync(dir)) return { bySongId, manifests };
  for (const file of (await readdir(dir)).sort()) {
    if (!file.endsWith(".json")) continue;
    const path = join(dir, file);
    const data = JSON.parse(await readFile(path, "utf8"));
    manifests.push({ path, data });
    for (const song of data.songs) bySongId.set(song.songId, { song, manifest: data, path });
  }
  return { bySongId, manifests };
}

/**
 * Decide what to do with one song.
 * Pure: takes the database row, the manifest entry and what is on disk.
 */
export function classifyExport({ row, entry, fileContent }) {
  const dbContent = `${String(row.content ?? "").trim()}\n`;

  if (!entry) return { action: "new", dbContent };

  const recorded = entry.song.contentSha256;
  const onDisk = fileContent === null ? null : sha256(fileContent);
  const fromDb = sha256(dbContent);

  const fileChanged = onDisk !== null && onDisk !== recorded;
  const rowChanged = fromDb !== recorded;

  if (fileChanged && rowChanged) return { action: "conflict", dbContent };
  if (rowChanged) return { action: "update", dbContent };
  if (fileChanged) return { action: "file-ahead", dbContent };
  return { action: "unchanged", dbContent };
}

export function formatExportReport(report) {
  const lines = [
    "VPC Music Corpus Export",
    "=======================",
    `Mode: ${report.dryRun ? "DRY RUN (nothing written)" : "APPLIED"}`,
    `Organization: ${report.organization.name}`,
    "",
    `- Songs in the org: ${report.counts.total}`,
    `- New (created in the app): ${report.counts.new}`,
    `- Updated from the app: ${report.counts.update}`,
    `- Unchanged: ${report.counts.unchanged}`,
    `- File ahead of the database: ${report.counts["file-ahead"] ?? 0}`,
    `- CONFLICTS: ${report.counts.conflict ?? 0}`,
  ];
  if (report.conflicts.length > 0) {
    lines.push(
      "",
      "Both the file and the song changed since the last export. Neither was",
      "overwritten — decide which to keep, then re-run.",
    );
    for (const c of report.conflicts) lines.push(`- ${c.title}  (${c.file})`);
  }
  if (report.fileAhead.length > 0) {
    lines.push("", "Edited on disk but not in the app — left alone:");
    for (const f of report.fileAhead.slice(0, 20)) lines.push(`- ${f.title}  (${f.file})`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * @param {{corpusRoot: string, org: string, dryRun?: boolean, force?: boolean}} options
 * @param {{database?: object, log?: Function}} deps
 */
export async function runCorpusExport(options, { database, log = console.log } = {}) {
  if (!database) throw new Error("runCorpusExport needs a database");
  const organization = await resolveOrganization(database, options.org);
  const { bySongId, manifests } = await readManifestIndex(options.corpusRoot);

  const rows = await database
    .select({
      id: songs.id, title: songs.title, key: songs.key, artist: songs.artist,
      year: songs.year, tempo: songs.tempo, content: songs.content,
      isDraft: songs.isDraft, tags: songs.tags,
    })
    .from(songs)
    .where(and(eq(songs.organizationId, organization.id), isNull(songs.deletedAt)));

  const counts = { total: rows.length, new: 0, update: 0, unchanged: 0, conflict: 0, "file-ahead": 0 };
  const conflicts = [];
  const fileAhead = [];
  const writes = [];

  for (const row of rows) {
    const entry = bySongId.get(row.id);
    const file = entry ? entry.song.file : join("songs", APP_SOURCE, corpusFileName(row.title, row.id)).replace(/\\/g, "/");
    const path = join(options.corpusRoot, file);
    const fileContent = existsSync(path) ? await readFile(path, "utf8") : null;

    const { action, dbContent } = classifyExport({ row, entry, fileContent });
    counts[action] += 1;

    if (action === "conflict") {
      conflicts.push({ title: row.title, file, id: row.id });
      if (!options.force) continue;
    }
    if (action === "file-ahead") {
      fileAhead.push({ title: row.title, file, id: row.id });
      continue;
    }
    if (action === "unchanged") continue;

    writes.push({ row, file, path, content: dbContent, action, entry });
  }

  const report = {
    dryRun: options.dryRun !== false,
    organization,
    counts,
    conflicts,
    fileAhead,
    writes: writes.map((w) => ({ id: w.row.id, title: w.row.title, action: w.action, file: w.file })),
  };

  if (report.dryRun) {
    log(`Dry run: ${counts.new} new, ${counts.update} updated, ${counts.conflict} conflict(s).`);
    return report;
  }

  for (const write of writes) {
    await mkdir(dirname(write.path), { recursive: true });
    await writeFile(write.path, write.content, "utf8");

    const hash = sha256(write.content);
    if (write.entry) {
      write.entry.song.contentSha256 = hash;
      write.entry.song.title = write.row.title;
      write.entry.song.metadata = {
        ...write.entry.song.metadata,
        key: write.row.key ?? null,
        artist: write.row.artist ?? null,
        year: write.row.year ?? null,
        tempo: write.row.tempo ?? null,
        isDraft: Boolean(write.row.isDraft),
      };
    } else {
      // Written in the app, so it belongs to no source tree.
      let appManifest = manifests.find((m) => m.data.sourceType === APP_SOURCE);
      if (!appManifest) {
        appManifest = {
          path: join(options.corpusRoot, "manifest", `${APP_SOURCE}.json`),
          data: { sourceType: APP_SOURCE, songs: [] },
        };
        manifests.push(appManifest);
      }
      appManifest.data.songs.push({
        songId: write.row.id,
        title: write.row.title,
        file: write.file,
        contentSha256: hash,
        metadata: {
          key: write.row.key ?? null,
          artist: write.row.artist ?? null,
          year: write.row.year ?? null,
          tempo: write.row.tempo ?? null,
          isDraft: Boolean(write.row.isDraft),
        },
        sourceType: APP_SOURCE,
        sources: [{ role: "primary", path: null, sha256: null }],
        themes: [],
        confidence: { score: 1, band: "high", reasons: [] },
        warnings: [],
        decision: "song",
      });
    }
  }

  for (const manifest of manifests) {
    manifest.data.songs.sort((a, b) => a.songId.localeCompare(b.songId));
    await mkdir(dirname(manifest.path), { recursive: true });
    await writeFile(manifest.path, `${JSON.stringify(manifest.data, null, 2)}\n`, "utf8");
  }

  log(`Exported: ${counts.new} new, ${counts.update} updated, ${counts.conflict} conflict(s).`);
  return report;
}
