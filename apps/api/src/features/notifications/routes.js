/**
 * In-app notification routes (personal resource — no org role checks).
 *
 *   GET    /api/notifications              — list own notifications (?unread=true&limit=N)
 *   GET    /api/notifications/unread-count — unread badge count
 *   POST   /api/notifications/:id/read     — mark one read
 *   POST   /api/notifications/read-all     — mark all read
 *   DELETE /api/notifications/:id          — delete one
 *   DELETE /api/notifications              — clear all
 */
import { Router } from "express";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { db } from "../../db.js";
import { notifications } from "../../schema/index.js";
import { createError, asyncHandler } from "../../middlewares/errorHandler.js";
import { auth } from "../../middlewares/auth.js";

export const notificationRoutes = Router();

notificationRoutes.use(auth);

// ── GET / — list own notifications ───────────────────────────
notificationRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const unreadOnly = req.query.unread === "true";
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || "50"), 10) || 50));

    const conditions = [eq(notifications.userId, req.user.id)];
    if (unreadOnly) conditions.push(isNull(notifications.readAt));

    const result = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    res.json({ notifications: result });
  }),
);

// ── GET /unread-count ────────────────────────────────────────
notificationRoutes.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    const [{ count }] = await db
      .select({ count: sql`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, req.user.id), isNull(notifications.readAt)));

    res.json({ count });
  }),
);

// ── POST /read-all — mark all read ───────────────────────────
notificationRoutes.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, req.user.id), isNull(notifications.readAt)));

    res.json({ message: "All notifications marked read" });
  }),
);

// ── POST /:id/read — mark one read ───────────────────────────
notificationRoutes.post(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const [notification] = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, req.params.id), eq(notifications.userId, req.user.id)))
      .returning();

    if (!notification) throw createError(404, "Notification not found");

    res.json({ notification });
  }),
);

// ── DELETE / — clear all ─────────────────────────────────────
notificationRoutes.delete(
  "/",
  asyncHandler(async (req, res) => {
    await db.delete(notifications).where(eq(notifications.userId, req.user.id));
    res.json({ message: "Notifications cleared" });
  }),
);

// ── DELETE /:id — delete one ─────────────────────────────────
notificationRoutes.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await db
      .delete(notifications)
      .where(and(eq(notifications.id, req.params.id), eq(notifications.userId, req.user.id)));

    res.json({ message: "Notification deleted" });
  }),
);
