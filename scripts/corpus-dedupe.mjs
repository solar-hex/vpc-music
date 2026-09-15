/**
 * corpus:dedupe — merge the copies of one song into the best of them.
 *
 * The same song arrives from several sources: the chart VPC typed on the old
 * site, a Word document of the lyrics, the publisher's PDF, the publisher's
 * text file of that same PDF, sometimes the same PDF filed under two years.
 * Kevin's rule for these: keep the best chart and pull the best of both — the
 * chart from one copy, the artist, tempo and album from the other — and never
 * merge two different songs because they share a title.
 *
 * A shared title proves nothing ("Thank You" is two songs by two writers), so
 * copies are judged by their words. Two copies that share most of their lyrics
 * are one song. Copies that share some of them, or two publisher charts by two
 * different artists, go on a list for a person.
 *
 * Nothing is ever deleted. A loser is marked `supersede` in its manifest with a
 * pointer to the winner and the reason, and the details carried to the winner
 * are written to `corpus/merges.json`, which `corpus:build` reads. Decisions
 * already recorded are never undone by a re-run; only a person editing the
 * manifest does that.
 *
 *   pnpm corpus:dedupe [--apply]
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { titleKey } from "../apps/api/src/corpus/titleMatch.js";
import { parseHeader, splitHeader } from "../apps/api/src/corpus/enrich.js";
import { hasChords } from "../shared/utils/library.js";
import { SAME_SONG_OVERLAP, SIMILAR_TITLE_OVERLAP, distinctIds, lyricOverlap, lyricShingles } from "../shared/utils/lyrics.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, "..");

/**
 * Details a winner takes from its merged copies when it has none of its own.
 * Never the key: a chart's key is a fact about that chart, and the app
 * transposes anyway.
 */
export const CARRIED_DIRECTIVES = ["artist", "tempo", "time", "year", "x_album", "x_writers"];

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
 * `contentSha256` covers the whole file, which includes provenance — the
 * source path, the Dropbox link, the media URLs — so two byte-identical charts
 * from `song.chrd` and `~song.chrd` hash differently. Compare what a musician
 * would call the same chart instead.
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
      const header = parseHeader(splitHeader(content).header);
      songs.push({
        ...s,
        source: m.data.sourceType,
        header,
        chords: (content.match(/\[[A-G][^\]]*\]/g) || []).length,
        hasChords: hasChords(content),
        musicalSha256: musicalHash(content),
        cues: (content.match(/\[\*[^\]]*\]/g) || []).length,
        key: s.metadata?.key ?? null,
        lines: content.split("\n").filter((l) => l.trim() && !l.startsWith("{")).length,
        shingles: lyricShingles(content),
        // Songs a person marked as not copies of this one, in the app.
        distinct: new Set(distinctIds(content)),
        listed: !s.metadata?.isDraft,
        unlisted: /\bunlisted\b/.test(header.get("x_flag") || ""),
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

/**
 * How much two copies agree: identical music counts as all of it, and a pair
 * a person marked as two different songs counts as nothing.
 */
function overlapOf(a, b) {
  if (a.distinct?.has(b.songId) || b.distinct?.has(a.songId)) return 0;
  if (a.musicalSha256 === b.musicalSha256) return 1;
  return lyricOverlap(a.shingles, b.shingles);
}

/**
 * The copy that should stand for the song, first.
 *
 * A chart beats a lyrics sheet. Then the church's own chart, because that is
 * the arrangement the band plays. Then a copy the old site listed over one it
 * hid behind a `~`, a reviewed chart over a draft, and only then the fuller
 * chart. The id breaks ties so the answer never depends on directory order.
 */
export function rankForMerge(copies) {
  return [...copies].sort(
    (a, b) =>
      Number(b.chords > 0) - Number(a.chords > 0) ||
      Number(b.source === "chrd") - Number(a.source === "chrd") ||
      Number(a.unlisted) - Number(b.unlisted) ||
      Number(b.listed) - Number(a.listed) ||
      b.chords - a.chords ||
      (b.cues ?? 0) - (a.cues ?? 0) ||
      b.lines - a.lines ||
      a.songId.localeCompare(b.songId),
  );
}

/**
 * Split the live copies of one title into songs.
 *
 * @returns {{ clusters: Array<Array<object>>, partial: Array<{a, b, overlap}> }}
 *   `partial` pairs share some lyrics but not enough to call them one song.
 */
export function clusterCopies(copies) {
  const parent = copies.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const pairs = [];
  for (let i = 0; i < copies.length; i += 1) {
    for (let j = i + 1; j < copies.length; j += 1) {
      const overlap = overlapOf(copies[i], copies[j]);
      pairs.push({ i, j, overlap });
      if (overlap >= SAME_SONG_OVERLAP) parent[find(i)] = find(j);
    }
  }
  const byRoot = new Map();
  copies.forEach((copy, i) => {
    const root = find(i);
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root).push(copy);
  });
  const partial = pairs
    .filter((p) => find(p.i) !== find(p.j) && p.overlap >= SIMILAR_TITLE_OVERLAP)
    .map((p) => ({ a: copies[p.i], b: copies[p.j], overlap: p.overlap }));
  return { clusters: [...byRoot.values()], partial };
}

