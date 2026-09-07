/**
 * The .chrd library importer against a real (pg-mem) database: deterministic
 * ids, insert / update / unchanged planning, drafts by filename, exclusions,
 * title-collision reporting and the membership guard.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { createPgMemDb } from "./helpers/pgMemDb.js";

const memDb = createPgMemDb();
vi.mock("../db.js", () => memDb);

const { runImport, deterministicSongId, parseArgs, normalizeTitle } = await import("../import-chrd-library.js");
const { organizations, users, organizationMembers, songs } = await import("../schema/index.js");

const AMAZING_GRACE = [
  "Amazing Grace",
  "G",
  "Author: John Newton",
  "Year: 1779",
  "",
  "Chorus",
  "# [G]    [G7]        [C]       [G]",
  "@ Amazing Grace! (how sweet the sound)",
].join("\r\n");

const DRAFT = ["Draft Song", "C", "", "Verse", "#C      F", "^Am     G", "@Sing to the Lord"].join("\n");
const ADVENT = ["Advent Song", "D", "", "Verse", "#[D]      [G]", "@ Lift your eyes"].join("\n");

let dir;
let reportDir;
let orgId;
let adminId;
const log = () => {};

beforeAll(async () => {
  const { db } = memDb;
  const [org] = await db.insert(organizations).values({ name: "Test Church" }).returning();
  orgId = org.id;
  const [admin] = await db.insert(users).values({ email: "admin@test.church", displayName: "Admin", role: "member" }).returning();
  adminId = admin.id;
  await db.insert(users).values({ email: "outsider@test.church", displayName: "Outsider", role: "member" });
  await db.insert(organizationMembers).values({ organizationId: orgId, userId: adminId, role: "admin" });

  dir = await mkdtemp(join(tmpdir(), "vpc-chrd-import-"));
  reportDir = join(dir, "reports");
  await mkdir(join(dir, "seasonal"), { recursive: true });
  await writeFile(join(dir, "amazing_grace.chrd"), AMAZING_GRACE, "utf8");
  await writeFile(join(dir, "~draft_song.chrd"), DRAFT, "utf8");
  await writeFile(join(dir, "seasonal", "advent.chrd"), ADVENT, "utf8");
});

describe("parseArgs", () => {
  it("parses flags and requires --dir and --org", () => {
    expect(parseArgs(["--dir", "x", "--org", "Team", "--dry-run", "--exclude", "~z_*", "--exclude", "tmp/*", "--created-by", "a@b"])).toEqual({
      dir: "x",
      org: "Team",
      createdBy: "a@b",
      dryRun: true,
      exclude: ["~z_*", "tmp/*"],
      report: null,
    });
    expect(() => parseArgs(["--org", "Team"])).toThrow("--dir");
    expect(() => parseArgs(["--dir", "x"])).toThrow("--org");
    expect(() => parseArgs(["--dir", "x", "--org", "y", "--bogus"])).toThrow("Unknown argument");
  });
});

describe("deterministicSongId", () => {
  it("is stable, path-shaped and slash/case-insensitive", () => {
    const id = deterministicSongId("seasonal/advent.chrd");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(deterministicSongId("seasonal\\Advent.chrd")).toBe(id);
    expect(deterministicSongId("advent.chrd")).not.toBe(id);
  });
});

describe("runImport", () => {
  it("dry run plans inserts, writes a report and touches nothing", async () => {
    const report = await runImport({ dir, org: "Test Church", dryRun: true, report: reportDir }, { log });

    expect(report.counts).toEqual({ files: 3, skipped: 0, converted: 3, failed: 0, inserts: 3, updates: 0, unchanged: 0, drafts: 1 });
    expect(report.entries.find((entry) => entry.relativePath === "seasonal/advent.chrd").id).toBe(deterministicSongId("seasonal/advent.chrd"));
    expect(existsSync(report.reportPaths.json)).toBe(true);
    const text = await readFile(report.reportPaths.text, "utf8");
    expect(text).toContain("DRY RUN");
    expect(text).toContain("- Inserts: 3, updates: 0, unchanged: 0");

    const rows = await memDb.db.select().from(songs);
    expect(rows).toHaveLength(0);
  });

  it("applies inserts with the org, creator, tier and draft flag", async () => {
    const report = await runImport({ dir, org: "Test Church", report: reportDir }, { log });
    expect(report.counts.inserts).toBe(3);

    const rows = await memDb.db.select().from(songs).where(eq(songs.organizationId, orgId));
    expect(rows).toHaveLength(3);
    const draft = rows.find((row) => row.title === "Draft Song");
    expect(draft.isDraft).toBe(true);
    expect(draft.tier).toBe("organization");
    expect(draft.createdBy).toBe(adminId);
    expect(draft.key).toBe("C");
    expect(draft.content).toContain("[*Am][C]Sing to[*G][F] the Lord");
    const grace = rows.find((row) => row.title === "Amazing Grace");
    expect(grace.isDraft).toBe(false);
    expect(grace.artist).toBe("John Newton");
    expect(grace.year).toBe("1779");
    expect(grace.content).toContain("A[G]mazing [G7]Grace!");
  });

  it("reports every file unchanged on a second run", async () => {
    const report = await runImport({ dir, org: "Test Church", report: false }, { log });
    expect(report.counts).toMatchObject({ inserts: 0, updates: 0, unchanged: 3 });
  });

  it("updates a song whose file changed, keeping its id", async () => {
    await writeFile(join(dir, "seasonal", "advent.chrd"), ADVENT.replace("Lift your eyes", "Lift up your eyes"), "utf8");
    const report = await runImport({ dir, org: orgId, report: false }, { log });
    expect(report.counts).toMatchObject({ inserts: 0, updates: 1, unchanged: 2 });

    // The [G] token lands inside the changed lyric ("Lift up y[G]our eyes"),
    // so check the words on either side of it.
    const [row] = await memDb.db.select().from(songs).where(eq(songs.id, deterministicSongId("seasonal/advent.chrd")));
    expect(row.content).toContain("Lift up");
    expect(row.content).not.toContain("Lift your");
    expect(await memDb.db.select({ id: songs.id }).from(songs)).toHaveLength(3);
  });

  it("skips files matching --exclude globs", async () => {
    const report = await runImport({ dir, org: "Test Church", dryRun: true, exclude: ["~*"], report: false }, { log });
    expect(report.counts.skipped).toBe(1);
    expect(report.skipped).toEqual(["~draft_song.chrd"]);
    expect(report.counts.converted).toBe(2);
  });

  it("reports title collisions with songs it does not own and in-corpus duplicates", async () => {
    await memDb.db.insert(songs).values({ title: "AMAZING grace", content: "{title: x}", organizationId: orgId, createdBy: adminId });
    await writeFile(join(dir, "~advent.chrd"), ADVENT, "utf8");

    const report = await runImport({ dir, org: "Test Church", dryRun: true, report: false }, { log });
    expect(report.collisions).toHaveLength(1);
    expect(report.collisions[0]).toMatchObject({ relativePath: "amazing_grace.chrd", existingTitle: "AMAZING grace" });
    expect(report.duplicateTitles).toHaveLength(1);
    expect(report.duplicateTitles[0].title).toBe(normalizeTitle("Advent Song"));
    expect([...report.duplicateTitles[0].files].sort()).toEqual(["seasonal/advent.chrd", "~advent.chrd"]);
  });

  it("refuses a creator without a membership and an unknown organization", async () => {
    await expect(runImport({ dir, org: "Test Church", createdBy: "outsider@test.church", dryRun: true, report: false }, { log })).rejects.toThrow(
      /no membership/,
    );
    await expect(runImport({ dir, org: "Nope", dryRun: true, report: false }, { log })).rejects.toThrow(/Test Church/);
  });
});
