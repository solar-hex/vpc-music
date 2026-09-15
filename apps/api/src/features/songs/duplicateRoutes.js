/**
 * Duplicate review: find songs that are copies of one another, and let a
 * person merge them or say they are different songs.
 *
 *   GET  /songs/duplicates        pairs whose words mostly match, most alike first
 *   POST /songs/:id/merge         keep :id with the text given; archive the other
 *   POST /songs/:id/unmerge       bring a merged copy back
 *   POST /songs/:id/distinct      mark (or unmark) two songs as not copies
 *
 * Both decisions are written into the charts themselves, because the chart is
 * the complete record of a song: the archived copy carries
 * `{x_merged_into: <id>}` and a pair of different songs carry each other's id
 * in `{x_distinct:}`. `corpus:export` takes them back to the files from there,
 * and the corpus merge planner honours them.
 *
 * Nothing is deleted. A merged copy is archived, which the song list already
 * leaves out, and unmerge restores it.
 *
 * Mounted ahead of the main song routes, whose `/:id` would otherwise take
 * `/duplicates` for a song id.
 */
import { Router } from "express";
import { and, eq, isNull } from "drizzle-orm";
import {
  DISTINCT_DIRECTIVE,
  MERGED_INTO_DIRECTIVE,
  distinctIds,
  findDuplicatePairs,
  readDirective,
  writeDirective,
} from "@vpc-music/shared";
import { db } from "../../db.js";
import { songs } from "../../schema/index.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext, requireOrg, requirePermission } from "../../middlewares/orgContext.js";
import { asyncHandler, createError } from "../../middlewares/errorHandler.js";
import { logActivity } from "../activity/service.js";

export const songDuplicateRoutes = Router();

const editor = [auth, orgContext, requireOrg, requirePermission("songs:edit")];

/** A chart this size is already far past any real song; anything larger is a mistake. */
const MAX_CONTENT_LENGTH = 200_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function chordCount(content) {
  return (String(content ?? "").match(/\[[A-G][^\]]*\]/g) || []).length;
}

/** Where a song came from: the source type the corpus wrote into it, or the app. */
function sourceOf(content) {
  const source = readDirective(content, "x_source").trim();
  return source ? source.split(":")[0] : "app";
}

function summary(song) {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist ?? null,
    key: song.key ?? null,
    tempo: song.tempo ?? null,
    isDraft: Boolean(song.isDraft),
    status: song.status ?? null,
    source: sourceOf(song.content),
    chords: chordCount(song.content),
    updatedAt: song.updatedAt,
  };
}

/** A live song in the caller's organization, or a 404 that says nothing about other churches. */
async function loadOrgSong(id, orgId) {
  if (!UUID.test(String(id ?? ""))) throw createError(404, "Song not found");
  const [song] = await db
    .select()
    .from(songs)
    .where(and(eq(songs.id, id), eq(songs.organizationId, orgId), isNull(songs.deletedAt)))
    .limit(1);
  if (!song) throw createError(404, "Song not found");
  return song;
}

function sameInstant(a, b) {
  return new Date(a).toISOString() === new Date(b).toISOString();
}

songDuplicateRoutes.get(
  "/duplicates",
  ...editor,
  asyncHandler(async (req, res) => {
    const rows = await db
      .select({
        id: songs.id, title: songs.title, artist: songs.artist, key: songs.key, tempo: songs.tempo,
        isDraft: songs.isDraft, status: songs.status, content: songs.content, updatedAt: songs.updatedAt,
      })
      .from(songs)
      .where(and(eq(songs.organizationId, req.org.id), isNull(songs.deletedAt), eq(songs.isArchived, false)));

    const byId = new Map(rows.map((row) => [row.id, row]));
    const pairs = findDuplicatePairs(rows).map((pair) => {
      // The likelier keeper on the left: the chart with more chords, then a
      // listed song over a draft.
      let [left, right] = [byId.get(pair.a), byId.get(pair.b)];
      const rank = (song) => [chordCount(song.content), song.isDraft ? 0 : 1];
      const [lc, ll] = rank(left);
      const [rc, rl] = rank(right);
      if (rc > lc || (rc === lc && rl > ll)) [left, right] = [right, left];
      return {
        overlap: Math.round(pair.overlap * 100) / 100,
        shared: pair.shared,
        titlesAgree: pair.titlesAgree,
        left: summary(left),
        right: summary(right),
      };
    });

    res.set("Cache-Control", "private, no-store");
    res.json({ pairs });
  }),
);

