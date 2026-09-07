/**
 * Import a directory of legacy `.chrd` files into one organization's songs.
 *
 * Idempotent: every file maps to a deterministic song id derived from its
 * relative path, so re-running updates changed songs and leaves the rest
 * alone. It never deletes and never touches songs it did not create.
 *
 * Run through the root wrapper (which selects the env file):
 *   pnpm import:chrd [dev|staging|production] --dir <path> --org <uuid|exact name>
 *                    [--created-by <email>] [--dry-run] [--exclude <glob>]... [--report <dir>]
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { and, asc, eq } from "drizzle-orm";
import { convertChrdToChordPro } from "@vpc-music/shared";
import { db, pool } from "./db.js";
import { organizations, organizationMembers, users, songs } from "./schema/index.js";

// Fixed namespace for the path -> id derivation. Never change it: ids must stay
// stable across runs and machines.
const ID_NAMESPACE = Buffer.from("6f1d2c1e0d0b4c1a9c6a3e2f8b7a5d41", "hex");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BATCH_SIZE = 50;

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

function globToRegExp(glob) {
  const escaped = String(glob).replace(/[.+^${}()|[\]\\]/g, (ch) => `\\${ch}`).replace(/\*/g, "[^/]*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

export function parseArgs(argv) {
  const options = { dir: null, org: null, createdBy: null, dryRun: false, exclude: [], report: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value after ${arg}`);
      return argv[index];
    };
    if (arg === "--dir") options.dir = next();
    else if (arg === "--org") options.org = next();
    else if (arg === "--created-by") options.createdBy = next();
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--exclude") options.exclude.push(next());
    else if (arg === "--report") options.report = next();
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.dir) throw new Error("--dir <path> is required");
  if (!options.org) throw new Error("--org <uuid|exact name> is required");
  return options;
}

export async function findChrdFiles(inputDir) {
  const entries = await readdir(inputDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = join(inputDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findChrdFiles(fullPath)));
    } else if (/\.chrd$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function nullable(value) {
  return value === undefined || value === null || value === "" ? null : value;
}

/** Fields the importer owns; a song is "unchanged" when all of them match. */
function songFingerprint(row) {
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

/**
 * Convert every file and decide insert / update / unchanged against the rows
 * already in the database. Pure apart from reading the files.
 */
export async function planImport({ dir, files, existingById, existingInOrg, excludes = [] }) {
  const excludePatterns = excludes.map(globToRegExp);
  const entries = [];
  const failures = [];
  const skipped = [];

  for (const sourcePath of files) {
    const relativePath = normalizeRelativePath(relative(dir, sourcePath));
    if (excludePatterns.some((pattern) => pattern.test(relativePath) || pattern.test(basename(relativePath)))) {
      skipped.push(relativePath);
      continue;
    }
    try {
      const raw = await readFile(sourcePath, "utf8");
      const conversion = convertChrdToChordPro(basename(sourcePath), raw);
      const id = deterministicSongId(relativePath);
      const row = {
        id,
        title: conversion.metadata.title,
        key: nullable(conversion.metadata.key),
        artist: nullable(conversion.metadata.artist),
        year: nullable(conversion.metadata.year),
        tempo: nullable(conversion.metadata.tempo),
        content: conversion.chordProContent,
        isDraft: conversion.metadata.isDraft,
      };
      const existing = existingById.get(id);
      const action = !existing ? "insert" : songFingerprint(existing) === songFingerprint(row) ? "unchanged" : "update";
      entries.push({ relativePath, row, action, warnings: conversion.warnings });
    } catch (error) {
      failures.push({ relativePath, error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Titles that would collide with songs in the org that this run does not own
  const ownedIds = new Set(entries.map((entry) => entry.row.id));
  const foreignTitles = new Map();
  for (const song of existingInOrg) {
    if (ownedIds.has(song.id)) continue;
    const key = normalizeTitle(song.title);
    if (!foreignTitles.has(key)) foreignTitles.set(key, []);
    foreignTitles.get(key).push(song);
  }
  const collisions = [];
  for (const entry of entries) {
    const matches = foreignTitles.get(normalizeTitle(entry.row.title)) || [];
    for (const match of matches) {
      collisions.push({ relativePath: entry.relativePath, title: entry.row.title, existingId: match.id, existingTitle: match.title });
    }
  }

  // Titles duplicated inside the corpus itself (draft/final pairs, etc.)
  const byTitle = new Map();
  for (const entry of entries) {
    const key = normalizeTitle(entry.row.title);
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key).push(entry.relativePath);
  }
  const duplicateTitles = [...byTitle.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([title, paths]) => ({ title, files: paths }));

  const counts = { files: files.length, skipped: skipped.length, converted: entries.length, failed: failures.length, inserts: 0, updates: 0, unchanged: 0, drafts: 0 };
  for (const entry of entries) {
    if (entry.action === "insert") counts.inserts += 1;
    else if (entry.action === "update") counts.updates += 1;
    else counts.unchanged += 1;
    if (entry.row.isDraft) counts.drafts += 1;
  }

  return { entries, failures, skipped, collisions, duplicateTitles, counts };
}

export function formatReportText(report) {
  const lines = [
    "VPC Music .chrd Library Import Report",
    "=====================================",
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.dryRun ? "DRY RUN (nothing written)" : "APPLIED"}`,
    `Directory: ${report.dir}`,
    `Organization: ${report.organization.name} (${report.organization.id})`,
    `Created by: ${report.createdBy.email}`,
    "",
    "Summary",
    `- Files: ${report.counts.files} (skipped by --exclude: ${report.counts.skipped})`,
    `- Converted: ${report.counts.converted}, failed: ${report.counts.failed}`,
    `- Inserts: ${report.counts.inserts}, updates: ${report.counts.updates}, unchanged: ${report.counts.unchanged}`,
    `- Drafts: ${report.counts.drafts}`,
    "",
    `Converter warnings (${report.entries.filter((entry) => entry.warnings.length > 0).length} files)`,
  ];
  for (const entry of report.entries) {
    for (const warning of entry.warnings) lines.push(`- ${entry.relativePath}: ${warning}`);
  }
  lines.push("", `Title collisions with existing songs not created by this importer (${report.collisions.length})`);
  for (const collision of report.collisions) {
    lines.push(`- ${collision.relativePath} "${collision.title}" vs existing ${collision.existingId} "${collision.existingTitle}"`);
  }
  lines.push("", `Duplicate titles inside the corpus (${report.duplicateTitles.length})`);
  for (const duplicate of report.duplicateTitles) lines.push(`- "${duplicate.title}": ${duplicate.files.join(", ")}`);
  lines.push("", `Failures (${report.failures.length})`);
  for (const failure of report.failures) lines.push(`- ${failure.relativePath}: ${failure.error}`);
  return `${lines.join("\n")}\n`;
}

