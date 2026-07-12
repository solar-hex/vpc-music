/**
 * Organization management routes.
 *
 *   POST   /api/organizations          — create a new org (any authenticated user)
 *   GET    /api/organizations          — list orgs the user belongs to (owners see all)
 *   PUT    /api/organizations/:id      — rename an org (org admin or global owner)
 *   DELETE /api/organizations/:id      — delete an org (global owner only) with full cascade
 */
import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../../db.js";
import {
  organizations,
  organizationMembers,
  songs,
  songVariations,
  setlists,
  setlistSongs,
  events,
  songUsages,
  songEdits,
  shareTokens,
  stickyNotes,
} from "../../schema/index.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext, requireOrg } from "../../middlewares/orgContext.js";
import { createError, asyncHandler } from "../../middlewares/errorHandler.js";
import { users } from "../../schema/index.js";

export const orgRoutes = Router();

// All org routes require authentication
orgRoutes.use(auth);

// ── GET /current/members — list members of the active org ────
// Readable by every org role (observer included) — powers team displays.
orgRoutes.get(
  "/current/members",
  orgContext,
  requireOrg,
  asyncHandler(async (req, res) => {
    const members = await db
      .select({
        userId: organizationMembers.userId,
        displayName: users.displayName,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, req.org.id))
      .orderBy(users.displayName);

    res.json({ members });
  }),
);

// ── POST / — Create organization ─────────────────────────────
orgRoutes.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
      throw createError(400, "Organization name is required");
    }

    const [org] = await db
      .insert(organizations)
      .values({ name: name.trim() })
      .returning();

    // Auto-add creator as admin (Worship Leader)
    await db.insert(organizationMembers).values({
      organizationId: org.id,
      userId: req.user.id,
      role: "admin",
    });

    res.status(201).json({
      organization: { id: org.id, name: org.name, role: "admin" },
    });
  }),
);

// ── GET / — List organizations ───────────────────────────────
orgRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    if (req.user.role === "owner") {
      // Global owners see every org
      const allOrgs = await db
        .select({
          id: organizations.id,
          name: organizations.name,
        })
        .from(organizations)
        .orderBy(organizations.name);

      return res.json({ organizations: allOrgs });
    }

    // Regular users see orgs they belong to
    const userOrgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizationMembers.organizationId, organizations.id),
      )
      .where(eq(organizationMembers.userId, req.user.id))
      .orderBy(organizations.name);

    res.json({ organizations: userOrgs });
  }),
);

// ── PUT /:id — Update organization ───────────────────────────
orgRoutes.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, slug, logoUrl } = req.body;

    if (name === undefined && slug === undefined && logoUrl === undefined) {
      throw createError(400, "Organization name is required");
    }
    if (name !== undefined && (!name || !name.trim())) {
      throw createError(400, "Organization name is required");
    }
    if (slug !== undefined && slug && !/^[a-z0-9-]+$/.test(slug)) {
      throw createError(400, "Slug may only contain lowercase letters, numbers, and hyphens");
    }

    // Check authorization: global owner or org admin
    if (req.user.role !== "owner") {
      const [membership] = await db
        .select({ role: organizationMembers.role })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, id),
            eq(organizationMembers.userId, req.user.id),
          ),
        )
        .limit(1);

      if (!membership || membership.role !== "admin") {
        throw createError(403, "Only org admins or platform owners can rename an organization");
      }
    }

    const [updated] = await db
      .update(organizations)
      .set({
        ...(name !== undefined && { name: name.trim() }),
        ...(slug !== undefined && { slug: slug || null }),
        ...(logoUrl !== undefined && { logoUrl: logoUrl || null }),
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, id))
      .returning();

    if (!updated) {
      throw createError(404, "Organization not found");
    }

    res.json({ organization: updated });
  }),
);

// ── DELETE /:id — Delete organization ────────────────────────
// Owner-only. Cascades: members (auto), songs+children, setlists+children, events.
orgRoutes.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (req.user.role !== "owner") {
      throw createError(403, "Only platform owners can delete an organization");
    }

    const { id } = req.params;

    // Verify org exists
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    if (!org) {
      throw createError(404, "Organization not found");
    }

    // ── Cascade delete related data ──────────────────────────

    // 1. Get all song IDs for this org (needed for child table cleanup)
    const orgSongs = await db
      .select({ id: songs.id })
      .from(songs)
      .where(eq(songs.organizationId, id));
    const songIds = orgSongs.map((s) => s.id);

    if (songIds.length > 0) {
      // Clear defaultVariationId to avoid FK constraint issues
      await db
        .update(songs)
        .set({ defaultVariationId: null })
        .where(inArray(songs.id, songIds));

      // Delete song variations (no cascade from songs)
      await db
        .delete(songVariations)
        .where(inArray(songVariations.songId, songIds));

      // Song children with cascade (stickyNotes, songUsages, songEdits, shareTokens)
      // will be deleted automatically when songs are deleted, but let's be explicit
      // for setlistSongs which reference songId
    }

    // 2. Get all setlist IDs and delete setlist songs
    const orgSetlists = await db
      .select({ id: setlists.id })
      .from(setlists)
      .where(eq(setlists.organizationId, id));
    const setlistIds = orgSetlists.map((s) => s.id);

    if (setlistIds.length > 0) {
      await db
        .delete(setlistSongs)
        .where(inArray(setlistSongs.setlistId, setlistIds));
    }

    // 3. Delete songs (cascades: stickyNotes, songUsages, songEdits, shareTokens)
    if (songIds.length > 0) {
      await db.delete(songs).where(inArray(songs.id, songIds));
    }

    // 4. Delete setlists
    await db.delete(setlists).where(eq(setlists.organizationId, id));

    // 5. Delete events
    await db.delete(events).where(eq(events.organizationId, id));

    // 6. Delete org (organization_members cascade automatically)
    await db.delete(organizations).where(eq(organizations.id, id));

    res.json({ message: "Organization deleted" });
  }),
);
