/**
 * Shared team-invite logic, reused by single invite, bulk invite, and
 * provisioning an org for another person.
 */
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../../db.js";
import { users, organizationMembers, passwordResetTokens } from "../../schema/index.js";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { sendEmail, buildInviteEmail } from "../../utils/email.js";
import { notifyUser } from "../notifications/service.js";

const VALID_ORG_ROLES = ["admin", "musician", "observer"];

/**
 * Invite (or attach) a member to an organization by email. Creates the user
 * row if needed, adds the org membership, and emails an invite/password-setup
 * link. Returns { alreadyMember, user, assignedRole?, inviteUrl?, needsPasswordSetup? }.
 * A member who already belongs to the org is a no-op (alreadyMember: true).
 */
export async function inviteMemberToOrg({ org, email, displayName, role }) {
  const normalizedEmail = String(email || "").toLowerCase().trim();
  if (!normalizedEmail) {
    const err = new Error("Email is required");
    err.status = 400;
    throw err;
  }
  const normalizedDisplayName = String(displayName || "").trim() || normalizedEmail;

  let [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);

  if (user) {
    const [existingMember] = await db
      .select()
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, org.id), eq(organizationMembers.userId, user.id)))
      .limit(1);
    if (existingMember) {
      return { alreadyMember: true, user };
    }
  } else {
    const [created] = await db
      .insert(users)
      .values({ email: normalizedEmail, displayName: normalizedDisplayName, role: "member", passwordHash: null })
      .returning();
    user = created;
  }

  const assignedRole = VALID_ORG_ROLES.includes(role) ? role : "musician";

  await db.insert(organizationMembers).values({ organizationId: org.id, userId: user.id, role: assignedRole });

  const needsPasswordSetup = !user.passwordHash;
  let inviteUrl = `${env.FRONTEND_URL}/login?email=${encodeURIComponent(normalizedEmail)}`;
  if (needsPasswordSetup) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await db.insert(passwordResetTokens).values({ userId: user.id, token, expiresAt });
    inviteUrl = `${env.FRONTEND_URL}/reset-password?token=${token}&invite=1`;
  }

  await sendEmail({
    to: normalizedEmail,
    subject: "You're invited to VPC Music",
    html: buildInviteEmail({
      inviteUrl,
      displayName: normalizedDisplayName,
      orgName: org.name,
      ctaLabel: needsPasswordSetup ? "Set Password" : "Accept Invitation",
    }),
  });
  logger.info(`Invite sent to ${normalizedEmail}`);

  await notifyUser(user.id, {
    type: "team",
    title: `Welcome to ${org.name}`,
    message: `You've been added to ${org.name} as ${assignedRole}.`,
    linkPath: "/dashboard",
    organizationId: org.id,
  });

  return { alreadyMember: false, user, assignedRole, inviteUrl, needsPasswordSetup };
}

/** Regenerate an invite link for a member who hasn't set a password yet. */
export async function resendInvite({ org, userId }) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }
  if (user.passwordHash) {
    const err = new Error("This user has already set up their account");
    err.status = 400;
    throw err;
  }
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(passwordResetTokens).values({ userId: user.id, token, expiresAt });
  const inviteUrl = `${env.FRONTEND_URL}/reset-password?token=${token}&invite=1`;
  await sendEmail({
    to: user.email,
    subject: "Your VPC Music invite",
    html: buildInviteEmail({ inviteUrl, displayName: user.displayName, orgName: org.name, ctaLabel: "Set Password" }),
  });
  logger.info(`Invite resent to ${user.email}`);
  return { inviteUrl, email: user.email };
}