async function resolveOrganization(database, orgArg) {
  const rows = await database.select({ id: organizations.id, name: organizations.name }).from(organizations);
  const match = UUID_PATTERN.test(orgArg)
    ? rows.find((row) => row.id.toLowerCase() === orgArg.toLowerCase())
    : rows.find((row) => row.name === orgArg);
  if (!match) {
    const list = rows.map((row) => `  ${row.id}  ${row.name}`).join("\n") || "  (none)";
    throw new Error(`Organization "${orgArg}" not found. Organizations in this database:\n${list}`);
  }
  return match;
}

async function resolveCreator(database, organization, createdByArg) {
  if (createdByArg) {
    const [user] = await database.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, createdByArg)).limit(1);
    if (!user) throw new Error(`User "${createdByArg}" not found`);
    const [membership] = await database
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, organization.id), eq(organizationMembers.userId, user.id)))
      .limit(1);
    if (!membership) {
      throw new Error(
        `User ${user.email} has no membership in "${organization.name}". Add one first, e.g.\n` +
          `  INSERT INTO organization_members (organization_id, user_id, role) VALUES ('${organization.id}', '${user.id}', 'admin');`,
      );
    }
    return user;
  }

  const [admin] = await database
    .select({ id: users.id, email: users.email })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(and(eq(organizationMembers.organizationId, organization.id), eq(organizationMembers.role, "admin")))
    .orderBy(asc(organizationMembers.createdAt))
    .limit(1);
  if (!admin) throw new Error(`"${organization.name}" has no admin member to own the imported songs; pass --created-by <email>`);
  return admin;
}

