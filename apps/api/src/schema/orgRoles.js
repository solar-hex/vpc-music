// Drizzle ORM schema — custom org roles (permission overlay)
// The base role enum on organization_members stays authoritative for members
// without a custom role; a custom role replaces the base permission set.
import { pgTable, text, timestamp, uuid, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";

export const orgRoles = pgTable(
  "org_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color"),               // display color, e.g. "#ca9762"
    permissions: jsonb("permissions").notNull(), // string[] of permission ids
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [uniqueIndex("org_role_org_name_unique").on(table.organizationId, table.name)],
);
