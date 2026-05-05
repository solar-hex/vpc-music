import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { eq, and, gt, isNull } from "drizzle-orm";
import passport from "passport";
import { db } from "../db.js";
import { users, passwordResetTokens, organizationMembers, organizations } from "../schema/index.js";
import { env } from "../config/env.js";
import { createError, asyncHandler } from "../middlewares/errorHandler.js";
import { auth } from "../middlewares/auth.js";
import { logger } from "../utils/logger.js";
import { sendEmail, buildResetEmail } from "../utils/email.js";

export const authRoutes = Router();

// ── Helper: create JWT and set cookie ────────────────────────
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

function setTokenCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

// ── POST /api/auth/register ──────────────────────────────────
authRoutes.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      throw createError(400, "Email and password are required");
    }
    if (password.length < 8) {
      throw createError(400, "Password must be at least 8 characters");
    }

    // Check for existing user
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing) {
      throw createError(409, "An account with that email already exists");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [user] = await db
      .insert(users)
      .values({
        email: email.toLowerCase().trim(),
        passwordHash,
        displayName: displayName || email.split("@")[0],
        role: "member", // default global role for new users
      })
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
      });

    const token = signToken(user);
    setTokenCookie(res, token);

    res.status(201).json({
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      token,
    });
  })
);

// ── POST /api/auth/login ─────────────────────────────────────
authRoutes.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email) {
      throw createError(400, "Email is required");
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      throw createError(401, "Invalid email or password");
    }

    // Invited user who hasn't set a password yet
    if (!user.passwordHash) {
      if (!password) {
        return res.json({
          needsPassword: true,
          email: user.email,
          displayName: user.displayName,
        });
      }
      // They shouldn't be sending a password when there's none to compare
      throw createError(401, "Invalid email or password");
    }

    if (!password) {
      throw createError(400, "Password is required");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw createError(401, "Invalid email or password");
    }

    const token = signToken(user);
    setTokenCookie(res, token);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
      token,
    });
  })
);

// ── POST /api/auth/set-password ──────────────────────────────
// First-time password setup for invited users (no existing password).
authRoutes.post(
  "/set-password",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw createError(400, "Email and new password are required");
    }
    if (password.length < 8) {
      throw createError(400, "Password must be at least 8 characters");
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      throw createError(404, "No account found for that email");
    }

    if (user.passwordHash) {
      throw createError(400, "Password is already set. Use forgot-password to reset it.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    // Auto-login after setting password
    const updatedUser = { ...user, passwordHash };
    const token = signToken(updatedUser);
    setTokenCookie(res, token);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
      token,
    });
  })
);

// ── POST /api/auth/logout ────────────────────────────────────
authRoutes.post("/logout", (_req, res) => {
  res.clearCookie("token").json({ message: "Logged out" });
});

// ── GET /api/auth/me ─────────────────────────────────────────
authRoutes.get(
  "/me",
  auth,
  asyncHandler(async (req, res) => {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        preferences: users.preferences,
      })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (!user) {
      throw createError(404, "User not found");
    }

    // Include org memberships
    // Global owners see ALL orgs; regular users see only their memberships
    let orgs;
    if (user.role === "owner") {
      orgs = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          role: organizationMembers.role,
        })
        .from(organizations)
        .leftJoin(
          organizationMembers,
          and(
            eq(organizationMembers.organizationId, organizations.id),
            eq(organizationMembers.userId, user.id),
          ),
        )
        .orderBy(organizations.name);

      // Fill in role for orgs the owner isn't a member of
      orgs = orgs.map((o) => ({
        ...o,
        role: o.role || "admin", // treat owner as admin in orgs they don't formally belong to
      }));
    } else {
      orgs = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          role: organizationMembers.role,
        })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
        .where(eq(organizationMembers.userId, user.id));
    }

    res.json({ user: { ...user, organizations: orgs } });
  })
);

