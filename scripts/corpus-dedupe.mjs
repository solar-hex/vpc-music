/**
 * corpus:dedupe — decide which copy of a song wins, and record it.
 *
 * The same song arrives from several sources: a `.chrd` chart VPC typed, a
 * lyrics-only Word document of the same song, a UPCI chart, sometimes the same
 * UPCI chart filed under two years. 215 title groups are affected.
 *
 * Nothing is ever deleted. The loser is marked `supersede` with a pointer to
 * the winner, so the decision is visible in the manifest, reviewable in a diff,
 * and reversible by editing one field.
 *
 * It only decides on its own when the call is genuinely unambiguous — an
 * identical copy, or a chart with chords against the same song with none.
 * Everything else is left `review`, because choosing between two real charts is
 * a musician's judgement, not a script's.
 *
 *   pnpm corpus:dedupe [--apply]
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { titleKey } from "../apps/api/src/corpus/titleMatch.js";
import { hasChords } from "../shared/utils/library.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, "..");

/**
 * Which source to trust when two copies are otherwise equal.
 * Columns typed by a person beat columns inferred from geometry; a chart of
 * any kind beats a lyrics-only sheet.
 */
export const SOURCE_RANK = { text: 5, chrd: 4, onsong: 3, pdf: 2, docx: 1 };

/**
 * Rank the copies of one song, best first.
 * More chords wins; then the more trusted source; then the fuller chart; then
 * the id, so the result never depends on directory order.
 */
export function rankCopies(copies) {
  return [...copies].sort(
    (a, b) =>
      b.chords - a.chords ||
      (SOURCE_RANK[b.source] ?? 0) - (SOURCE_RANK[a.source] ?? 0) ||
      b.lines - a.lines ||
      a.songId.localeCompare(b.songId),
  );
}

/**
 * Decide a group.
 * @returns {{ winner, losers: Array<{song, reason}>, auto: boolean, why: string }}
 */
export function decideGroup(copies) {
  const ranked = rankCopies(copies);
  const [winner, ...rest] = ranked;

  // Byte-identical copies: keeping one is not a judgement call.
  const identical = rest.filter((s) => s.musicalSha256 === winner.musicalSha256);
  const different = rest.filter((s) => s.musicalSha256 !== winner.musicalSha256);

  if (different.length === 0) {
    return {
      winner,
      losers: identical.map((s) => ({ song: s, reason: "identical copy" })),
      auto: true,
      why: "identical",
    };
  }

  // A chart with chords against the same song with none is not a judgement
  // call either — a lyrics sheet must never shadow a real chart.
  if (winner.chords > 0 && different.every((s) => s.chords === 0)) {
    return {
      winner,
      losers: [
        ...identical.map((s) => ({ song: s, reason: "identical copy" })),
        ...different.map((s) => ({ song: s, reason: `lyrics only, superseded by the ${winner.source} chart` })),
      ],
      auto: true,
      why: "chords beat lyrics-only",
    };
  }

  // Two real charts. A person decides.
  return { winner, losers: [], auto: false, why: "two or more charts with chords" };
}

export async function loadManifests(corpusRoot) {
  const dir = join(corpusRoot, "manifest");
  const manifests = [];
  for (const file of (await readdir(dir)).sort()) {
    if (!file.endsWith(".json")) continue;
    manifests.push({ file: join(dir, file), data: JSON.parse(await readFile(join(dir, file), "utf8")) });
  }
  return manifests;
}

/**
 * Hash of the music alone.
 *
 * `contentSha256` covers the whole file, which now includes provenance — the
 * source path, the Dropbox link, the media URLs. Two byte-identical charts
 * that came from `song.chrd` and `~song.chrd` therefore hash differently, and
 * would be sent for review as if they were different arrangements. Compare
 * what a musician would call the same song instead.
 */
