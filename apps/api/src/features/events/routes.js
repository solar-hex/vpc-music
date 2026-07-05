import { Router } from "express";
import { eq, and, gte, asc, desc, sql } from "drizzle-orm";
import { db } from "../../db.js";
import { events, setlists, setlistSongs, users } from "../../schema/index.js";
import { createError, asyncHandler } from "../../middlewares/errorHandler.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext, requireOrg, requirePermission } from "../../middlewares/orgContext.js";
import { notifyOrgMembers } from "../notifications/service.js";

export const eventRoutes = Router();

/** Normalize a `team` payload: array of { userId?, name, role? } entries. */
function sanitizeTeam(team) {
  if (team === null) return null;
  if (!Array.isArray(team)) return undefined;
  return team
    .filter((m) => m && typeof m === "object" && typeof m.name === "string" && m.name.trim())
    .map((m) => ({
      ...(typeof m.userId === "string" && m.userId ? { userId: m.userId } : {}),
      name: m.name.trim(),
      ...(typeof m.role === "string" && m.role.trim() ? { role: m.role.trim() } : {}),
    }));
}

// ── GET /api/events — list events ────────────────────────────
// ?upcoming=true  → only future events (default)
// ?upcoming=false → all events
eventRoutes.get(
  "/",
  auth,
  orgContext,
  asyncHandler(async (req, res) => {
    const upcoming = req.query.upcoming !== "false";
    const now = new Date();

    let query = db
      .select({
        id: events.id,
        title: events.title,
        date: events.date,
        location: events.location,
        notes: events.notes,
        theme: events.theme,
        preparedBy: events.preparedBy,
        preparedByName: users.displayName,
        team: events.team,
        setlistId: events.setlistId,
        setlistName: setlists.name,
        setlistStatus: setlists.status,
        songCount: sql`(select count(*)::int from ${setlistSongs} where ${setlistSongs.setlistId} = ${events.setlistId})`,
        createdAt: events.createdAt,
      })
      .from(events)
      .leftJoin(setlists, eq(events.setlistId, setlists.id))
      .leftJoin(users, eq(events.preparedBy, users.id));

    const conditions = [];
    if (req.org) {
      conditions.push(eq(events.organizationId, req.org.id));
    }
    if (upcoming) {
      conditions.push(gte(events.date, now));
    }
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query.orderBy(asc(events.date));

    res.json({ events: result });
  })
);

// ── GET /api/events/:id — get single event ───────────────────
eventRoutes.get(
  "/:id",
  auth,
  asyncHandler(async (req, res) => {
    const [event] = await db
      .select({
        id: events.id,
        title: events.title,
        date: events.date,
        location: events.location,
        notes: events.notes,
        theme: events.theme,
        preparedBy: events.preparedBy,
        preparedByName: users.displayName,
        team: events.team,
        setlistId: events.setlistId,
        setlistName: setlists.name,
        setlistStatus: setlists.status,
        songCount: sql`(select count(*)::int from ${setlistSongs} where ${setlistSongs.setlistId} = ${events.setlistId})`,
        createdBy: events.createdBy,
        createdAt: events.createdAt,
        updatedAt: events.updatedAt,
      })
      .from(events)
      .leftJoin(setlists, eq(events.setlistId, setlists.id))
      .leftJoin(users, eq(events.preparedBy, users.id))
      .where(eq(events.id, req.params.id))
      .limit(1);

    if (!event) throw createError(404, "Event not found");

    res.json({ event });
  })
);

// ── POST /api/events — create event ─────────────────────────
eventRoutes.post(
  "/",
  auth,
  orgContext,
  requireOrg,  requirePermission("events:edit"),  asyncHandler(async (req, res) => {
    const { title, date, location, notes, theme, preparedBy, team, setlistId } = req.body;

    if (!title || !date) {
      throw createError(400, "Title and date are required");
    }

    const [event] = await db
      .insert(events)
      .values({
        title,
        date: new Date(date),
        location: location || null,
        notes: notes || null,
        theme: theme || null,
        preparedBy: preparedBy || null,
        team: sanitizeTeam(team) ?? null,
        organizationId: req.org.id,
        setlistId: setlistId || null,
        createdBy: req.user.id,
      })
      .returning();

    await notifyOrgMembers(
      req.org.id,
      {
        type: "event",
        title: "New event scheduled",
        message: `${event.title} — ${new Date(event.date).toLocaleDateString()}`,
        linkPath: "/dashboard",
      },
      { excludeUserId: req.user.id },
    );

    res.status(201).json({ event });
  })
);

// ── PUT /api/events/:id — update event ──────────────────────
eventRoutes.put(
  "/:id",
  auth,  orgContext,
  requireOrg,
  requirePermission("events:edit"),  asyncHandler(async (req, res) => {
    const { title, date, location, notes, theme, preparedBy, team, setlistId } = req.body;

    const [existing] = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.id, req.params.id))
      .limit(1);

    if (!existing) throw createError(404, "Event not found");

    const sanitizedTeam = sanitizeTeam(team);
    const [event] = await db
      .update(events)
      .set({
        ...(title !== undefined && { title }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(location !== undefined && { location }),
        ...(notes !== undefined && { notes }),
        ...(theme !== undefined && { theme: theme || null }),
        ...(preparedBy !== undefined && { preparedBy: preparedBy || null }),
        ...(sanitizedTeam !== undefined && { team: sanitizedTeam }),
        ...(setlistId !== undefined && { setlistId: setlistId || null }),
        updatedAt: new Date(),
      })
      .where(eq(events.id, req.params.id))
      .returning();

    res.json({ event });
  })
);

// ── DELETE /api/events/:id — delete event ────────────────────
eventRoutes.delete(
  "/:id",
  auth,  orgContext,
  requireOrg,
  requirePermission("events:edit"),  asyncHandler(async (req, res) => {
    const [existing] = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.id, req.params.id))
      .limit(1);

    if (!existing) throw createError(404, "Event not found");

    await db.delete(events).where(eq(events.id, req.params.id));

    res.json({ message: "Event deleted" });
  })
);
