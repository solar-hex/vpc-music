/**
 * Custom roles & permissions routes.
 *
 *   GET    /api/roles       — system roles (virtual) + the org's custom roles, with member counts
 *   POST   /api/roles       — create a custom role (roles:manage)
 *   PUT    /api/roles/:id   — update a custom role (roles:manage)
 *   DELETE /api/roles/:id   — delete a custom role; members fall back to base role (roles:manage)
 *
 * System roles (admin/musician/observer) are not stored — they're synthesized
 * from the shared permission defaults and cannot be edited or deleted.
 */
import { Router } from "express";
import { eq, and, sql, isNull } from "drizzle-orm";
import { db } from "../../db.js";
import { orgRoles, organizationMembers } from "../../schema/index.js";
import { createError, asyncHandler } from "../../middlewares/errorHandler.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext, requireOrg, requirePermission } from "../../middlewares/orgContext.js";
import { ROLE_PERMISSION_DEFAULTS, ROLE_LABELS, ROLE_DESCRIPTIONS, ALL_PERMISSIONS } from "@vpc-music/shared";

export const roleRoutes = Router();

roleRoutes.use(auth);
roleRoutes.use(orgContext);
roleRoutes.use(requireOrg);

function sanitizePermissions(permissions) {
  if (!Array.isArray(permissions)) return null;
  const valid = permissions.filter((p) => ALL_PERMISSIONS.includes(p));
  return [...new Set(valid)];
}

// ── GET / — list roles ───────────────────────────────────────
roleRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    // Member counts per base role (only members without a custom overlay)
    const baseCounts = await db
      .select({ role: organizationMembers.role, count: sql`count(*)::int` })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, req.org.id), isNull(organizationMembers.customRoleId)))
      .groupBy(organizationMembers.role);
    const baseCountMap = Object.fromEntries(baseCounts.map((row) => [row.role, row.count]));

    const systemRoles = ["admin", "musician", "observer"].map((role) => ({
      id: role,
      name: ROLE_LABELS[role],
      description: ROLE_DESCRIPTIONS[role],
      permissions: ROLE_PERMISSION_DEFAULTS[role],
      isSystem: true,
      memberCount: baseCountMap[role] ?? 0,
    }));

    const customRoles = await db
      .select({
        id: orgRoles.id,
        name: orgRoles.name,
        description: orgRoles.description,
        color: orgRoles.color,
        permissions: orgRoles.permissions,
        createdAt: orgRoles.createdAt,
        updatedAt: orgRoles.updatedAt,
        // Explicitly qualified — see features/setlists/routes.js for why
        // ${orgRoles.id} interpolation here would silently zero every count
        // instead of correlating to the outer row.
        memberCount: sql`(SELECT count(*) FROM organization_members WHERE organization_members.custom_role_id = "org_roles"."id")::int`,
      })
      .from(orgRoles)
      .where(eq(orgRoles.organizationId, req.org.id))
      .orderBy(orgRoles.name);

    res.json({
      roles: [...systemRoles, ...customRoles.map((role) => ({ ...role, isSystem: false }))],
    });
  }),
);

// ── POST / — create custom role ──────────────────────────────
roleRoutes.post(
  "/",
  requirePermission("roles:manage"),
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name || "").trim();
    if (!name) throw createError(400, "Role name is required");

    const permissions = sanitizePermissions(req.body?.permissions);
    if (!permissions) throw createError(400, "permissions must be an array of permission ids");

    const [duplicate] = await db
      .select({ id: orgRoles.id })
      .from(orgRoles)
      .where(and(eq(orgRoles.organizationId, req.org.id), eq(orgRoles.name, name)))
      .limit(1);
    if (duplicate) throw createError(400, "A role with that name already exists");

    const [role] = await db
      .insert(orgRoles)
      .values({
        organizationId: req.org.id,
        name,
        description: req.body?.description || null,
        color: req.body?.color || null,
        permissions,
      })
      .returning();

    res.status(201).json({ role: { ...role, isSystem: false, memberCount: 0 } });
  }),
);

// ── PUT /:id — update custom role ────────────────────────────
roleRoutes.put(
  "/:id",
  requirePermission("roles:manage"),
  asyncHandler(async (req, res) => {
    const [existing] = await db
      .select({ id: orgRoles.id })
      .from(orgRoles)
      .where(and(eq(orgRoles.id, req.params.id), eq(orgRoles.organizationId, req.org.id)))
      .limit(1);
    if (!existing) throw createError(404, "Role not found");

    const { name, description, color, permissions } = req.body ?? {};
    if (name !== undefined && !String(name).trim()) {
      throw createError(400, "Role name cannot be empty");
    }
    const sanitized = permissions !== undefined ? sanitizePermissions(permissions) : undefined;
    if (permissions !== undefined && !sanitized) {
      throw createError(400, "permissions must be an array of permission ids");
    }

    const [role] = await db
      .update(orgRoles)
      .set({
        ...(name !== undefined && { name: String(name).trim() }),
        ...(description !== undefined && { description: description || null }),
        ...(color !== undefined && { color: color || null }),
        ...(sanitized !== undefined && { permissions: sanitized }),
        updatedAt: new Date(),
      })
      .where(eq(orgRoles.id, req.params.id))
      .returning();

    res.json({ role: { ...role, isSystem: false } });
  }),
);

// ── DELETE /:id — delete custom role ─────────────────────────
roleRoutes.delete(
  "/:id",
  requirePermission("roles:manage"),
  asyncHandler(async (req, res) => {
    const [existing] = await db
      .select({ id: orgRoles.id })
      .from(orgRoles)
      .where(and(eq(orgRoles.id, req.params.id), eq(orgRoles.organizationId, req.org.id)))
      .limit(1);
    if (!existing) throw createError(404, "Role not found");

    // Members fall back to their base role
    await db
      .update(organizationMembers)
      .set({ customRoleId: null })
      .where(eq(organizationMembers.customRoleId, req.params.id));
    await db.delete(orgRoles).where(eq(orgRoles.id, req.params.id));

    res.json({ message: "Role deleted" });
  }),
);
