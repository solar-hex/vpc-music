// Drizzle ORM schema — songs, keys, metadata
import { pgTable, text, timestamp, boolean, integer, uuid, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { users } from "./users.js";
import { artists } from "./artists.js";

export const songStatusEnum = pgEnum("song_status", [
  "ready",
  "needs_review",
  "in_rehearsal",
  "updated",
  "missing_chords",
]);

export const songs = pgTable("songs", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  aka: text("aka"),
  category: text("category"),
  key: text("key"),              // e.g. "G", "Bb"
  tempo: integer("tempo"),       // BPM
  artist: text("artist"),        // free-text artist name (kept as fallback)
  artistId: uuid("artist_id").references(() => artists.id, { onDelete: "set null" }), // optional directory link
  albumId: uuid("album_id"),     // optional album link (FK lives in albums.js to avoid an import cycle)
  timeSignature: text("time_signature"),   // e.g. "4/4", "6/8"
  durationSeconds: integer("duration_seconds"),
  genre: text("genre"),
  shout: text("shout"),
  year: text("year"),
  tags: text("tags"),            // comma-separated or JSON array
  content: text("content").notNull(), // ChordPro source
  abcNotation: text("abc_notation"),  // optional ABC staff notation source
  isDraft: boolean("is_draft").default(false),
  status: songStatusEnum("status"),   // rehearsal-readiness status (null = unset)
  isArchived: boolean("is_archived").default(false).notNull(),
  archivedAt: timestamp("archived_at"),
  deletedAt: timestamp("deleted_at"), // soft delete (trash) — null = live
  defaultVariationId: uuid("default_variation_id").references(() => songVariations.id, { onDelete: "set null" }),
  organizationId: uuid("organization_id").references(() => organizations.id),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Per-user song favorites (personal — any org role may favorite)
export const songFavorites = pgTable(
  "song_favorites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    songId: uuid("song_id").notNull().references(() => songs.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [uniqueIndex("song_favorite_unique").on(table.songId, table.userId)],
);

export const songVariations = pgTable("song_variations", {
  id: uuid("id").defaultRandom().primaryKey(),
  songId: uuid("song_id").notNull().references(() => songs.id),
  name: text("name").notNull(),  // e.g. "My version", "Acoustic"
  content: text("content").notNull(),
  key: text("key"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
