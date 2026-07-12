/**
 * Activity log producer. Never throws — an audit write must not fail the
 * action it records.
 */
import { db } from "../../db.js";
import { activityLog } from "../../schema/index.js";
import { logger } from "../../utils/logger.js";

/**
 * Record an action in the org's audit trail.
 * @param {import("express").Request} req — authenticated request (uses req.user / req.org)
 * @param {string} action — dot-namespaced verb, e.g. "song.created"
 * @param {{ type?: string, id?: string, label?: string }} [target]
 */
export async function logActivity(req, action, target = {}) {
  try {
    if (!req?.user?.id || !action) return;
    await db.insert(activityLog).values({
      action,
      targetType: target.type ?? null,
      targetId: target.id ? String(target.id) : null,
      targetLabel: target.label ?? null,
      actorId: req.user.id,
      organizationId: req.org?.id ?? null,
    });
  } catch (err) {
    logger.warn(`logActivity failed: ${err.message}`);
  }
}
