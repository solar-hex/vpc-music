// Drizzle ORM schema — song usage tracking (service history)
import { pgTable, text, timestamp, uuid, date } from "drizzle-orm/pg-core";
import { songs } from "./songs.js";
import { users } from "./users.js";
import { organizations } from "./organizations.js";
import { events } from "./events.js";
import { setlists } from "./setlists.js";

export const songUsages = pgTable("song_usages", {
  id: uuid("id").defaultRandom().primaryKey(),
  songId: uuid("song_id").notNull().references(() => songs.id, { onDelete: "cascade" }),
  usedAt: date("used_at").notNull(),                   // the date the song was used/played
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),  // optional link to event
  setlistId: uuid("setlist_id").references(() => setlists.id, { onDelete: "set null" }), // optional link to setlist
  // How the play was recorded: manual (per-song form), event_complete,
  // setlist_complete, or perform (end-of-set prompt in perform mode).
  // Machine-generated rows (setlist_complete) are deleted when a setlist is
  // reopened so re-completing never double-counts.
  source: text("source").default("manual").notNull(),
  notes: text("notes"),                                 // e.g. "Sunday morning service"
  organizationId: uuid("organization_id").references(() => organizations.id),
  recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
});
