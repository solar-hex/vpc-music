/**
 * Availability routes. Every member can read the grid and edit their OWN
 * row; team managers can edit anyone's.
 *
 *   GET /api/availability?from=YYYY-MM-DD&to=YYYY-MM-DD — org grid
 *   PUT /api/availability — upsert one cell { userId?, date, status } (own row unless team:manage)
 *   DELETE /api/availability — clear one cell { userId?, date }
 */
import { Router } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "../../db.js";
import { availability } from "../../schema/index.js";
import { createError, asyncHandler } from "../../middlewares/errorHandler.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext, requireOrg, resolveEffectivePermissions } from "../../middlewares/orgContext.js";

export const availabilityRoutes = Router();

availabilityRoutes.use(auth, orgContext, requireOrg);

const STATUSES = ["available", "tentative", "unavailable"];

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

/** Members may edit their own row; team managers (and owners) anyone's. */
async function resolveTargetUserId(req) {
  const requested = String(req.body?.userId || "").trim();
  if (!requested || requested === req.user.id) return req.user.id;

  if (req.user.role === "owner") return requested;
  const permissions = await resolveEffectivePermissions(req);
  if (!permissions.includes("team:manage")) {
    throw createError(403, "You can only edit your own availability");
  }
  return requested;
}

// ── GET / — availability grid ────────────────────────────────
availabilityRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const { from, to } = req.query;
    const conditions = [eq(availability.organizationId, req.org.id)];
    if (isValidDate(from)) conditions.push(gte(availability.date, String(from)));
    if (isValidDate(to)) conditions.push(lte(availability.date, String(to)));

    const entries = await db
      .select({
        userId: availability.userId,
        date: availability.date,
        status: availability.status,
      })
      .from(availability)
      .where(and(...conditions));

    res.json({ entries });
  }),
);

// ── PUT / — upsert one cell ──────────────────────────────────
availabilityRoutes.put(
  "/",
  asyncHandler(async (req, res) => {
    const { date, status } = req.body ?? {};
    if (!isValidDate(date)) throw createError(400, "date must be YYYY-MM-DD");
    if (!STATUSES.includes(status)) throw createError(400, `status must be one of: ${STATUSES.join(", ")}`);

    const userId = await resolveTargetUserId(req);

    const [entry] = await db
      .insert(availability)
      .values({ userId, date, status, organizationId: req.org.id })
      .onConflictDoUpdate({
        target: [availability.organizationId, availability.userId, availability.date],
        set: { status, updatedAt: new Date() },
      })
      .returning();

    res.json({ entry });
  }),
);

// ── DELETE / — clear one cell ────────────────────────────────
availabilityRoutes.delete(
  "/",
  asyncHandler(async (req, res) => {
    const { date } = req.body ?? {};
    if (!isValidDate(date)) throw createError(400, "date must be YYYY-MM-DD");

    const userId = await resolveTargetUserId(req);

    await db
      .delete(availability)
      .where(
        and(
          eq(availability.organizationId, req.org.id),
          eq(availability.userId, userId),
          eq(availability.date, String(date)),
        ),
      );

    res.json({ message: "Availability cleared" });
  }),
);
