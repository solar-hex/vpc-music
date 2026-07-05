// Drizzle ORM schema — in-app notifications (per user)
import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { organizations } from "./organizations.js";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    type: text("type").notNull(),      // event | team | setlist | system
    title: text("title").notNull(),
    message: text("message"),
    linkPath: text("link_path"),       // in-app path, e.g. /setlists/<id>
    readAt: timestamp("read_at"),      // null = unread
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("notifications_user_read_idx").on(table.userId, table.readAt),
    index("notifications_user_created_idx").on(table.userId, table.createdAt),
  ],
);
