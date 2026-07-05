/**
 * Admin routes — user management (invite & remove team members).
 * Requires global owner OR org-level admin role.
 */
import { Router } from "express";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../../db.js";
import { users, organizationMembers, passwordResetTokens, orgRoles } from "../../schema/index.js";
import { env } from "../../config/env.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext, requireOrg, requirePermission } from "../../middlewares/orgContext.js";
import { createError, asyncHandler } from "../../middlewares/errorHandler.js";
import { logger } from "../../utils/logger.js";
import { sendEmail, buildInviteEmail } from "../../utils/email.js";
import { notifyUser, notifyOrgMembers } from "../notifications/service.js";

export const adminRoutes = Router();

// All admin routes require authentication + org context + team management rights
adminRoutes.use(auth);
adminRoutes.use(orgContext);
adminRoutes.use(requireOrg);
adminRoutes.use(requirePermission("team:manage"));

// ── GET /api/admin/users ─────────────────────────────────────
// List team members in the current organization.
adminRoutes.get(
  "/users",
  asyncHandler(async (req, res) => {
    const allMembers = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        globalRole: users.role,
        orgRole: organizationMembers.role,
        customRoleId: organizationMembers.customRoleId,
        hasPassword: users.passwordHash,
        createdAt: users.createdAt,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, req.org.id))
      .orderBy(users.createdAt);

    // Don't leak the actual hash — just whether one exists
    const result = allMembers.map((u) => ({
      ...u,
      hasPassword: !!u.hasPassword,
    }));

    res.json({ users: result });
  })
);

// ── POST /api/admin/users/invite ─────────────────────────────
// Invite a new team member by email. Creates a user row (if needed) and org membership.
adminRoutes.post(
  "/users/invite",
  asyncHandler(async (req, res) => {
    const { email, displayName, role } = req.body;

    if (!email || !displayName?.trim()) {
      throw createError(400, "Email and display name are required");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedDisplayName = displayName.trim();

    // Check for existing user
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (user) {
      // User exists — check if already in this org
      const [existingMember] = await db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, req.org.id),
            eq(organizationMembers.userId, user.id)
          )
        )
        .limit(1);

      if (existingMember) {
        throw createError(409, "This user is already a member of your organization");
      }
    } else {
      // Create user
      const [created] = await db
        .insert(users)
        .values({
          email: normalizedEmail,
          displayName: normalizedDisplayName,
          role: "member",
          passwordHash: null,
        })
        .returning();
      user = created;
    }

    const validRoles = ["admin", "musician", "observer"];
    const assignedRole = validRoles.includes(role) ? role : "musician";

    // Create org membership
    await db.insert(organizationMembers).values({
      organizationId: req.org.id,
      userId: user.id,
      role: assignedRole,
    });

    const needsPasswordSetup = !user.passwordHash;
    let inviteUrl = `${env.FRONTEND_URL}/login?email=${encodeURIComponent(normalizedEmail)}`;

    if (needsPasswordSetup) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
      });

      inviteUrl = `${env.FRONTEND_URL}/reset-password?token=${token}&invite=1`;
    }

    // Send invite email (falls back to console log in dev)
    await sendEmail({
      to: normalizedEmail,
      subject: "You're invited to VPC Music",
      html: buildInviteEmail({
        inviteUrl,
        displayName: normalizedDisplayName,
        orgName: req.org.name,
        ctaLabel: needsPasswordSetup ? "Set Password" : "Accept Invitation",
      }),
    });
    logger.info(`Invite sent to ${normalizedEmail}`);

    // Let the rest of the team's admins know (never fails the request)
    await notifyOrgMembers(
      req.org.id,
      {
        type: "team",
        title: "New team member invited",
        message: `${normalizedDisplayName} (${normalizedEmail}) was invited as ${assignedRole}.`,
        linkPath: "/admin",
      },
      { excludeUserId: req.user.id, roles: ["admin"] },
    );
    await notifyUser(user.id, {
      type: "team",
      title: `Welcome to ${req.org.name}`,
      message: `You've been added to ${req.org.name} as ${assignedRole}.`,
      linkPath: "/dashboard",
      organizationId: req.org.id,
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        orgRole: assignedRole,
        hasPassword: !!user.passwordHash,
      },
      inviteUrl,
      message: `Invite created for ${normalizedEmail}`,
    });
  })
);

// ── PUT /api/admin/users/:id/role ────────────────────────────
// Update a team member's org role.
adminRoutes.put(
  "/users/:id/role",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { role, customRoleId } = req.body;

    const validRoles = ["admin", "musician", "observer"];
    if (role !== undefined && !validRoles.includes(role)) {
      throw createError(400, `Role must be one of: ${validRoles.join(", ")}`);
    }
    if (role === undefined && customRoleId === undefined) {
      throw createError(400, `Role must be one of: ${validRoles.join(", ")}`);
    }

    const [membership] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, req.org.id),
          eq(organizationMembers.userId, id)
        )
      )
      .limit(1);

    if (!membership) {
      throw createError(404, "User not found in this organization");
    }

    // Validate the custom role belongs to this org (null clears the overlay)
    if (customRoleId) {
      const [customRole] = await db
        .select({ id: orgRoles.id })
        .from(orgRoles)
        .where(and(eq(orgRoles.id, customRoleId), eq(orgRoles.organizationId, req.org.id)))
        .limit(1);
      if (!customRole) {
        throw createError(400, "Custom role not found in this organization");
      }
    }

    await db
      .update(organizationMembers)
      .set({
        ...(role !== undefined && { role }),
        ...(customRoleId !== undefined && { customRoleId: customRoleId || null }),
      })
      .where(eq(organizationMembers.id, membership.id));

    await notifyUser(id, {
      type: "team",
      title: "Your role changed",
      message: `Your role in ${req.org.name} is now ${role}.`,
      linkPath: "/dashboard",
      organizationId: req.org.id,
    });

    res.json({ message: "Role updated" });
  })
);

// ── DELETE /api/admin/users/:id ──────────────────────────────
// Remove a team member from the organization.
adminRoutes.delete(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Prevent self-removal
    if (id === req.user.id) {
      throw createError(400, "You cannot remove yourself");
    }

    const [membership] = await db
      .select({ id: organizationMembers.id, userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, req.org.id),
          eq(organizationMembers.userId, id)
        )
      )
      .limit(1);

    if (!membership) {
      throw createError(404, "User not found in this organization");
    }

    // Remove the org membership (not the user account)
    await db.delete(organizationMembers).where(eq(organizationMembers.id, membership.id));

    // Find the user email for logging
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    logger.info(`User ${user?.email} removed from org ${req.org.name} by admin ${req.user.email}`);
    res.json({ message: `User ${user?.email} removed from organization` });
  })
);
