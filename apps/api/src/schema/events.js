// Drizzle ORM schema — events (services, rehearsals, etc.)
import { pgTable, text, timestamp, uuid, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { setlists } from "./setlists.js";
import { users } from "./users.js";

export const eventStatusEnum = pgEnum("event_status", ["scheduled", "completed", "cancelled"]);

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),             // e.g. "Sunday Morning Worship", "Wednesday Rehearsal"
  date: timestamp("date").notNull(),           // event date/time
  location: text("location"),                  // e.g. "Main Sanctuary", "Fellowship Hall"
  notes: text("notes"),                        // freeform notes
  eventType: text("event_type"),               // e.g. "Service", "Concert", "Wedding"
  status: eventStatusEnum("status").default("scheduled").notNull(),
  completedAt: timestamp("completed_at"),      // set when marked completed (plays logged)
  theme: text("theme"),                        // service theme, e.g. "Gratitude"
  preparedBy: uuid("prepared_by").references(() => users.id), // who is preparing/leading the plan
  team: jsonb("team"),                         // [{ userId?, name, role }] — assigned team for the service
  organizationId: uuid("organization_id").references(() => organizations.id),
  setlistId: uuid("setlist_id").references(() => setlists.id), // optional linked setlist
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
