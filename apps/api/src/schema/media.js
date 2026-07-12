// Drizzle ORM schema — media files (charts, lyrics, audio, stems)
import { pgTable, text, timestamp, integer, uuid, pgEnum, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { songs } from "./songs.js";
import { users } from "./users.js";

export const mediaTypeEnum = pgEnum("media_type", [
  "chart",
  "lyrics",
  "audio",
  "backing_track",
  "stem",
  "other",
]);

export const media = pgTable(
  "media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: mediaTypeEnum("type").notNull().default("other"),
    fileUrl: text("file_url").notNull(),   // served path, e.g. /uploads/<name>
    filename: text("filename").notNull(),
    content: text("content"),             // structured chart source (first-class path)
    format: text("format"),               // 'chordpro' | 'pdf' | 'image'
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    songId: uuid("song_id").references(() => songs.id, { onDelete: "set null" }), // null = unattached
    organizationId: uuid("organization_id").references(() => organizations.id),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("media_org_idx").on(table.organizationId), index("media_song_idx").on(table.songId)],
);
