// Drizzle ORM schema — albums (grouped under artists)
import { pgTable, text, timestamp, integer, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { artists } from "./artists.js";
import { users } from "./users.js";

export const albums = pgTable(
  "albums",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    year: integer("year"),
    coverUrl: text("cover_url"),
    artistId: uuid("artist_id").references(() => artists.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id").references(() => organizations.id),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [uniqueIndex("album_org_artist_title_unique").on(table.organizationId, table.artistId, sql`lower(${table.title})`)],
);
