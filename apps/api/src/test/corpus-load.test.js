/**
 * corpus:load and corpus:export against the pg-mem harness.
 *
 * These are the only two things in the corpus pipeline that write to a
 * database, so they are tested hardest — including the failure modes that
 * would lose someone's work.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { createPgMemDb } from "./helpers/pgMemDb.js";

const memDb = createPgMemDb();
vi.mock("../db.js", () => memDb);

const { runCorpusLoad, planCorpusLoad, readCorpusRows, fingerprint, FIELD_SETS } =
  await import("../corpus/loadCorpus.js");
const { runCorpusExport, classifyExport } = await import("../corpus/exportCorpus.js");
const { sha256 } = await import("../corpus/identity.js");
const { organizations, organizationMembers, users, songs } = await import("../schema/index.js");

const db = memDb.db;
const ORG = "11111111-1111-5111-8111-111111111111";
const USER = "22222222-2222-5222-8222-222222222222";
const ID_A = "aaaaaaaa-0000-5000-8000-000000000001";
const ID_B = "bbbbbbbb-0000-5000-8000-000000000002";
const ID_SUP = "cccccccc-0000-5000-8000-000000000003";

const CHART_A = "{title: God is Great}\n{key: F}\n\n{comment: Chorus}\n[F]God is [Bb]great\n";
const CHART_B = "{title: Amazing Grace}\n{key: G}\n\n{comment: Verse 1}\n[G]Amazing grace\n";

let corpusRoot;

/** Write a corpus on disk: one manifest, one file per song. */
async function makeCorpus(entries, { sourceType = "chrd" } = {}) {
  const root = await mkdtemp(join(tmpdir(), "vpc-load-"));
  await mkdir(join(root, "manifest"), { recursive: true });
  await mkdir(join(root, "songs", sourceType), { recursive: true });
  const manifest = { sourceType, songs: [] };
  for (const e of entries) {
    const file = `songs/${sourceType}/${e.slug}.chopro`;
    await writeFile(join(root, file), e.content, "utf8");
    manifest.songs.push({
      songId: e.songId,
      title: e.title,
      file,
      contentSha256: e.hash ?? sha256(e.content),
      metadata: { key: e.key ?? null, artist: e.artist ?? null, year: null, tempo: e.tempo ?? null, isDraft: Boolean(e.isDraft) },
      sourceType,
      sources: [{ role: "primary", path: `${e.slug}.chrd`, sha256: "x" }],
      themes: e.themes ?? [],
      confidence: { score: 1, band: "high", reasons: [] },
      warnings: [],
      decision: e.decision ?? "song",
      ...(e.supersededBy ? { supersededBy: e.supersededBy } : {}),
    });
  }
  await writeFile(join(root, "manifest", `${sourceType}.json`), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return root;
}

beforeEach(async () => {
  await db.delete(songs);
  await db.delete(organizationMembers);
  await db.delete(users).catch(() => {});
  await db.delete(organizations).catch(() => {});
  await db.insert(organizations).values({ id: ORG, name: "VPC Band" });
  await db.insert(users).values({ id: USER, email: "lead@vpc.church", displayName: "Lead" });
  await db.insert(organizationMembers).values({ organizationId: ORG, userId: USER, role: "admin" });

  corpusRoot = await makeCorpus([
    { songId: ID_A, slug: "god-is-great--aaaaaaaa", title: "God is Great", key: "F", content: CHART_A, themes: ["praise"] },
    { songId: ID_B, slug: "amazing-grace--bbbbbbbb", title: "Amazing Grace", key: "G", content: CHART_B, themes: ["grace-mercy", "salvation"] },
    { songId: ID_SUP, slug: "dupe--cccccccc", title: "God is Great", content: CHART_A, decision: "supersede", supersededBy: ID_A },
  ]);
});

describe("readCorpusRows", () => {
  it("skips superseded copies rather than writing them", async () => {
    const { rows, skipped } = await readCorpusRows(corpusRoot);
    expect(rows.map((r) => r.id).sort()).toEqual([ID_A, ID_B].sort());
    expect(skipped).toHaveLength(1);
    expect(skipped[0].songId).toBe(ID_SUP);
  });

  it("HARD ERRORS on a file edited by hand", async () => {
    // The failure mode that would turn the corpus back into the file library.
    await writeFile(join(corpusRoot, "songs/chrd/god-is-great--aaaaaaaa.chopro"), "{title: Tampered}\n", "utf8");
    await expect(readCorpusRows(corpusRoot)).rejects.toThrow(/edited by hand/i);
  });

  it("reports a manifest entry whose file has gone, without throwing", async () => {
    await rm(join(corpusRoot, "songs/chrd/amazing-grace--bbbbbbbb.chopro"));
    const { rows, missing } = await readCorpusRows(corpusRoot);
    expect(missing).toHaveLength(1);
    expect(rows.map((r) => r.id)).toEqual([ID_A]);
  });

  it("does not hide a finished lyrics sheet as a draft", async () => {
    // 194 songs are complete lyrics with no chords. The converter marks them
    // drafts because they need chords, but that reason is now carried by
    // status = "missing_chords", which the app labels "Lyrics only". Leaving
    // them drafts as well hid a fifth of the library for no reason.
    const lyricsOnly = "{title: Words Only}\n\n{comment: Verse 1}\nAmazing grace how sweet the sound\n";
    const root = await makeCorpus([
      { songId: ID_A, slug: "words--aaaaaaaa", title: "Words Only", content: lyricsOnly, isDraft: true },
    ]);
    const { rows } = await readCorpusRows(root);
    expect(rows[0].status).toBe("missing_chords");
    expect(rows[0].isDraft).toBe(false);
  });

  it("lists a tilde church song", async () => {
    // flag:unlisted is the old site's tilde, which hid a song. Kevin decided
    // the church songs behind it should be listed; only secular ones stay out.
    const chart = "{title: Anything Can Happen}\n{x_flag: unlisted}\n\n{comment: Verse 1}\n[Gb]With lifted hands\n";
    const root = await makeCorpus([
      { songId: ID_A, slug: "anything--aaaaaaaa", title: "Anything Can Happen", content: chart, isDraft: true },
    ]);
    const { rows } = await readCorpusRows(root);
    expect(rows[0].isDraft).toBe(false);
  });

  it("keeps a secular song hidden, even when it is a lyrics sheet", async () => {
    // The `~z_` songs: Disney, video-game music. Secular outranks every rule
    // that would otherwise list a song.
    const lyricsOnly = "{title: Colors of the Wind}\n{x_flag: unlisted, secular}\n\n{comment: Verse 1}\nYou think you own whatever land you land on\n";
    const root = await makeCorpus([
      { songId: ID_A, slug: "colors--aaaaaaaa", title: "Colors of the Wind", content: lyricsOnly, isDraft: true },
    ]);
    const { rows } = await readCorpusRows(root);
    expect(rows[0].status).toBe("missing_chords");
    expect(rows[0].isDraft).toBe(true);
  });

  it("keeps a secular chart hidden even if the converter did not mark it a draft", async () => {
    const chart = "{title: Dearly Beloved}\n{x_flag: secular}\n\n{comment: Verse 1}\n[C]Dearly beloved\n";
    const root = await makeCorpus([
      { songId: ID_A, slug: "dearly--aaaaaaaa", title: "Dearly Beloved", content: chart, isDraft: false },
    ]);
    const { rows } = await readCorpusRows(root);
    expect(rows[0].isDraft).toBe(true);
  });

  it("leaves a chorded draft a draft", async () => {
    // The change is about lyrics sheets only. A chart with chords that the
    // corpus has not verified keeps whatever draft state it came with.
    const root = await makeCorpus([
      { songId: ID_A, slug: "chart--aaaaaaaa", title: "God is Great", content: CHART_A, isDraft: true },
    ]);
    const { rows } = await readCorpusRows(root);
    expect(rows[0].status).toBe(null);
    expect(rows[0].isDraft).toBe(true);
  });

  it("turns themes into namespaced tags", async () => {
    const { rows } = await readCorpusRows(corpusRoot);
    expect(rows.find((r) => r.id === ID_B).tags).toBe("theme:grace-mercy, theme:salvation");
  });

  it("takes the metadata from the FILE, not from the manifest's copy of it", async () => {
    // 92 songs carry a tempo worked out from a media filename after conversion.
    // It is in the chart file and not in the manifest, so reading the manifest
    // here meant those tempos existed in the corpus and never reached the app.
    const root = await makeCorpus([
      {
        songId: ID_A,
        slug: "derived",
        title: "Holy Ghost",
        tempo: null,
        content: [
          "{title: Holy Ghost}",
          "{artist: IBC}",
          "{tempo: 150}",
          "{x_tempo_source: derived from media filename}",
          "{x_theme: revival, praise}",
          "",
          "[G]Holy",
          "",
        ].join("\n"),
      },
    ]);
    const { rows } = await readCorpusRows(root);
    // A NUMBER, not the directive's "150": songs.tempo is an integer column and
    // the fingerprint is JSON, so a string would rewrite every tempo each run.
    expect(rows[0].tempo).toBe(150);
    expect(rows[0].artist).toBe("IBC");
    // Sorted, because the loader writes the tag field through the same grammar
    // the theme pass uses — two songs with the same themes get the same string.
    expect(rows[0].tags).toBe("theme:praise, theme:revival");
    await rm(root, { recursive: true, force: true });
  });

  it("carries a flag through as a namespaced tag, beside the themes", async () => {
    const root = await makeCorpus([
      {
        songId: ID_A,
        slug: "unlisted",
        title: "Holy Ghost",
        content: [
          "{title: Holy Ghost}",
          "{x_flag: secular, unlisted}",
          "{x_theme: revival}",
          "",
          "[G]Holy",
          "",
        ].join("\n"),
      },
    ]);
    const { rows } = await readCorpusRows(root);
    expect(rows[0].tags).toBe("flag:secular, flag:unlisted, theme:revival");
    await rm(root, { recursive: true, force: true });
  });

  it("falls back to the manifest when the file's header does not carry the field", async () => {
    const root = await makeCorpus([
      { songId: ID_A, slug: "plain", title: "God is Great", key: "F", artist: "VPC", content: CHART_A },
    ]);
    const { rows } = await readCorpusRows(root);
    expect(rows[0].artist).toBe("VPC"); // CHART_A has no {artist:} directive
    expect(rows[0].key).toBe("F");
    await rm(root, { recursive: true, force: true });
  });
});

describe("archiving superseded duplicates", () => {
  it("leaves a superseded row alone unless asked", async () => {
    // A supersede decision made AFTER a load leaves the loser sitting in the
    // library as a duplicate: skipped by the loader, so never updated and
    // never removed. Silence is the safe default; retiring it is opt-in.
    await db.insert(songs).values([
      { id: ID_A, title: "God is Great", content: CHART_A, organizationId: ORG, createdBy: USER },
      { id: ID_SUP, title: "God is Great", content: CHART_A, organizationId: ORG, createdBy: USER },
    ]);
    await runCorpusLoad({ corpusRoot, org: ORG, dryRun: false }, { database: db });
    const [dupe] = await db.select().from(songs).where(eq(songs.id, ID_SUP));
    expect(dupe.isArchived).toBeFalsy();
  });

  it("retires one on request, reversibly — archived, never deleted", async () => {
    await db.insert(songs).values([
      { id: ID_A, title: "God is Great", content: CHART_A, organizationId: ORG, createdBy: USER },
      { id: ID_SUP, title: "God is Great", content: CHART_A, organizationId: ORG, createdBy: USER },
    ]);
    const report = await runCorpusLoad(
      { corpusRoot, org: ORG, dryRun: false, archiveSuperseded: true },
      { database: db },
    );
    expect(report.archived.map((a) => a.id)).toEqual([ID_SUP]);
    const [dupe] = await db.select().from(songs).where(eq(songs.id, ID_SUP));
    expect(dupe.isArchived).toBe(true);
    expect(dupe.archivedAt).toBeTruthy();
    // The row is still there. `POST /songs/:id/unarchive` puts it back.
    expect(dupe.content).toBe(CHART_A);
    const [winner] = await db.select().from(songs).where(eq(songs.id, ID_A));
    expect(winner.isArchived).toBeFalsy();
  });

  it("says nothing about archiving when there is nothing to archive", async () => {
    const report = await runCorpusLoad(
      { corpusRoot, org: ORG, dryRun: true, archiveSuperseded: true },
      { database: db },
    );
    expect(report.archived).toEqual([]);
  });
});

describe("field masks", () => {
  it("core is the chart and what is read off it, never the tags", () => {
    expect(FIELD_SETS.core).toEqual(["title", "key", "artist", "year", "tempo", "content", "isDraft", "status"]);
    expect(FIELD_SETS.core).not.toContain("tags");
  });

  it("a fingerprint only covers the fields the run owns", () => {
    const a = { title: "X", tags: "theme:blood", content: "c", key: null, artist: null, year: null, tempo: null, isDraft: false };
    const b = { ...a, tags: "theme:cross" };
    expect(fingerprint(a, FIELD_SETS.core)).toBe(fingerprint(b, FIELD_SETS.core));
    expect(fingerprint(a, FIELD_SETS.tags)).not.toBe(fingerprint(b, FIELD_SETS.tags));
  });
});

describe("runCorpusLoad", () => {
  const opts = (over = {}) => ({ corpusRoot, org: "VPC Band", dryRun: true, ...over });

  it("writes nothing on a dry run", async () => {
    const report = await runCorpusLoad(opts(), { database: db, log: () => {} });
    expect(report.counts.inserts).toBe(2);
    expect(await db.select().from(songs)).toHaveLength(0);
  });

  it("inserts the live songs and leaves the superseded one out", async () => {
    await runCorpusLoad(opts({ dryRun: false }), { database: db, log: () => {} });
    const rows = await db.select().from(songs);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id).sort()).toEqual([ID_A, ID_B].sort());
    expect(rows.every((r) => r.organizationId === ORG)).toBe(true);
    expect(rows.every((r) => r.createdBy === USER)).toBe(true);
    expect(rows.every((r) => r.tier === "organization")).toBe(true);
  });

  it("is idempotent — a second run changes nothing", async () => {
    await runCorpusLoad(opts({ dryRun: false }), { database: db, log: () => {} });
    const again = await runCorpusLoad(opts({ dryRun: false }), { database: db, log: () => {} });
    expect(again.counts.inserts).toBe(0);
    expect(again.counts.updates).toBe(0);
    expect(again.counts.unchanged).toBe(2);
    expect(await db.select().from(songs)).toHaveLength(2);
  });

  it("updates a song whose chart changed, keeping its id", async () => {
    await runCorpusLoad(opts({ dryRun: false }), { database: db, log: () => {} });
    const changed = CHART_A.replace("God is [Bb]great", "God is [C]great");
    corpusRoot = await makeCorpus([
      { songId: ID_A, slug: "god-is-great--aaaaaaaa", title: "God is Great", key: "F", content: changed },
    ]);
    const report = await runCorpusLoad(opts({ corpusRoot, dryRun: false }), { database: db, log: () => {} });
    expect(report.counts.updates).toBe(1);
    const [row] = await db.select().from(songs).where(eqId(ID_A));
    expect(row.content).toContain("[C]great");
    expect(row.id).toBe(ID_A);
  });

  it("keeps the status in step with a chart that gains chords", async () => {
    // "Send Me" kept its "Lyrics only" label after its chords arrived, because
    // a chart load rewrote the content and left the status behind.
    const lyrics = "{title: God is Great}\n\n{comment: Chorus}\nGod is great\n";
    corpusRoot = await makeCorpus([{ songId: ID_A, slug: "god-is-great--aaaaaaaa", title: "God is Great", content: lyrics }]);
    await runCorpusLoad(opts({ corpusRoot, dryRun: false }), { database: db, log: () => {} });
    expect((await db.select().from(songs).where(eqId(ID_A)))[0].status).toBe("missing_chords");

    corpusRoot = await makeCorpus([{ songId: ID_A, slug: "god-is-great--aaaaaaaa", title: "God is Great", content: CHART_A }]);
    await runCorpusLoad(opts({ corpusRoot, dryRun: false, fields: "core" }), { database: db, log: () => {} });
    expect((await db.select().from(songs).where(eqId(ID_A)))[0].status).toBeNull();
  });

  it("--fields tags writes tags and does NOT disturb the core fields", async () => {
    // The property that lets an enrichment run coexist with the importer.
    await runCorpusLoad(opts({ dryRun: false, fields: "core" }), { database: db, log: () => {} });
    await db.update(songs).set({ title: "Renamed By A Human" }).where(eqId(ID_A));

    await runCorpusLoad(opts({ dryRun: false, fields: "tags" }), { database: db, log: () => {} });
    const [row] = await db.select().from(songs).where(eqId(ID_A));
    expect(row.tags).toBe("theme:praise");
    expect(row.title).toBe("Renamed By A Human");
  });

  it("leaves rows the corpus does not know about alone, and reports them", async () => {
    await db.insert(songs).values({
      id: "dddddddd-0000-5000-8000-000000000004",
      title: "Written In The App", content: "{title: Written In The App}\n",
      tier: "organization", organizationId: ORG, createdBy: USER,
    });
    const report = await runCorpusLoad(opts({ dryRun: false }), { database: db, log: () => {} });
    expect(report.foreign).toHaveLength(1);
    expect(report.foreign[0].title).toBe("Written In The App");
    expect(await db.select().from(songs)).toHaveLength(3);
  });

  it("refuses an unknown organization, listing what exists", async () => {
    await expect(runCorpusLoad(opts({ org: "Nope" }), { database: db, log: () => {} })).rejects.toThrow(/VPC Band/);
  });

  it("refuses an unknown field set", async () => {
    await expect(runCorpusLoad(opts({ fields: "everything" }), { database: db, log: () => {} })).rejects.toThrow(/--fields/);
  });
});

