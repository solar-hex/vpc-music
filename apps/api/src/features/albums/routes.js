/**
 * Album routes.
 *
 *   GET    /api/albums            — all albums in the org (artist name + track counts)
 *   GET    /api/albums/:id        — album detail with its songs
 *   POST   /api/albums            — create (artists:edit)
 *   PUT    /api/albums/:id        — update (artists:edit)
 *   DELETE /api/albums/:id        — delete; unlinks songs (artists:edit)
 */
import { Router } from "express";
import { eq, and, sql, asc } from "drizzle-orm";
import { db } from "../../db.js";
import { albums, artists, songs } from "../../schema/index.js";
import { createError, asyncHandler } from "../../middlewares/errorHandler.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext, requireOrg, requirePermission } from "../../middlewares/orgContext.js";
import { logActivity } from "../activity/service.js";

export const albumRoutes = Router();

albumRoutes.use(auth, orgContext, requireOrg);

// Must reference the outer table via an explicitly qualified "albums"."id" —
// interpolating ${albums.id} here renders as a bare "id", which the
// subquery's own `songs` table (which also has its own id column) resolves
// locally instead of correlating to the outer row. That's not an error (a
// single-table subquery has no ambiguity to complain about) — it silently
// filters `songs.album_id = songs.id`, which is essentially always false,
// so every album's track count would read 0.
const trackCountExpr = sql`(SELECT count(*) FROM songs WHERE songs.album_id = "albums"."id")::int`;

async function loadAlbumInOrg(id, orgId) {
  const [album] = await db
    .select()
    .from(albums)
    .where(and(eq(albums.id, id), eq(albums.organizationId, orgId)))
    .limit(1);
  return album ?? null;
}

// ── GET / — list albums ──────────────────────────────────────
albumRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const conditions = [eq(albums.organizationId, req.org.id)];
    if (typeof req.query.artistId === "string" && req.query.artistId.trim()) {
      conditions.push(eq(albums.artistId, req.query.artistId.trim()));
    }

    const result = await db
      .select({
        id: albums.id,
        title: albums.title,
        year: albums.year,
        coverUrl: albums.coverUrl,
        artistId: albums.artistId,
        artistName: artists.name,
        trackCount: trackCountExpr,
        createdAt: albums.createdAt,
      })
      .from(albums)
      .leftJoin(artists, eq(albums.artistId, artists.id))
      .where(and(...conditions))
      .orderBy(asc(albums.title));

    res.json({ albums: result });
  }),
);

// ── GET /:id — album detail with songs ───────────────────────
albumRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const album = await loadAlbumInOrg(req.params.id, req.org.id);
    if (!album) throw createError(404, "Album not found");

    const tracks = await db
      .select({ id: songs.id, title: songs.title, key: songs.key, tempo: songs.tempo, durationSeconds: songs.durationSeconds })
      .from(songs)
      .where(eq(songs.albumId, album.id))
      .orderBy(asc(songs.title));

    res.json({ album, songs: tracks });
  }),
);

// ── POST / — create album ────────────────────────────────────
albumRoutes.post(
  "/",
  requirePermission("artists:edit"),
  asyncHandler(async (req, res) => {
    const title = String(req.body?.title || "").trim();
    if (!title) throw createError(400, "Album title is required");

    const year = Number.parseInt(String(req.body?.year ?? ""), 10);
    const [album] = await db
      .insert(albums)
      .values({
        title,
        year: Number.isFinite(year) ? year : null,
        coverUrl: req.body?.coverUrl || null,
        artistId: req.body?.artistId || null,
        organizationId: req.org.id,
        createdBy: req.user.id,
      })
      .returning();

    await logActivity(req, "album.created", { type: "album", id: album.id, label: album.title });
    res.status(201).json({ album });
  }),
);

// ── PUT /:id — update album ──────────────────────────────────
albumRoutes.put(
  "/:id",
  requirePermission("artists:edit"),
  asyncHandler(async (req, res) => {
    const existing = await loadAlbumInOrg(req.params.id, req.org.id);
    if (!existing) throw createError(404, "Album not found");

    const { title, year, coverUrl, artistId } = req.body ?? {};
    if (title !== undefined && !String(title).trim()) {
      throw createError(400, "Album title cannot be empty");
    }

    const parsedYear = year === null ? null : Number.parseInt(String(year ?? ""), 10);
    const [album] = await db
      .update(albums)
      .set({
        ...(title !== undefined && { title: String(title).trim() }),
        ...(year !== undefined && { year: Number.isFinite(parsedYear) ? parsedYear : null }),
        ...(coverUrl !== undefined && { coverUrl: coverUrl || null }),
        ...(artistId !== undefined && { artistId: artistId || null }),
        updatedAt: new Date(),
      })
      .where(eq(albums.id, req.params.id))
      .returning();

    res.json({ album });
  }),
);

// ── DELETE /:id — delete album (unlinks songs) ───────────────
albumRoutes.delete(
  "/:id",
  requirePermission("artists:edit"),
  asyncHandler(async (req, res) => {
    const existing = await loadAlbumInOrg(req.params.id, req.org.id);
    if (!existing) throw createError(404, "Album not found");

    await db.update(songs).set({ albumId: null }).where(eq(songs.albumId, req.params.id));
    await db.delete(albums).where(eq(albums.id, req.params.id));

    await logActivity(req, "album.deleted", { type: "album", id: req.params.id, label: existing.title });
    res.json({ message: "Album deleted" });
  }),
);
