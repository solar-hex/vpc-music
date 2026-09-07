import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const SESSION_COOKIE = "token";

/** Cookie attributes shared by set and clear so the browser matches them up. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production" || env.NODE_ENV === "staging",
    sameSite: "lax",
    path: "/",
  };
}

/** Milliseconds until the token expires, or null when it carries no `exp`. */
export function tokenLifetimeMs(token, now = Date.now()) {
  const payload = jwt.decode(token);
  if (!payload || typeof payload.exp !== "number") return null;
  return Math.max(0, payload.exp * 1000 - now);
}

/**
 * True once a verified token has used up half of its life. `GET /auth/me`
 * re-issues the cookie at that point, so an active device never signs out
 * while an abandoned one still expires on schedule.
 */
export function tokenPastHalfLife(payload, now = Date.now()) {
  if (!payload || typeof payload.iat !== "number" || typeof payload.exp !== "number") return false;
  const halfLifeAt = (payload.iat + (payload.exp - payload.iat) / 2) * 1000;
  return now >= halfLifeAt;
}
