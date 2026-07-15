// Drizzle ORM schema — per-user ink/highlight annotations drawn over a chart.
// One row per (song, user); `data` holds the stroke list in content-relative
// coordinates so drawings survive font-size and transpose changes.
import { pgTable, timestamp, uuid, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { songs } from "./songs.js";
import { users } from "./users.js";

export const songAnnotations = pgTable(
  "song_annotations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    songId: uuid("song_id").notNull().references(() => songs.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    data: jsonb("data").default([]).notNull(), // stroke list (tool, color, points[])
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [uniqueIndex("song_annotation_unique").on(table.songId, table.userId)],
);
