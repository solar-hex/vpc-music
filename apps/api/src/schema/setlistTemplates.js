// Drizzle ORM schema — reusable set list structures
// structure: [{ label: "Fast opener" }, { label: "Slow" }, ...] — ordered slots
import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { users } from "./users.js";

export const setlistTemplates = pgTable("setlist_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  structure: jsonb("structure").notNull(), // ordered array of { label }
  organizationId: uuid("organization_id").references(() => organizations.id),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
