/**
 * Per-user ink annotations drawn over a song's chart.
 * One row per (song, user); GET returns yours, PUT upserts the stroke list.
 */
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../../db.js";
import { songAnnotations } from "../../schema/index.js";
import { createError, asyncHandler } from "../../middlewares/errorHandler.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext } from "../../middlewares/orgContext.js";

export const annotationRoutes = Router();

// ── GET /api/songs/:songId/annotations — my drawing for this song ─
annotationRoutes.get(
  "/:songId/annotations",
  auth,
  orgContext,
  asyncHandler(async (req, res) => {
    const [annotation] = await db
      .select()
      .from(songAnnotations)
      .where(and(eq(songAnnotations.songId, req.params.songId), eq(songAnnotations.userId, req.user.id)))
      .limit(1);

    res.json({ annotation: annotation ?? null });
  }),
);

// ── PUT /api/songs/:songId/annotations — upsert my drawing ───────
annotationRoutes.put(
  "/:songId/annotations",
  auth,
  orgContext,
  asyncHandler(async (req, res) => {
    const { data } = req.body ?? {};
    if (!Array.isArray(data)) throw createError(400, "data must be an array of strokes");
    // Guard against unbounded payloads (a drawing is a few KB, not megabytes).
    if (JSON.stringify(data).length > 512 * 1024) {
      throw createError(413, "Drawing too large");
    }

    const [existing] = await db
      .select({ id: songAnnotations.id })
      .from(songAnnotations)
      .where(and(eq(songAnnotations.songId, req.params.songId), eq(songAnnotations.userId, req.user.id)))
      .limit(1);

    let annotation;
    if (existing) {
      [annotation] = await db
        .update(songAnnotations)
        .set({ data, updatedAt: new Date() })
        .where(eq(songAnnotations.id, existing.id))
        .returning();
    } else {
      [annotation] = await db
        .insert(songAnnotations)
        .values({ songId: req.params.songId, userId: req.user.id, data })
        .returning();
    }

    res.json({ annotation });
  }),
);
