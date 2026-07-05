/**
 * Notification producers. Failures are swallowed and logged — a notification
 * must never fail the request that triggered it.
 */
import { eq, and, lt, gte, lte, isNull, inArray } from "drizzle-orm";
import { db } from "../../db.js";
import { notifications, organizationMembers, events } from "../../schema/index.js";
import { logger } from "../../utils/logger.js";

/**
 * Notify a single user.
 * @param {string} userId
 * @param {{ type: string, title: string, message?: string, linkPath?: string, organizationId?: string }} payload
 */
export async function notifyUser(userId, payload) {
  try {
    if (!userId || !payload?.title || !payload?.type) return;
    await db.insert(notifications).values({
      userId,
      organizationId: payload.organizationId ?? null,
      type: payload.type,
      title: payload.title,
      message: payload.message ?? null,
      linkPath: payload.linkPath ?? null,
    });
  } catch (err) {
    logger.warn(`notifyUser failed: ${err.message}`);
  }
}

/**
 * Notify all members of an organization.
 * @param {string} organizationId
 * @param {{ type: string, title: string, message?: string, linkPath?: string }} payload
 * @param {{ excludeUserId?: string, roles?: string[] }} [options]
 */
export async function notifyOrgMembers(organizationId, payload, options = {}) {
  try {
    if (!organizationId || !payload?.title || !payload?.type) return;

    const members = await db
      .select({ userId: organizationMembers.userId, role: organizationMembers.role })
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId));

    const recipients = members.filter(
      (member) =>
        member.userId !== options.excludeUserId &&
        (!options.roles || options.roles.includes(member.role)),
    );

    if (recipients.length === 0) return;

    await db.insert(notifications).values(
      recipients.map((member) => ({
        userId: member.userId,
        organizationId,
        type: payload.type,
        title: payload.title,
        message: payload.message ?? null,
        linkPath: payload.linkPath ?? null,
      })),
    );
  } catch (err) {
    logger.warn(`notifyOrgMembers failed: ${err.message}`);
  }
}

/** Delete read notifications older than 90 days. Returns silently on error. */
export async function cleanupOldNotifications() {
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    await db.delete(notifications).where(lt(notifications.createdAt, cutoff));
  } catch (err) {
    logger.warn(`cleanupOldNotifications failed: ${err.message}`);
  }
}

/**
 * Remind org members about events happening within the next 48 hours.
 * Deduped per user+event via linkPath, so repeated runs are safe.
 */
export async function sendUpcomingEventReminders() {
  try {
    const now = new Date();
    const horizon = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const upcoming = await db
      .select({ id: events.id, title: events.title, date: events.date, organizationId: events.organizationId })
      .from(events)
      .where(and(gte(events.date, now), lte(events.date, horizon)));

    for (const event of upcoming) {
      if (!event.organizationId) continue;

      const linkPath = `/dashboard?event=${event.id}`;
      const members = await db
        .select({ userId: organizationMembers.userId })
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, event.organizationId));
      if (members.length === 0) continue;

      const alreadyNotified = await db
        .select({ userId: notifications.userId })
        .from(notifications)
        .where(and(eq(notifications.linkPath, linkPath), inArray(notifications.userId, members.map((m) => m.userId))));
      const notifiedIds = new Set(alreadyNotified.map((n) => n.userId));

      const pending = members.filter((member) => !notifiedIds.has(member.userId));
      if (pending.length === 0) continue;

      await db.insert(notifications).values(
        pending.map((member) => ({
          userId: member.userId,
          organizationId: event.organizationId,
          type: "event",
          title: "Upcoming event",
          message: `${event.title} — ${new Date(event.date).toLocaleString()}`,
          linkPath,
        })),
      );
    }
  } catch (err) {
    logger.warn(`sendUpcomingEventReminders failed: ${err.message}`);
  }
}