/**
 * Whether a script may merge a song's copies, and why.
 *
 * Two publisher charts credited to two different artists are two recordings,
 * and possibly two arrangements, even with the same words; a person picks.
 * A copy that only reaches the winner through a third copy is a person's call
 * too. Everything else is a copy of one chart.
 */
export function mergeKind(ranked) {
  const [winner, ...losers] = ranked;
  const artists = new Set(
    ranked
      .filter((c) => c.source === "pdf")
      .map((c) => String(c.header?.get("artist") || "").trim().toLowerCase())
      .filter(Boolean),
  );
  if (artists.size >= 2) return { auto: false, why: "two publisher charts by different artists" };
  const weakest = Math.min(...losers.map((c) => overlapOf(winner, c)));
  if (weakest < SAME_SONG_OVERLAP) return { auto: false, why: "copies that only partly match the best one" };

  const sources = new Set(ranked.map((c) => c.source));
  if (losers.every((c) => c.musicalSha256 === winner.musicalSha256)) return { auto: true, why: "identical copy" };
  if (sources.size === 1 && sources.has("chrd")) return { auto: true, why: "the old site's draft and final chart" };
  if (winner.source === "chrd") return { auto: true, why: "the church's own chart, with a converted copy" };
  if (losers.every((c) => c.chords === 0)) return { auto: true, why: "a lyrics-only copy" };
  if (sources.has("pdf") && sources.has("text")) return { auto: true, why: "the publisher's PDF and text of one chart" };
  if (sources.size === 1 && sources.has("pdf")) return { auto: true, why: "the same publisher chart filed twice" };
  return { auto: true, why: `the same song from ${[...sources].sort().join(" and ")}` };
}

