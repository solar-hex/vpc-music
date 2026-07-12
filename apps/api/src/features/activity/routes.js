/**
 * Activity log routes (admin-only reading).
 *
 *   GET /api/activity?actorId=&action=&limit= — org audit trail, newest first
 */
import { Router } from "express";
import { eq, and, desc, ilike } from "drizzle-orm";
import { db } from "../../db.js";
import { activityLog, users } from "../../schema/index.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext, requireOrg, requirePermission } from "../../middlewares/orgContext.js";

export const activityRoutes = Router();

activityRoutes.get(
  "/",
  auth,
  orgContext,
  requireOrg,
  requirePermission("team:manage"),
  asyncHandler(async (req, res) => {
    const { actorId, action } = req.query;
    const limit = Math.min(200, Math.max(1, Number.parseInt(String(req.query.limit || "100"), 10) || 100));

    const conditions = [eq(activityLog.organizationId, req.org.id)];
    if (typeof actorId === "string" && actorId.trim()) {
      conditions.push(eq(activityLog.actorId, actorId.trim()));
    }
    if (typeof action === "string" && action.trim()) {
      conditions.push(ilike(activityLog.action, `%${action.trim()}%`));
    }

    const entries = await db
      .select({
        id: activityLog.id,
        action: activityLog.action,
        targetType: activityLog.targetType,
        targetId: activityLog.targetId,
        targetLabel: activityLog.targetLabel,
        actorId: activityLog.actorId,
        actorName: users.displayName,
        createdAt: activityLog.createdAt,
      })
      .from(activityLog)
      .leftJoin(users, eq(activityLog.actorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(activityLog.createdAt))
      .limit(limit);

    res.json({ entries });
  }),
);
