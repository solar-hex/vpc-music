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
import { annotationRoutes } from "./features/songs/annotationRoutes.js";
import { songMediaRoutes } from "./features/songs/mediaRoutes.js";
import { songDuplicateRoutes } from "./features/songs/duplicateRoutes.js";
import { orgRoutes } from "./features/organizations/routes.js";
import { artistRoutes } from "./features/artists/routes.js";
import { notificationRoutes } from "./features/notifications/routes.js";

import { roleRoutes } from "./features/roles/routes.js";
import { albumRoutes } from "./features/albums/routes.js";
import { mediaRoutes, UPLOADS_DIR } from "./features/media/routes.js";
import { setlistTemplateRoutes } from "./features/setlists/templateRoutes.js";
import { rehearsalRoutes } from "./features/rehearsals/routes.js";
import { availabilityRoutes } from "./features/availability/routes.js";
import { activityRoutes } from "./features/activity/routes.js";
import { statsRoutes } from "./features/stats/routes.js";

const app = express();

// ── Middleware ────────────────────────────────────
// CORS_ORIGIN takes a comma-separated list, because the site answers on both
// the bare domain and www and a browser sends whichever one it is on. Keep
// FRONTEND_URL a single canonical address: it builds invite and reset links
// and is the target origin for the Google sign-in popup.
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5176")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
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

// ── /api prefix tolerance ────────────────────────
// Routes mount unprefixed, but clients and proxies may send /api/*
// (the Vite dev proxy rewrites it away; other deployments may not).
app.use((req, _res, next) => {
  if (req.url.startsWith("/api/")) {
    req.url = req.url.slice(4);
  }
  next();
});

// ── Routes ───────────────────────────────────────
app.use("/auth", authRoutes);
app.use("/songs", songDuplicateRoutes);  // before songRoutes, whose /:id would take "duplicates"
app.use("/songs", songRoutes);
app.use("/songs", stickyNoteRoutes);  // /songs/:songId/notes
app.use("/songs", collaborationRoutes);  // /songs/:songId/collaboration
app.use("/songs", annotationRoutes);  // /songs/:songId/annotations
app.use("/songs", songMediaRoutes);  // /songs/:id/media/:key → presigned 302
app.use("/setlists/templates", setlistTemplateRoutes); // before /setlists so "templates" ≠ ":id"
app.use("/setlists", setlistRoutes);
app.use("/platform", platformRoutes);
app.use("/admin", adminRoutes);
app.use("/events", eventRoutes);
app.use("/organizations", orgRoutes);
app.use("/artists", artistRoutes);
app.use("/notifications", notificationRoutes);

app.use("/roles", roleRoutes);
app.use("/albums", albumRoutes);
app.use("/media", mediaRoutes);
app.use("/rehearsals", rehearsalRoutes);
app.use("/availability", availabilityRoutes);
app.use("/activity", activityRoutes);
app.use("/stats", statsRoutes);

// Uploaded media files (charts, audio, stems)
app.use("/uploads", express.static(UPLOADS_DIR));
app.use("/", shareRoutes);   // /songs/:id/share(s) + /shared/:token

// ── Error handler (must be last) ─────────────────
app.use(errorHandler);

export { app };