songDuplicateRoutes.post(
  "/:id/merge",
  ...editor,
  asyncHandler(async (req, res) => {
    const { otherId, content, keptUpdatedAt, otherUpdatedAt } = req.body ?? {};
    if (typeof content !== "string" || !content.trim()) throw createError(400, "The merged chart is empty");
    if (content.length > MAX_CONTENT_LENGTH) throw createError(400, "The merged chart is too long");
    if (String(otherId) === String(req.params.id)) throw createError(400, "A song cannot be merged into itself");

    const kept = await loadOrgSong(req.params.id, req.org.id);
    const other = await loadOrgSong(otherId, req.org.id);
    if (kept.isArchived || other.isArchived) {
      throw createError(409, "One of these songs has already been merged or archived");
    }
    if ((keptUpdatedAt && !sameInstant(keptUpdatedAt, kept.updatedAt)) || (otherUpdatedAt && !sameInstant(otherUpdatedAt, other.updatedAt))) {
      return res.status(409).json({ error: { message: "One of these songs was changed since you opened it. Reload to see the latest." } });
    }

    // The song's own columns follow its chart, as a save in the editor does. A
    // line the chart does not have leaves the column as it was.
    const text = content.replace(/\r\n?/g, "\n");
    const fromChart = (name) => {
      const value = readDirective(text, name).trim();
      return value || undefined;
    };
    const tempo = fromChart("tempo");
    const fields = {
      ...(fromChart("title") && { title: fromChart("title") }),
      ...(fromChart("artist") && { artist: fromChart("artist") }),
      ...(fromChart("key") && { key: fromChart("key") }),
      ...(fromChart("year") && { year: fromChart("year") }),
      ...(fromChart("x_aka") && { aka: fromChart("x_aka") }),
      ...(tempo && Number.isFinite(parseInt(tempo, 10)) && { tempo: parseInt(tempo, 10) }),
    };

    const now = new Date();
    const result = await db.transaction(async (tx) => {
      const [song] = await tx
        .update(songs)
        .set({ ...fields, content: text, updatedAt: now })
        .where(eq(songs.id, kept.id))
        .returning();
      await tx
        .update(songs)
        .set({
          content: writeDirective(other.content, MERGED_INTO_DIRECTIVE, kept.id),
          isArchived: true,
          archivedAt: now,
          updatedAt: now,
        })
        .where(eq(songs.id, other.id));
      return song;
    });

    await logActivity(req, "song.merged", { type: "song", id: kept.id, label: `${result.title} ← ${other.title}` });
    res.json({ song: result, merged: { id: other.id, title: other.title } });
  }),
);

songDuplicateRoutes.post(
  "/:id/unmerge",
  ...editor,
  asyncHandler(async (req, res) => {
    const song = await loadOrgSong(req.params.id, req.org.id);
    if (!song.isArchived || !readDirective(song.content, MERGED_INTO_DIRECTIVE).trim()) {
      throw createError(400, "This song was not merged into another");
    }
    const [restored] = await db
      .update(songs)
      .set({
        content: writeDirective(song.content, MERGED_INTO_DIRECTIVE, ""),
        isArchived: false,
        archivedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(songs.id, song.id))
      .returning();
    await logActivity(req, "song.unmerged", { type: "song", id: song.id, label: song.title });
    res.json({ song: restored });
  }),
);

songDuplicateRoutes.post(
  "/:id/distinct",
  ...editor,
  asyncHandler(async (req, res) => {
    const { otherId, distinct = true } = req.body ?? {};
    if (String(otherId) === String(req.params.id)) throw createError(400, "Pick two different songs");
    const first = await loadOrgSong(req.params.id, req.org.id);
    const second = await loadOrgSong(otherId, req.org.id);

    const mark = (song, id) => {
      const ids = new Set(distinctIds(song.content));
      if (distinct) ids.add(id);
      else ids.delete(id);
      return writeDirective(song.content, DISTINCT_DIRECTIVE, [...ids].sort().join("; "));
    };
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(songs).set({ content: mark(first, second.id), updatedAt: now }).where(eq(songs.id, first.id));
      await tx.update(songs).set({ content: mark(second, first.id), updatedAt: now }).where(eq(songs.id, second.id));
    });
    await logActivity(req, distinct ? "song.marked_distinct" : "song.unmarked_distinct", { type: "song", id: first.id, label: `${first.title} ≠ ${second.title}` });
    res.json({ ok: true, distinct: Boolean(distinct) });
  }),
);