/** Names a chart answers to, from its `{x_aka:}` (semicolon separated). */
function akaNames(header) {
  return String(header?.get("x_aka") || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * What the winner takes from the other copies: only what it lacks, from the
 * best-ranked copy that has it. A tempo worked out from a media filename stays
 * with the copy that worked it out; the build derives it again for the winner.
 */
export function carriedFields(winner, donors) {
  const carry = {};
  for (const name of CARRIED_DIRECTIVES) {
    if (String(winner.header?.get(name) || "").trim()) continue;
    for (const donor of donors) {
      const value = String(donor.header?.get(name) || "").trim();
      if (!value) continue;
      if (name === "tempo" && donor.header?.get("x_tempo_source")) continue;
      carry[name] = value;
      break;
    }
  }
  const have = new Set([winner.title, ...akaNames(winner.header)].map((n) => String(n).toLowerCase()));
  const aka = [];
  for (const donor of donors) {
    for (const name of akaNames(donor.header)) {
      if (have.has(name.toLowerCase())) continue;
      have.add(name.toLowerCase());
      aka.push(name);
    }
  }
  if (aka.length > 0) carry.aka = aka.sort((a, b) => a.localeCompare(b));
  return carry;
}

/** Where a recorded supersede chain ends. */
function finalWinner(songId, byId) {
  const seen = new Set();
  let id = songId;
  while (byId.get(id)?.decision === "supersede" && byId.get(id).supersededBy && !seen.has(id)) {
    seen.add(id);
    id = byId.get(id).supersededBy;
  }
  return id;
}

/**
 * Plan every merge in the corpus.
 *
 * @returns {{ merges: Array<{key, winner, losers, why, overlaps, carry}>,
 *             review: Array<{key, why, copies, overlap?}> }}
 */
export function planMerges(songs, groups) {
  const byId = new Map(songs.map((s) => [s.songId, s]));
  const merges = [];
  const review = [];

  for (const [key, copies] of groups) {
    const live = copies.filter((c) => c.decision !== "supersede");
    if (live.length < 2) continue;
    const { clusters, partial } = clusterCopies(live);

    for (const cluster of clusters) {
      if (cluster.length < 2) continue;
      const ranked = rankForMerge(cluster);
      const kind = mergeKind(ranked);
      if (!kind.auto) {
        review.push({ key, why: kind.why, copies: ranked });
        continue;
      }
      const [winner, ...losers] = ranked;
      const members = new Set(ranked.map((c) => c.songId));
      // Copies superseded before, into any member of this song, are copies of
      // it too, and may hold a detail the winner lacks.
      const earlier = copies.filter((c) => c.decision === "supersede" && members.has(finalWinner(c.songId, byId)));
      merges.push({
        key,
        winner,
        losers,
        earlier,
        why: kind.why,
        overlaps: losers.map((c) => overlapOf(winner, c)),
        carry: carriedFields(winner, [...losers, ...rankForMerge(earlier)]),
      });
    }
    for (const pair of partial) {
      review.push({ key, why: "copies that share some of their lyrics", copies: rankForMerge([pair.a, pair.b]), overlap: pair.overlap });
    }
  }
  return { merges, review };
}

/**
 * The manifests after a plan: losers marked, earlier chains pointed at the
 * song's new winner. Returns the manifests it changed. Never un-supersedes.
 */
export function applyMerges(manifests, merges) {
  const decisions = new Map();
  for (const merge of merges) {
    merge.losers.forEach((loser, i) => {
      const pct = Math.round(merge.overlaps[i] * 100);
      decisions.set(loser.songId, {
        supersededBy: merge.winner.songId,
        supersedeReason: `same song as the ${merge.winner.source} chart (${pct}% of the lyrics): ${merge.why}`,
      });
    });
    for (const copy of merge.earlier) {
      if (copy.supersededBy !== merge.winner.songId) decisions.set(copy.songId, { supersededBy: merge.winner.songId });
    }
  }
  const changed = [];
  for (const m of manifests) {
    let touched = false;
    for (const song of m.data.songs) {
      const decision = decisions.get(song.songId);
      if (!decision) continue;
      if (song.decision === "supersede" && !decision.supersedeReason) {
        if (song.supersededBy !== decision.supersededBy) {
          song.supersededBy = decision.supersededBy;
          touched = true;
        }
        continue;
      }
      song.decision = "supersede";
      song.supersededBy = decision.supersededBy;
      song.supersedeReason = decision.supersedeReason;
      touched = true;
    }
    if (touched) changed.push(m);
  }
  return changed;
}

/**
 * The committed merge ledger with this plan folded in. Earlier entries stay:
 * a merge is recorded once and a re-run only adds to it or refreshes what a
 * winner carries.
 */
export function mergeLedger(previous, merges) {
  const songs = { ...(previous?.songs || {}) };
  for (const merge of merges) {
    const before = songs[merge.winner.songId];
    const from = [...new Set([...(before?.from || []), ...merge.losers.map((c) => c.songId)])].sort();
    songs[merge.winner.songId] = {
      title: merge.winner.title,
      from,
      carry: { ...(before?.carry || {}), ...merge.carry },
    };
  }
  const sorted = Object.fromEntries(Object.keys(songs).sort().map((id) => [id, songs[id]]));
  return {
    version: 1,
    note: "Songs merged by corpus:dedupe. Each winner lists the copies it replaced and the details it took from them; corpus:build writes those into the winner's chart.",
    songs: sorted,
  };
}

/** Song id -> the details its chart carries from merged copies. */
export function carryBySong(ledger) {
  return new Map(Object.entries(ledger?.songs || {}).map(([id, entry]) => [id, entry.carry || {}]));
}

function describe(copy) {
  const artist = copy.header?.get("artist") || "no artist";
  const state = copy.unlisted ? "old site ~" : copy.listed ? "listed" : "draft";
  return `${copy.source} · ${artist} · ${copy.chords} chords · ${state}`;
}

async function runCli() {
  const apply = process.argv.slice(2).includes("--apply");
  const corpusRoot = join(repoRoot, "corpus");
  if (!existsSync(corpusRoot)) throw new Error(`No corpus at ${corpusRoot}`);

  const manifests = await loadManifests(corpusRoot);
  const cache = new Map();
  const readContent = (file) => {
    if (!cache.has(file)) cache.set(file, readFileSync(join(corpusRoot, file), "utf8"));
    return cache.get(file);
  };
  const { songs, groups } = buildGroups(manifests, readContent);
  const { merges, review } = planMerges(songs, groups);
  const losers = merges.reduce((n, m) => n + m.losers.length, 0);

  console.log(`songs ${songs.length} | same-title groups ${groups.length}`);
  console.log(`  merges: ${merges.length} songs, ${losers} copies superseded`);
  for (const m of merges) {
    const carry = Object.entries(m.carry).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("; ") : v}`).join(", ");
    console.log(`    ${m.winner.title} — ${m.why}`);
    console.log(`      keep   ${describe(m.winner)}`);
    m.losers.forEach((c, i) => console.log(`      merge  ${describe(c)}  (${Math.round(m.overlaps[i] * 100)}%)`));
    if (carry) console.log(`      carry  ${carry}`);
  }
  console.log(`\n  for a person: ${review.length}`);
  for (const r of review) {
    console.log(`    ${r.copies[0].title} — ${r.why}${r.overlap !== undefined ? ` (${Math.round(r.overlap * 100)}%)` : ""}`);
    for (const c of r.copies) console.log(`      ${describe(c)}`);
  }

  if (!apply) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply.");
    return;
  }
  const changed = applyMerges(manifests, merges);
  for (const m of changed) await writeFile(m.file, `${JSON.stringify(m.data, null, 2)}\n`, "utf8");
  const ledgerPath = join(corpusRoot, "merges.json");
  const previous = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, "utf8")) : null;
  await writeFile(ledgerPath, `${JSON.stringify(mergeLedger(previous, merges), null, 2)}\n`, "utf8");
  const rebuild = [...new Set(merges.filter((m) => Object.keys(m.carry).length > 0).map((m) => m.winner.source))].sort();
  console.log(`\nWrote ${changed.length} manifest(s) and corpus/merges.json. Nothing deleted.`);
  if (rebuild.length > 0) console.log(`Rebuild these sources so the winners carry what they took: ${rebuild.join(", ")}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
