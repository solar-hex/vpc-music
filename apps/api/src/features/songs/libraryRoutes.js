/**
 * GET /songs/contents — every chart a person can open, for keeping on the device.
 *
 * The song list deliberately leaves `content` out, because most screens never
 * render a chart and the whole library would double its payload. Offline mode
 * needs the opposite: every chart, in one request, so a phone at a church with
 * no signal can open a song nobody opened at home.
 *
 *   ?since=<ISO time>   only songs changed since then (the next sync)
 *
 * `ids` always lists every song still visible, so a device can drop the charts
 * that were deleted, archived or merged away since it last synced.
 *
 * Visibility matches the song list: the organization's songs and the global
 * library, minus other people's personal songs, minus trash and archive. Any
 * member may sync, observers included: reading a chart is what they do.
 *
 * Mounted ahead of the main song routes, whose `/:id` would otherwise take
 * `/contents` for a song id.
 */
import { Router } from "express";
import { and, eq, gte, inArray, isNull, ne, or } from "drizzle-orm";
import { db } from "../../db.js";
import { songs, songVariations } from "../../schema/index.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext, requireOrg } from "../../middlewares/orgContext.js";
import { asyncHandler, createError } from "../../middlewares/errorHandler.js";

export const songLibraryRoutes = Router();

songLibraryRoutes.get(
  "/contents",
  auth,
  orgContext,
  requireOrg,
  asyncHandler(async (req, res) => {
    let since = null;
    if (req.query.since !== undefined) {
      since = new Date(String(req.query.since));
      if (Number.isNaN(since.getTime())) throw createError(400, "since must be a date");
    }
    const fetchedAt = new Date();

    const visible = and(
      or(
        eq(songs.tier, "global"),
        and(eq(songs.organizationId, req.org.id), or(ne(songs.tier, "personal"), eq(songs.createdBy, req.user.id))),
      ),
      isNull(songs.deletedAt),
      eq(songs.isArchived, false),
    );

    const ids = (await db.select({ id: songs.id }).from(songs).where(visible)).map((row) => row.id);
    const rows = await db
      .select({
        id: songs.id,
        title: songs.title,
        aka: songs.aka,
        artist: songs.artist,
        key: songs.key,
        tempo: songs.tempo,
        year: songs.year,
        tags: songs.tags,
        isDraft: songs.isDraft,
        status: songs.status,
        content: songs.content,
        defaultVariationId: songs.defaultVariationId,
        updatedAt: songs.updatedAt,
      })
      .from(songs)
      .where(since ? and(visible, gte(songs.updatedAt, since)) : visible);

    // A curated default variation is the chart the song page shows, so the
    // device keeps that one too.
    const variationIds = rows.map((row) => row.defaultVariationId).filter(Boolean);
    const variations = variationIds.length
      ? await db
          .select({ id: songVariations.id, songId: songVariations.songId, name: songVariations.name, key: songVariations.key, content: songVariations.content })
          .from(songVariations)
          .where(inArray(songVariations.id, variationIds))
      : [];
    const variationById = new Map(variations.map((variation) => [variation.id, variation]));

    res.set("Cache-Control", "private, no-store");
    res.json({
      fetchedAt: fetchedAt.toISOString(),
      ids,
      songs: rows.map((row) => ({
        song: row,
        variations: row.defaultVariationId && variationById.has(row.defaultVariationId) ? [variationById.get(row.defaultVariationId)] : [],
      })),
    });
  }),
);
