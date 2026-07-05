/**
 * Assistant routes.
 *
 *   POST /api/assistant/chat — run one assistant turn (any org role; tool
 *   access is filtered by role inside the service). Stateless: the client
 *   sends the visible history each call. Rate-limited per user.
 */
import { Router } from "express";
import { createError, asyncHandler } from "../../middlewares/errorHandler.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext, requireOrg } from "../../middlewares/orgContext.js";
import { runAssistant } from "./service.js";

export const assistantRoutes = Router();

// Simple in-memory rate limit: 30 messages per user per hour
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const usage = new Map(); // userId → number[] (timestamps)

function checkRateLimit(userId) {
  const now = Date.now();
  const timestamps = (usage.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT) return false;
  timestamps.push(now);
  usage.set(userId, timestamps);
  return true;
}

assistantRoutes.post(
  "/chat",
  auth,
  orgContext,
  requireOrg,
  asyncHandler(async (req, res) => {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      throw createError(400, "messages array is required");
    }
    if (!checkRateLimit(req.user.id)) {
      throw createError(429, "Assistant rate limit reached — try again in a bit.");
    }

    const result = await runAssistant(
      messages,
      {
        userId: req.user.id,
        orgId: req.org.id,
        orgName: req.org.name,
        orgRole: req.orgRole,
        globalRole: req.user.role,
      },
      req.app.get("assistantClient"), // injectable for tests
    );

    res.json(result);
  }),
);
