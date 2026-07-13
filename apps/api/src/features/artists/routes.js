/**
 * Artist directory routes.
 *
 *   GET    /api/artists            — list artists (search, genre filter, song counts)
 *   GET    /api/artists/:id        — artist detail with linked + matching songs
 *   POST   /api/artists            — create artist (admin/musician); links matching songs
 *   POST   /api/artists/resolve    — find-or-create by name (admin/musician)
 *   PUT    /api/artists/:id        — update artist (admin/musician)
 *   DELETE /api/artists/:id        — delete artist (admin/musician); unlinks songs
 */
import { Router } from "express";
import { eq, and, ilike, sql, desc } from "drizzle-orm";
import { db } from "../../db.js";
import { artists, songs, songUsages } from "../../schema/index.js";
import { createError, asyncHandler } from "../../middlewares/errorHandler.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext, requireOrg, requirePermission } from "../../middlewares/orgContext.js";

export const artistRoutes = Router();

// Explicitly qualified — see the comment on albums/routes.js's trackCountExpr
// for why ${artists.id} interpolation here would silently zero every count.
const songCountExpr = sql`(SELECT count(*) FROM songs WHERE songs.artist_id = "artists"."id")::int`;

async function loadArtistInOrg(id, orgId) {
  const [artist] = await db
    .select()
    .from(artists)
    .where(and(eq(artists.id, id), eq(artists.organizationId, orgId)))
    .limit(1);
  return artist ?? null;
}

/** Link org songs whose free-text artist matches this artist's name. */
async function linkMatchingSongs(artist) {
  await db
    .update(songs)
    .set({ artistId: artist.id })
    .where(
      and(
        eq(songs.organizationId, artist.organizationId),
        sql`lower(${songs.artist}) = lower(${artist.name})`,
        sql`${songs.artistId} IS NULL`,
      ),
    );
}

// ── GET / — list artists ──────────────────────────────────────
artistRoutes.get(
  "/",
  auth,
  orgContext,
  requireOrg,
  asyncHandler(async (req, res) => {
    const { q, genre } = req.query;

    const conditions = [eq(artists.organizationId, req.org.id)];
    if (typeof q === "string" && q.trim()) {
      conditions.push(ilike(artists.name, `%${q.trim()}%`));
    }
    if (typeof genre === "string" && genre.trim()) {
      conditions.push(eq(artists.genre, genre.trim()));
    }

    const result = await db
      .select({
        id: artists.id,
        name: artists.name,
        bio: artists.bio,
        genre: artists.genre,
        website: artists.website,
        imageUrl: artists.imageUrl,
        verified: artists.verified,
        songCount: songCountExpr,
        createdAt: artists.createdAt,
        updatedAt: artists.updatedAt,
      })
      .from(artists)
      .where(and(...conditions))
      .orderBy(artists.name);

    res.json({ artists: result });
  }),
);

// ── GET /:id — artist detail ─────────────────────────────────
artistRoutes.get(
  "/:id",
  auth,
  orgContext,
  requireOrg,
  asyncHandler(async (req, res) => {
    const artist = await loadArtistInOrg(req.params.id, req.org.id);
    if (!artist) throw createError(404, "Artist not found");

    const linkedSongs = await db
      .select({
        id: songs.id,
        title: songs.title,
        key: songs.key,
        tempo: songs.tempo,
        useCount: sql`(SELECT count(*) FROM song_usages WHERE song_usages.song_id = "songs"."id")::int`,
      })
      .from(songs)
      .where(eq(songs.artistId, artist.id))
      .orderBy(desc(sql`(SELECT count(*) FROM song_usages WHERE song_usages.song_id = "songs"."id")`), songs.title);

    res.json({ artist, songs: linkedSongs });
  }),
);

// ── POST / — create artist ───────────────────────────────────
artistRoutes.post(
  "/",
  auth,
  orgContext,
  requireOrg,
  requirePermission("artists:edit"),
  asyncHandler(async (req, res) => {
    const { name, bio, genre, website, imageUrl, verified } = req.body;
    if (!name || !String(name).trim()) {
      throw createError(400, "Artist name is required");
    }

    const trimmedName = String(name).trim();
    const [duplicate] = await db
      .select({ id: artists.id })
      .from(artists)
      .where(and(eq(artists.organizationId, req.org.id), sql`lower(${artists.name}) = lower(${trimmedName})`))
      .limit(1);

    if (duplicate) {
      throw createError(400, "An artist with that name already exists");
    }

    const [artist] = await db
      .insert(artists)
      .values({
        name: trimmedName,
        bio: bio || null,
        genre: genre || null,
        website: website || null,
        imageUrl: imageUrl || null,
        verified: !!verified,
        organizationId: req.org.id,
        createdBy: req.user.id,
      })
      .returning();

    // Back-fill: link existing songs with a matching free-text artist name
    await linkMatchingSongs(artist);

    res.status(201).json({ artist });
  }),
);

// ── POST /resolve — find-or-create by name ───────────────────
artistRoutes.post(
  "/resolve",
  auth,
  orgContext,
  requireOrg,
  requirePermission("artists:edit"),
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name || "").trim();
    if (!name) throw createError(400, "Artist name is required");

    const [existing] = await db
      .select()
      .from(artists)
      .where(and(eq(artists.organizationId, req.org.id), sql`lower(${artists.name}) = lower(${name})`))
      .limit(1);

    if (existing) {
      return res.json({ artist: existing, created: false });
    }

    const [artist] = await db
      .insert(artists)
      .values({ name, organizationId: req.org.id, createdBy: req.user.id })
      .returning();

    await linkMatchingSongs(artist);

    res.status(201).json({ artist, created: true });
  }),
);

// ── PUT /:id — update artist ─────────────────────────────────
artistRoutes.put(
  "/:id",
  auth,
  orgContext,
  requireOrg,
  requirePermission("artists:edit"),
  asyncHandler(async (req, res) => {
    const existing = await loadArtistInOrg(req.params.id, req.org.id);
    if (!existing) throw createError(404, "Artist not found");

    const { name, bio, genre, website, imageUrl, verified } = req.body;
    if (name !== undefined && !String(name).trim()) {
      throw createError(400, "Artist name cannot be empty");
    }

    const [artist] = await db
      .update(artists)
      .set({
        ...(name !== undefined && { name: String(name).trim() }),
        ...(bio !== undefined && { bio: bio || null }),
        ...(genre !== undefined && { genre: genre || null }),
        ...(website !== undefined && { website: website || null }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
        ...(verified !== undefined && { verified: !!verified }),
        updatedAt: new Date(),
      })
      .where(eq(artists.id, req.params.id))
      .returning();

    res.json({ artist });
  }),
);

// ── DELETE /:id — delete artist (unlinks songs) ──────────────
artistRoutes.delete(
  "/:id",
  auth,
  orgContext,
  requireOrg,
  requirePermission("artists:edit"),
  asyncHandler(async (req, res) => {
    const existing = await loadArtistInOrg(req.params.id, req.org.id);
    if (!existing) throw createError(404, "Artist not found");

    await db.update(songs).set({ artistId: null }).where(eq(songs.artistId, req.params.id));
    await db.delete(artists).where(eq(artists.id, req.params.id));

    res.json({ message: "Artist deleted" });
  }),
);
