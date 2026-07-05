// Drizzle ORM schema — setlists & song groups
import { pgTable, text, timestamp, integer, boolean, uuid, jsonb } from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { songs } from "./songs.js";
import { songVariations } from "./songs.js";
import { organizations } from "./organizations.js";

export const setlistStatusEnum = pgEnum("setlist_status", ["draft", "complete"]);

export const setlists = pgTable("setlists", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  category: text("category"),          // e.g. "Church", "Weddings", "Special Events"
  notes: text("notes"),
  status: setlistStatusEnum("status").default("draft"),
  leader: text("leader"),              // who leads this set
  tags: text("tags"),                  // comma-separated tags
  isArchived: boolean("is_archived").default(false).notNull(),
  archivedAt: timestamp("archived_at"),
  deletedAt: timestamp("deleted_at"),  // soft delete (trash) — null = live
  organizationId: uuid("organization_id").references(() => organizations.id),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const setlistSongs = pgTable("setlist_songs", {
  id: uuid("id").defaultRandom().primaryKey(),
  setlistId: uuid("setlist_id").notNull().references(() => setlists.id),
  songId: uuid("song_id").notNull().references(() => songs.id),
  variationId: uuid("variation_id").references(() => songVariations.id),
  position: integer("position").notNull(),
  key: text("key"),                     // override key for this setlist
  notes: text("notes"),                 // per-song notes within the setlist
  duration: integer("duration"),        // planned duration in seconds
  capo: integer("capo"),                // suggested capo fret (0–12)
  arrangement: text("arrangement"),     // ACOUSTIC | ELECTRIC | FULL_BAND | STRIPPED_DOWN
  transitionCues: jsonb("transition_cues"), // [{ type, text, durationSec }] between this song and the next
});
