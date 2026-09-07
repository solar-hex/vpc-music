import "dotenv/config";
import { app } from "./app.js";
import { logger } from "./utils/logger.js";

const PORT = process.env.PORT || 3001;

// Plain HTTP. The Socket.IO conductor server and the notification cron were
// retired in the simplification tranche; `realtime/conductor.js` stays in the
// tree until tranche 2 decides whether live set-list sync comes back.
app.listen(PORT, () => {
  logger.info(`VPC Music API running on port ${PORT}`);
});