// ── POST /api/auth/forgot-password ───────────────────────────
authRoutes.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
      throw createError(400, "Email is required");
    }

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    // Always return success to prevent email enumeration
    if (!user) {
      res.json({ message: "If that email exists, a reset link has been sent." });
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
    });

    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;
    // Send password-reset email (falls back to console log in dev)
    await sendEmail({
      to: user.email,
      subject: "Reset your VPC Music password",
      html: buildResetEmail(resetUrl),
    });
    logger.info(`Password reset requested for ${user.email}`);

    res.json({ message: "If that email exists, a reset link has been sent." });
  })
);

// ── POST /api/auth/reset-password ────────────────────────────
authRoutes.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const { token, password } = req.body;

    if (!token || !password) {
      throw createError(400, "Token and new password are required");
    }
    if (password.length < 8) {
      throw createError(400, "Password must be at least 8 characters");
    }

    const [record] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          gt(passwordResetTokens.expiresAt, new Date()),
          isNull(passwordResetTokens.usedAt)
        )
      )
      .limit(1);

    if (!record) {
      throw createError(400, "Invalid or expired reset token");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, record.userId));

    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, record.id));

    res.json({ message: "Password reset successfully. You can now log in." });
  })
);

// ── OAuth2: Google ───────────────────────────────────────────
authRoutes.get("/google", (req, res, next) => {
  if (!env.GOOGLE_CLIENT_ID) {
    return res
      .status(501)
      .send(oauthErrorCallbackHtml("Google OAuth is not configured", 501));
  }
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })(req, res, next);
});

authRoutes.get(
  "/google/callback",
  (req, res, next) => {
    passport.authenticate("google", { session: false }, (err, user, info) => {
      if (err) {
        return res.send(oauthErrorCallbackHtml(err.message || "Authentication failed", 500));
      }
      if (!user) {
        const msg = info?.message || "No account found for this Google account. Access is by invitation only — reach out to your worship team lead to get added.";
        return res.send(oauthErrorCallbackHtml(msg, 403));
      }
      req.user = user;
      next();
    })(req, res, next);
  },
  (req, res) => {
    const token = signToken(req.user);
    setTokenCookie(res, token);
    res.send(oauthCallbackHtml(token, req.user));
  },
);

/**
 * Returns inline HTML/JS that posts the auth result to the opener window.
 * Used by the popup-based OAuth flow.
 */
function oauthCallbackHtml(token, user) {
  const safeUser = JSON.stringify({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  }).replace(/</g, "\\u003c");
  return `<!DOCTYPE html><html><body><script>
    var payload = {
      type: 'VPC_OAUTH_CALLBACK',
      success: true,
      token: ${JSON.stringify(token)},
      user: ${safeUser}
    };
    // BroadcastChannel works even when COOP severs window.opener
    try {
      var bc = new BroadcastChannel('vpc_oauth');
      bc.postMessage(payload);
      bc.close();
    } catch(e) {}
    // Fallback: postMessage to opener if still accessible
    if (window.opener) {
      try { window.opener.postMessage(payload, ${JSON.stringify(env.FRONTEND_URL)}); } catch(e) {}
    }
    window.close();
  </script></body></html>`;
}

function oauthErrorCallbackHtml(message, status = 500) {
  const safeMessage = JSON.stringify(message);
  return `<!DOCTYPE html><html><body><script>
    var payload = {
      type: 'VPC_OAUTH_CALLBACK',
      success: false,
      error: ${safeMessage},
      status: ${JSON.stringify(status)}
    };
    try {
      var bc = new BroadcastChannel('vpc_oauth');
      bc.postMessage(payload);
      bc.close();
    } catch(e) {}
    if (window.opener) {
      try { window.opener.postMessage(payload, ${JSON.stringify(env.FRONTEND_URL)}); } catch(e) {}
    }
    window.close();
    // If window.close() doesn't work (no opener), show the error
    setTimeout(function() { document.body.innerText = ${safeMessage}; }, 300);
  </script></body></html>`;
}
