import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "./config/passport.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { httpLogger } from "./middlewares/httpLogger.js";

// Route imports
import { authRoutes } from "./routes/auth.js";
import { songRoutes } from "./features/songs/routes.js";
import { setlistRoutes } from "./features/setlists/routes.js";
import { platformRoutes } from "./features/platform/routes.js";
import { adminRoutes } from "./features/admin/routes.js";
import { eventRoutes } from "./features/events/routes.js";
import { shareRoutes } from "./features/share/routes.js";
import { stickyNoteRoutes } from "./features/songs/stickyNoteRoutes.js";
import { collaborationRoutes } from "./features/songs/collaborationRoutes.js";
import { orgRoutes } from "./features/organizations/routes.js";

const app = express();

// ── Middleware ────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5176",
  credentials: true,
}));
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
app.use(passport.initialize());
app.use(httpLogger);

// ── Health check ─────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Routes ───────────────────────────────────────
app.use("/auth", authRoutes);
app.use("/songs", songRoutes);
app.use("/songs", stickyNoteRoutes);  // /songs/:songId/notes
app.use("/songs", collaborationRoutes);  // /songs/:songId/collaboration
app.use("/setlists", setlistRoutes);
app.use("/platform", platformRoutes);
app.use("/admin", adminRoutes);
app.use("/events", eventRoutes);
app.use("/organizations", orgRoutes);
app.use("/", shareRoutes);   // /songs/:id/share(s) + /shared/:token

// ── Error handler (must be last) ─────────────────
app.use(errorHandler);

export { app };
