/**
 * Organization context middleware.
 * After auth, looks up the user's org membership(s) and attaches them to the request.
 *
 *   req.orgs        — array of { id, name, role } for all org memberships
 *   req.org         — the active org context (auto-selected if only one, or via X-Organization-Id header)
 *   req.orgRole     — shortcut to req.org.role (admin | musician | observer)
 *
 * Use `requireOrg` middleware after auth to enforce that a valid org context exists.
 * Use `requireOrgRole(...roles)` to check the user has one of the given org roles (or is a global owner).
 */
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { organizationMembers, organizations, orgRoles } from "../schema/index.js";
import { ROLE_PERMISSION_DEFAULTS } from "@vpc-music/shared";

/**
 * Attaches org context to the request. Must be used after `auth` middleware.
 */
export async function orgContext(req, _res, next) {
  if (!req.user) return next();

  try {
    const memberships = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        role: organizationMembers.role,
        customRoleId: organizationMembers.customRoleId,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, req.user.id));

    req.orgs = memberships;

    // Auto-select if only one org, or use header to pick
    if (memberships.length === 1) {
      req.org = memberships[0];
      req.orgRole = memberships[0].role;
    } else if (memberships.length > 1) {
      const headerOrgId = req.headers["x-organization-id"];
      const match = memberships.find((m) => m.id === headerOrgId);
      if (match) {
        req.org = match;
        req.orgRole = match.role;
      }
      // If no header or no match, req.org stays undefined — requireOrg will catch it
    }
  } catch {
    // Silently continue — org context is optional for some routes
  }

  next();
}

/**
 * Middleware that requires a valid organization context on the request.
 */
export function requireOrg(req, res, next) {
  if (!req.org) {
    return res.status(400).json({
      error: { message: "Organization context required. Set X-Organization-Id header." },
    });
  }
  next();
}

/**
 * Factory that returns middleware to check the user's org role (or global owner).
 * @param  {...string} allowedRoles — e.g. "admin", "musician"
 */
export function requireOrgRole(...allowedRoles) {
  return (req, res, next) => {
    // Global owners bypass org-level role checks
    if (req.user?.role === "owner") return next();

    if (!req.org) {
      return res.status(400).json({
        error: { message: "Organization context required" },
      });
    }
    if (!allowedRoles.includes(req.orgRole)) {
      return res.status(403).json({
        error: { message: `Requires one of: ${allowedRoles.join(", ")}` },
      });
    }
    next();
  };
}

/**
 * Resolve the member's effective permission set (cached on the request):
 * the custom role's explicit list when assigned, else the base-role defaults.
 * @returns {Promise<string[]>}
 */
export async function resolveEffectivePermissions(req) {
  if (req._effectivePermissions) return req._effectivePermissions;

  let permissions = ROLE_PERMISSION_DEFAULTS[req.orgRole] ?? [];
  if (req.org?.customRoleId) {
    try {
      const [customRole] = await db
        .select({ permissions: orgRoles.permissions })
        .from(orgRoles)
        .where(eq(orgRoles.id, req.org.customRoleId))
        .limit(1);
      if (customRole && Array.isArray(customRole.permissions)) {
        permissions = customRole.permissions;
      }
    } catch {
      // Fall back to base-role defaults if the custom role can't be loaded
    }
  }

  req._effectivePermissions = permissions;
  return permissions;
}

/**
 * Factory that returns middleware requiring at least one of the given
 * permissions. Global owners bypass; members without a custom role use the
 * base-role defaults, so behavior matches the old requireOrgRole checks.
 * @param  {...string} requiredPermissions — e.g. "songs:edit"
 */
export function requirePermission(...requiredPermissions) {
  return async (req, res, next) => {
    // Global owners bypass org-level permission checks
    if (req.user?.role === "owner") return next();

    if (!req.org) {
      return res.status(400).json({
        error: { message: "Organization context required" },
      });
    }

    const effective = await resolveEffectivePermissions(req);
    if (!requiredPermissions.some((permission) => effective.includes(permission))) {
      return res.status(403).json({
        error: { message: `Requires one of: ${requiredPermissions.join(", ")}` },
      });
    }
    next();
  };
}
