/**
 * Media routes — file uploads stored on disk under uploads/ and served at
 * /uploads (see app.js).
 *
 *   GET    /api/media               — org media (?type=&songId=&unattached=true)
 *   POST   /api/media               — upload one file (multipart "file"; songs:edit)
 *   PATCH  /api/media/:id           — retype / attach to a song (songs:edit)
 *   DELETE /api/media/:id           — delete file + row (songs:edit)
 */
import { Router } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import { eq, and, desc, isNull } from "drizzle-orm";
import { db } from "../../db.js";
import { media, songs } from "../../schema/index.js";
import { createError, asyncHandler } from "../../middlewares/errorHandler.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext, requireOrg, requirePermission } from "../../middlewares/orgContext.js";
import { logActivity } from "../activity/service.js";

export const mediaRoutes = Router();

export const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

const MEDIA_TYPES = ["chart", "lyrics", "audio", "backing_track", "stem", "other"];
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    cb(null, `${crypto.randomBytes(8).toString("hex")}-${safe}`);
  },
});

const upload = multer({ storage, limits: { fileSize: MAX_UPLOAD_BYTES } });

mediaRoutes.use(auth, orgContext, requireOrg);

async function loadMediaInOrg(id, orgId) {
  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, id), eq(media.organizationId, orgId)))
    .limit(1);
  return row ?? null;
}

// ── GET / — list media ───────────────────────────────────────
mediaRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const conditions = [eq(media.organizationId, req.org.id)];
    if (typeof req.query.type === "string" && MEDIA_TYPES.includes(req.query.type)) {
      conditions.push(eq(media.type, req.query.type));
    }
    if (typeof req.query.songId === "string" && req.query.songId.trim()) {
      conditions.push(eq(media.songId, req.query.songId.trim()));
    }
    if (req.query.unattached === "true") {
      conditions.push(isNull(media.songId));
    }

    const result = await db
      .select({
        id: media.id,
        type: media.type,
        fileUrl: media.fileUrl,
        filename: media.filename,
        mimeType: media.mimeType,
        sizeBytes: media.sizeBytes,
        songId: media.songId,
        songTitle: songs.title,
        createdAt: media.createdAt,
      })
      .from(media)
      .leftJoin(songs, eq(media.songId, songs.id))
      .where(and(...conditions))
      .orderBy(desc(media.createdAt));

    res.json({ media: result });
  }),
);

// ── POST / — upload ──────────────────────────────────────────
mediaRoutes.post(
  "/",
  requirePermission("songs:edit"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw createError(400, "A file is required (multipart field: file)");

    const type = MEDIA_TYPES.includes(req.body?.type) ? req.body.type : "other";
    const songId = String(req.body?.songId || "").trim() || null;

    const [row] = await db
      .insert(media)
      .values({
        type,
        fileUrl: `/uploads/${req.file.filename}`,
        filename: req.file.originalname,
        mimeType: req.file.mimetype || null,
        sizeBytes: req.file.size ?? null,
        songId,
        organizationId: req.org.id,
        uploadedBy: req.user.id,
      })
      .returning();

    await logActivity(req, "media.uploaded", { type: "media", id: row.id, label: row.filename });
    res.status(201).json({ media: row });
  }),
);

// ── PATCH /:id — retype / attach ─────────────────────────────
mediaRoutes.patch(
  "/:id",
  requirePermission("songs:edit"),
  asyncHandler(async (req, res) => {
    const existing = await loadMediaInOrg(req.params.id, req.org.id);
    if (!existing) throw createError(404, "Media not found");

    const { type, songId } = req.body ?? {};
    if (type !== undefined && !MEDIA_TYPES.includes(type)) {
      throw createError(400, `type must be one of: ${MEDIA_TYPES.join(", ")}`);
    }

    const [row] = await db
      .update(media)
      .set({
        ...(type !== undefined && { type }),
        ...(songId !== undefined && { songId: songId || null }),
      })
      .where(eq(media.id, req.params.id))
      .returning();

    res.json({ media: row });
  }),
);

// ── DELETE /:id — delete file + row ──────────────────────────
mediaRoutes.delete(
  "/:id",
  requirePermission("songs:edit"),
  asyncHandler(async (req, res) => {
    const existing = await loadMediaInOrg(req.params.id, req.org.id);
    if (!existing) throw createError(404, "Media not found");

    await db.delete(media).where(eq(media.id, req.params.id));

    // Best-effort disk cleanup — the row is authoritative
    const diskPath = path.join(UPLOADS_DIR, path.basename(existing.fileUrl));
    fs.promises.unlink(diskPath).catch(() => {});

    await logActivity(req, "media.deleted", { type: "media", id: req.params.id, label: existing.filename });
    res.json({ message: "Media deleted" });
  }),
);
