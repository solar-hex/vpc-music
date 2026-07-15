// Drizzle ORM schema — per-musician instrument parts layered over a song's chart.
// Each part belongs to the user who created it and starts personal (private).
// A single part can be promoted (personal → organization → global) on its own.
import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { songs, songTierEnum } from "./songs.js";
import { users } from "./users.js";

export const songInstrumentParts = pgTable(
  "song_instrument_parts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    songId: uuid("song_id").notNull().references(() => songs.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g. "Bass", "My keys"
    icon: text("icon"),           // emoji or short token, e.g. "🎸"
    color: text("color"),         // hex color, e.g. "#6b5bff"
    content: text("content"),     // ChordPro / notes layer (optional)
    abcNotation: text("abc_notation"), // per-part staff notation (optional)
    tier: songTierEnum("tier").default("personal").notNull(), // personal | organization | global
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("song_instrument_parts_song_idx").on(table.songId),
    index("song_instrument_parts_user_idx").on(table.userId),
  ],
);
