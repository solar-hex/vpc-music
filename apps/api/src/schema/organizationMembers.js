// Drizzle ORM schema — organization membership (many-to-many users ↔ orgs)
import { pgTable, text, timestamp, uuid, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { users } from "./users.js";
import { orgRoles } from "./orgRoles.js";

export const orgRoleEnum = pgEnum("org_role", ["admin", "musician", "observer"]);

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: orgRoleEnum("role").default("musician").notNull(),
    // Optional custom-role overlay; null = pure base-role behavior
    customRoleId: uuid("custom_role_id").references(() => orgRoles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("org_member_unique").on(table.organizationId, table.userId),
  ]
);