/**
 * Run the import. `database` defaults to the app's Drizzle instance; tests
 * pass a pg-mem instance. Returns the report object.
 */
export async function runImport(options, { database = db, log = console.log } = {}) {
  const dir = resolve(options.dir);
  if (!existsSync(dir)) throw new Error(`Directory does not exist: ${dir}`);

  const organization = await resolveOrganization(database, options.org);
  const creator = await resolveCreator(database, organization, options.createdBy);
  const files = await findChrdFiles(dir);

  const existingInOrg = await database
    .select({ id: songs.id, title: songs.title, key: songs.key, artist: songs.artist, year: songs.year, tempo: songs.tempo, content: songs.content, isDraft: songs.isDraft })
    .from(songs)
    .where(eq(songs.organizationId, organization.id));
  const existingById = new Map(existingInOrg.map((song) => [song.id, song]));

  const plan = await planImport({ dir, files, existingById, existingInOrg, excludes: options.exclude || [] });

  const report = {
    generatedAt: new Date().toISOString(),
    dryRun: Boolean(options.dryRun),
    dir,
    organization,
    createdBy: creator,
    counts: plan.counts,
    entries: plan.entries.map((entry) => ({ relativePath: entry.relativePath, id: entry.row.id, title: entry.row.title, action: entry.action, isDraft: entry.row.isDraft, warnings: entry.warnings })),
    skipped: plan.skipped,
    collisions: plan.collisions,
    duplicateTitles: plan.duplicateTitles,
    failures: plan.failures,
  };

  if (plan.failures.length > 0) {
    log(`${plan.failures.length} file(s) failed to convert; nothing written.`);
  } else if (!options.dryRun) {
    const inserts = plan.entries.filter((entry) => entry.action === "insert").map((entry) => ({
      ...entry.row,
      tier: "organization",
      organizationId: organization.id,
      createdBy: creator.id,
    }));
    const updates = plan.entries.filter((entry) => entry.action === "update");
    await database.transaction(async (tx) => {
      for (let index = 0; index < inserts.length; index += BATCH_SIZE) {
        await tx.insert(songs).values(inserts.slice(index, index + BATCH_SIZE));
      }
      for (const entry of updates) {
        const { id, ...fields } = entry.row;
        await tx.update(songs).set({ ...fields, updatedAt: new Date() }).where(eq(songs.id, id));
      }
    });
    log(`Applied: ${inserts.length} inserted, ${updates.length} updated, ${plan.counts.unchanged} unchanged.`);
  } else {
    log(`Dry run: ${plan.counts.inserts} to insert, ${plan.counts.updates} to update, ${plan.counts.unchanged} unchanged.`);
  }

  if (options.report !== false) {
    const reportDir = resolve(options.report || "import-reports");
    await mkdir(reportDir, { recursive: true });
    const stamp = report.generatedAt.replace(/[:.]/g, "-");
    const base = join(reportDir, `chrd-${process.env.NODE_ENV || "development"}-${stamp}`);
    await writeFile(`${base}.json`, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(`${base}.txt`, formatReportText(report), "utf8");
    report.reportPaths = { json: `${base}.json`, text: `${base}.txt` };
    log(`Report: ${base}.txt`);
  }

  return report;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await runImport(options);
  const { counts } = report;
  console.log(
    `Files ${counts.files} | converted ${counts.converted} | failed ${counts.failed} | drafts ${counts.drafts} | ` +
      `inserts ${counts.inserts} | updates ${counts.updates} | unchanged ${counts.unchanged} | ` +
      `collisions ${report.collisions.length} | duplicate titles ${report.duplicateTitles.length}`,
  );
  if (counts.failed > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(() => pool.end().catch(() => {}));
}