export function musicalHash(content) {
  const body = String(content)
    .split("\n")
    .filter((line) => !/^\{x_[a-z0-9_]+\s*:/i.test(line.trim()))
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256").update(body).digest("hex");
}

export function buildGroups(manifests, readContent) {
  const songs = [];
  for (const m of manifests) {
    for (const s of m.data.songs) {
      const content = readContent(s.file);
      songs.push({
        ...s,
        source: m.data.sourceType,
        chords: (content.match(/\[[A-G][^\]]*\]/g) || []).length,
        hasChords: hasChords(content),
        musicalSha256: musicalHash(content),
        cues: (content.match(/\[\*[^\]]*\]/g) || []).length,
        key: s.metadata?.key ?? null,
        lines: content.split("\n").filter((l) => l.trim() && !l.startsWith("{")).length,
      });
    }
  }
  const groups = new Map();
  for (const s of songs) {
    const k = titleKey(s.title);
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }
  return { songs, groups: [...groups.entries()].filter(([, v]) => v.length > 1) };
}

async function runCli() {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const corpusRoot = resolve(process.cwd(), join(repoRoot, "corpus"));
  if (!existsSync(corpusRoot)) throw new Error(`No corpus at ${corpusRoot}`);

  const manifests = await loadManifests(corpusRoot);
  const cache = new Map();
  const readContent = (file) => {
    if (!cache.has(file)) cache.set(file, readFileSync(join(corpusRoot, file), "utf8"));
    return cache.get(file);
  };

  const { songs, groups } = buildGroups(manifests, readContent);
  const decisions = new Map();
  let autoGroups = 0;
  let reviewGroups = 0;
  const reviewList = [];

  for (const [key, copies] of groups) {
    const result = decideGroup(copies);
    if (!result.auto) {
      reviewGroups += 1;
      reviewList.push({ key, copies: rankCopies(copies) });
      continue;
    }
    autoGroups += 1;
    for (const loser of result.losers) {
      decisions.set(loser.song.songId, { supersededBy: result.winner.songId, reason: loser.reason });
    }
  }

  console.log(`songs ${songs.length} | duplicate title groups ${groups.length}`);
  console.log(`  decided automatically : ${autoGroups} groups, ${decisions.size} songs superseded`);
  console.log(`  left for review       : ${reviewGroups} groups`);
  console.log("");
  console.log("Automatic decisions are only made when the call is unambiguous:");
  console.log("an identical copy, or a chart with chords against the same song with none.");

  if (reviewList.length > 0) {
    console.log(`\nNeeds a person (${reviewList.length}) — two or more real charts:`);
    for (const r of reviewList.slice(0, 20)) {
      console.log(`  "${r.key}"`);
      for (const c of r.copies) {
        // Show what actually differs, so the reason for review is visible.
        const bits = [
          `chords ${String(c.chords).padStart(3)}`,
          `key ${String(c.key ?? "—").padEnd(3)}`,
          `lines ${String(c.lines).padStart(3)}`,
          c.cues ? `cues ${String(c.cues).padStart(3)}` : "        ",
        ];
        console.log(`      ${c.source.padEnd(7)} ${bits.join("  ")}  ${c.title}`);
      }
    }
    if (reviewList.length > 20) console.log(`  … and ${reviewList.length - 20} more`);
  }

  if (!apply) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply.");
    return;
  }

  let written = 0;
  for (const m of manifests) {
    let touched = false;
    for (const song of m.data.songs) {
      const decision = decisions.get(song.songId);
      if (decision) {
        if (song.decision !== "supersede" || song.supersededBy !== decision.supersededBy) touched = true;
        song.decision = "supersede";
        song.supersededBy = decision.supersededBy;
        song.supersedeReason = decision.reason;
      } else if (song.decision === "supersede") {
        // A copy that used to lose and now does not — never leave a stale flag.
        delete song.supersededBy;
        delete song.supersedeReason;
        song.decision = "song";
        touched = true;
      }
    }
    if (touched) {
      await writeFile(m.file, `${JSON.stringify(m.data, null, 2)}\n`, "utf8");
      written += 1;
    }
  }
  console.log(`\nWrote ${written} manifest(s). ${decisions.size} songs marked supersede; none deleted.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