describe("runCorpusExport", () => {
  const opts = (over = {}) => ({ corpusRoot, org: "VPC Band", dryRun: true, ...over });

  beforeEach(async () => {
    await runCorpusLoad({ corpusRoot, org: "VPC Band", dryRun: false }, { database: db, log: () => {} });
  });

  it("reports nothing to do when the app has not changed anything", async () => {
    const report = await runCorpusExport(opts({ dryRun: false }), { database: db, log: () => {} });
    expect(report.counts.unchanged).toBe(2);
    expect(report.counts.update).toBe(0);
    expect(report.counts.conflict).toBe(0);
  });

  it("writes a chart back after someone edits it in the app", async () => {
    await db.update(songs).set({ content: "{title: God is Great}\n\n{comment: Chorus}\n[F]Edited in the app\n" }).where(eqId(ID_A));
    const report = await runCorpusExport(opts({ dryRun: false }), { database: db, log: () => {} });
    expect(report.counts.update).toBe(1);
    const file = await readFile(join(corpusRoot, "songs/chrd/god-is-great--aaaaaaaa.chopro"), "utf8");
    expect(file).toContain("Edited in the app");

    // and the manifest hash is refreshed, so the next load does not error
    const manifest = JSON.parse(await readFile(join(corpusRoot, "manifest", "chrd.json"), "utf8"));
    const entry = manifest.songs.find((s) => s.songId === ID_A);
    expect(entry.contentSha256).toBe(sha256(file));
    await expect(readCorpusRows(corpusRoot)).resolves.toBeTruthy();
  });

  it("files a song created in the app under its own manifest", async () => {
    await db.insert(songs).values({
      id: "eeeeeeee-0000-5000-8000-000000000005",
      title: "Brand New Song", content: "{title: Brand New Song}\n\n[G]new\n",
      tier: "organization", organizationId: ORG, createdBy: USER,
    });
    const report = await runCorpusExport(opts({ dryRun: false }), { database: db, log: () => {} });
    expect(report.counts.new).toBe(1);
    const manifest = JSON.parse(await readFile(join(corpusRoot, "manifest", "app.json"), "utf8"));
    expect(manifest.songs[0].title).toBe("Brand New Song");
    expect(manifest.sourceType).toBe("app");
  });

  it("REFUSES to overwrite when both sides changed", async () => {
    // The one case where guessing costs someone their work.
    await db.update(songs).set({ content: "{title: God is Great}\n\n[F]app version\n" }).where(eqId(ID_A));
    await writeFile(join(corpusRoot, "songs/chrd/god-is-great--aaaaaaaa.chopro"), "{title: God is Great}\n\n[F]file version\n", "utf8");

    const report = await runCorpusExport(opts({ dryRun: false }), { database: db, log: () => {} });
    expect(report.counts.conflict).toBe(1);
    expect(report.conflicts[0].id).toBe(ID_A);
    const file = await readFile(join(corpusRoot, "songs/chrd/god-is-great--aaaaaaaa.chopro"), "utf8");
    expect(file).toContain("file version");   // untouched
  });

  it("leaves a file that is ahead of the database alone", async () => {
    await writeFile(join(corpusRoot, "songs/chrd/god-is-great--aaaaaaaa.chopro"), "{title: God is Great}\n\n[F]newer on disk\n", "utf8");
    const report = await runCorpusExport(opts({ dryRun: false }), { database: db, log: () => {} });
    expect(report.counts["file-ahead"]).toBe(1);
    const file = await readFile(join(corpusRoot, "songs/chrd/god-is-great--aaaaaaaa.chopro"), "utf8");
    expect(file).toContain("newer on disk");
  });
});

describe("classifyExport", () => {
  const entry = { song: { contentSha256: sha256("{a}\n"), file: "f" } };

  it("names each of the four states", () => {
    expect(classifyExport({ row: { content: "{a}" }, entry, fileContent: "{a}\n" }).action).toBe("unchanged");
    expect(classifyExport({ row: { content: "{b}" }, entry, fileContent: "{a}\n" }).action).toBe("update");
    expect(classifyExport({ row: { content: "{a}" }, entry, fileContent: "{c}\n" }).action).toBe("file-ahead");
    expect(classifyExport({ row: { content: "{b}" }, entry, fileContent: "{c}\n" }).action).toBe("conflict");
    expect(classifyExport({ row: { content: "{x}" }, entry: null, fileContent: null }).action).toBe("new");
  });
});

/** drizzle eq on the songs id. */
function eqId(id) {
  return eq(songs.id, id);
}
