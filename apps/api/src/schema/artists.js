// Drizzle ORM schema — artist directory
import { pgTable, text, timestamp, boolean, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { users } from "./users.js";

export const artists = pgTable(
  "artists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    bio: text("bio"),
    genre: text("genre"),           // e.g. "Worship", "Contemporary", "Hymn"
    website: text("website"),
    imageUrl: text("image_url"),
    verified: boolean("verified").default(false).notNull(),
    organizationId: uuid("organization_id").references(() => organizations.id),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [uniqueIndex("artist_org_name_unique").on(table.organizationId, sql`lower(${table.name})`)],
);
