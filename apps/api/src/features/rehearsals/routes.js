/**
 * Rehearsal routes.
 *
 *   GET    /api/rehearsals        — org rehearsals (?upcoming=true)
 *   POST   /api/rehearsals        — create (events:edit)
 *   PUT    /api/rehearsals/:id    — update (events:edit)
 *   DELETE /api/rehearsals/:id    — delete (events:edit)
 */
import { Router } from "express";
import { eq, and, gte, asc, desc } from "drizzle-orm";
import { db } from "../../db.js";
import { rehearsals, events, setlists } from "../../schema/index.js";
import { createError, asyncHandler } from "../../middlewares/errorHandler.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext, requireOrg, requirePermission } from "../../middlewares/orgContext.js";
import { logActivity } from "../activity/service.js";

export const rehearsalRoutes = Router();

rehearsalRoutes.use(auth, orgContext, requireOrg);

async function loadRehearsalInOrg(id, orgId) {
  const [rehearsal] = await db
    .select()
    .from(rehearsals)
    .where(and(eq(rehearsals.id, id), eq(rehearsals.organizationId, orgId)))
    .limit(1);
  return rehearsal ?? null;
}

// ── GET / — list rehearsals ──────────────────────────────────
rehearsalRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const upcoming = req.query.upcoming === "true";
    const conditions = [eq(rehearsals.organizationId, req.org.id)];
    if (upcoming) conditions.push(gte(rehearsals.rehearsalDate, new Date()));

    const result = await db
      .select({
        id: rehearsals.id,
        rehearsalDate: rehearsals.rehearsalDate,
        location: rehearsals.location,
        notes: rehearsals.notes,
        eventId: rehearsals.eventId,
        eventTitle: events.title,
        setlistId: rehearsals.setlistId,
        setlistName: setlists.name,
        createdAt: rehearsals.createdAt,
      })
      .from(rehearsals)
      .leftJoin(events, eq(rehearsals.eventId, events.id))
      .leftJoin(setlists, eq(rehearsals.setlistId, setlists.id))
      .where(and(...conditions))
      .orderBy(upcoming ? asc(rehearsals.rehearsalDate) : desc(rehearsals.rehearsalDate));

    res.json({ rehearsals: result });
  }),
);

// ── POST / — create rehearsal ────────────────────────────────
rehearsalRoutes.post(
  "/",
  requirePermission("events:edit"),
  asyncHandler(async (req, res) => {
    const date = new Date(String(req.body?.rehearsalDate || ""));
    if (Number.isNaN(date.getTime())) {
      throw createError(400, "A valid rehearsalDate is required");
    }

    const [rehearsal] = await db
      .insert(rehearsals)
      .values({
        rehearsalDate: date,
        location: req.body?.location || null,
        notes: req.body?.notes || null,
        eventId: req.body?.eventId || null,
        setlistId: req.body?.setlistId || null,
        organizationId: req.org.id,
        createdBy: req.user.id,
      })
      .returning();

    await logActivity(req, "rehearsal.created", { type: "rehearsal", id: rehearsal.id, label: date.toDateString() });
    res.status(201).json({ rehearsal });
  }),
);

// ── PUT /:id — update rehearsal ──────────────────────────────
rehearsalRoutes.put(
  "/:id",
  requirePermission("events:edit"),
  asyncHandler(async (req, res) => {
    const existing = await loadRehearsalInOrg(req.params.id, req.org.id);
    if (!existing) throw createError(404, "Rehearsal not found");

    const { rehearsalDate, location, notes, eventId, setlistId } = req.body ?? {};
    let parsedDate;
    if (rehearsalDate !== undefined) {
      parsedDate = new Date(String(rehearsalDate));
      if (Number.isNaN(parsedDate.getTime())) throw createError(400, "rehearsalDate must be a valid date");
    }

    const [rehearsal] = await db
      .update(rehearsals)
      .set({
        ...(parsedDate !== undefined && { rehearsalDate: parsedDate }),
        ...(location !== undefined && { location: location || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(eventId !== undefined && { eventId: eventId || null }),
        ...(setlistId !== undefined && { setlistId: setlistId || null }),
        updatedAt: new Date(),
      })
      .where(eq(rehearsals.id, req.params.id))
      .returning();

    res.json({ rehearsal });
  }),
);

// ── DELETE /:id — delete rehearsal ───────────────────────────
rehearsalRoutes.delete(
  "/:id",
  requirePermission("events:edit"),
  asyncHandler(async (req, res) => {
    const existing = await loadRehearsalInOrg(req.params.id, req.org.id);
    if (!existing) throw createError(404, "Rehearsal not found");

    await db.delete(rehearsals).where(eq(rehearsals.id, req.params.id));
    res.json({ message: "Rehearsal deleted" });
  }),
);
