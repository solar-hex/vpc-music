// Drizzle ORM schema — member availability by date
import { pgTable, timestamp, uuid, date, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { users } from "./users.js";

export const availabilityStatusEnum = pgEnum("availability_status", [
  "available",
  "tentative",
  "unavailable",
]);

export const availability = pgTable(
  "availability",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: availabilityStatusEnum("status").notNull(),
    organizationId: uuid("organization_id").references(() => organizations.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [uniqueIndex("availability_org_user_date_unique").on(table.organizationId, table.userId, table.date)],
);
