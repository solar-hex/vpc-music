import { Router } from "express";
import { eq, and, gte, asc, desc, sql } from "drizzle-orm";
import { db } from "../../db.js";
import { events, setlists, setlistSongs, songUsages, users } from "../../schema/index.js";
import { createError, asyncHandler } from "../../middlewares/errorHandler.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext, requireOrg, requirePermission } from "../../middlewares/orgContext.js";
import { notifyOrgMembers } from "../notifications/service.js";
import { logActivity } from "../activity/service.js";

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
// ?status=scheduled|completed|cancelled → filter by status
eventRoutes.get(
  "/",
  auth,
  orgContext,
  asyncHandler(async (req, res) => {
    const upcoming = req.query.upcoming !== "false";
    const statusFilter = ["scheduled", "completed", "cancelled"].includes(String(req.query.status))
      ? String(req.query.status)
      : null;
    const now = new Date();

    let query = db
      .select({
        id: events.id,
        title: events.title,
        date: events.date,
        location: events.location,
        notes: events.notes,
        theme: events.theme,
        eventType: events.eventType,
        status: events.status,
        completedAt: events.completedAt,
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
    if (statusFilter) {
      conditions.push(eq(events.status, statusFilter));
    }
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query.orderBy(statusFilter === "completed" ? desc(events.date) : asc(events.date));

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
        eventType: events.eventType,
        status: events.status,
        completedAt: events.completedAt,
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
    const { title, date, location, notes, theme, eventType, preparedBy, team, setlistId } = req.body;

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
        eventType: eventType || null,
        preparedBy: preparedBy || null,
        team: sanitizeTeam(team) ?? null,
        organizationId: req.org.id,
        setlistId: setlistId || null,
        createdBy: req.user.id,
      })
      .returning();

    await logActivity(req, "event.created", { type: "event", id: event.id, label: event.title });

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
    const { title, date, location, notes, theme, eventType, preparedBy, team, setlistId } = req.body;

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
        ...(eventType !== undefined && { eventType: eventType || null }),
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

// ── POST /api/events/:id/complete — mark completed & log plays ─
// Writes one song_usages row per song in the attached set list and marks
// the set list itself complete. Idempotent: a second call is a 400.
eventRoutes.post(
  "/:id/complete",
  auth,
  orgContext,
  requireOrg,
  requirePermission("events:edit"),
  asyncHandler(async (req, res) => {
    const [existing] = await db
      .select()
      .from(events)
      .where(eq(events.id, req.params.id))
      .limit(1);

    if (!existing) throw createError(404, "Event not found");
    if (existing.status === "completed") {
      throw createError(400, "Event is already completed");
    }

    const [event] = await db
      .update(events)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(events.id, req.params.id))
      .returning();

    let playsLogged = 0;
    if (existing.setlistId) {
      const items = await db
        .select({ songId: setlistSongs.songId })
        .from(setlistSongs)
        .where(eq(setlistSongs.setlistId, existing.setlistId));

      const playedSongIds = items.map((item) => item.songId).filter(Boolean);
      if (playedSongIds.length > 0) {
        const usedDate = new Date(existing.date).toISOString().split("T")[0];
        await db.insert(songUsages).values(
          playedSongIds.map((songId) => ({
            songId,
            usedAt: usedDate,
            eventId: existing.id,
            notes: `Event: ${existing.title}`,
            organizationId: req.org.id,
            recordedBy: req.user.id,
          })),
        );
        playsLogged = playedSongIds.length;
      }

      await db
        .update(setlists)
        .set({ status: "complete", updatedAt: new Date() })
        .where(eq(setlists.id, existing.setlistId));
    }

    await logActivity(req, "event.completed", { type: "event", id: event.id, label: existing.title });
    res.json({ event, playsLogged });
  })
);

// ── PATCH /api/events/:id/status — cancel / un-cancel ────────
eventRoutes.patch(
  "/:id/status",
  auth,
  orgContext,
  requireOrg,
  requirePermission("events:edit"),
  asyncHandler(async (req, res) => {
    const { status } = req.body ?? {};
    if (!["scheduled", "cancelled"].includes(status)) {
      throw createError(400, "status must be scheduled or cancelled (use /complete to complete)");
    }

    const [event] = await db
      .update(events)
      .set({ status, updatedAt: new Date() })
      .where(eq(events.id, req.params.id))
      .returning();

    if (!event) throw createError(404, "Event not found");

    await logActivity(req, `event.${status}`, { type: "event", id: event.id, label: event.title });
    res.json({ event });
  })
);
