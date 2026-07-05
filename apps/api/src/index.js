import "dotenv/config";
import { createServer } from "http";
import { Server } from "socket.io";
import { app } from "./app.js";
import { logger } from "./utils/logger.js";
import { setupConductorMode } from "./realtime/conductor.js";
import { sendUpcomingEventReminders, cleanupOldNotifications } from "./features/notifications/service.js";

const PORT = process.env.PORT || 3001;

const server = createServer(app);

// Socket.io for real-time features (live setlist sync, etc.)
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5176",
    credentials: true,
  },
});

io.on("connection", (socket) => {
  logger.info(`Socket connected: ${socket.id}`);
});

// Attach conductor mode (setlist live sync)
setupConductorMode(io);

server.listen(PORT, () => {
  logger.info(`VPC Music API running on port ${PORT}`);
});

// Periodic notification jobs: event reminders (every 6h) + retention cleanup (daily).
// Both swallow their own errors, so a DB hiccup never crashes the server.
const SIX_HOURS = 6 * 60 * 60 * 1000;
setTimeout(() => {
  void sendUpcomingEventReminders();
  setInterval(() => void sendUpcomingEventReminders(), SIX_HOURS);
  setInterval(() => void cleanupOldNotifications(), 4 * SIX_HOURS);
}, 30_000);

export { io };
