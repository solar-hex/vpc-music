// Drizzle ORM schema — audit trail (who did what, to what, when)
import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { users } from "./users.js";

export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    action: text("action").notNull(),        // e.g. "song.created", "setlist.approved"
    targetType: text("target_type"),         // song | setlist | event | member | artist | ...
    targetId: text("target_id"),
    targetLabel: text("target_label"),       // human-readable name at time of action
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id").references(() => organizations.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("activity_org_created_idx").on(table.organizationId, table.createdAt)],
);
