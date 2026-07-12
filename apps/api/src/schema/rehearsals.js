// Drizzle ORM schema — rehearsals (optionally tied to an event and set list)
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { events } from "./events.js";
import { setlists } from "./setlists.js";
import { users } from "./users.js";

export const rehearsals = pgTable("rehearsals", {
  id: uuid("id").defaultRandom().primaryKey(),
  rehearsalDate: timestamp("rehearsal_date").notNull(),
  location: text("location"),
  notes: text("notes"),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  setlistId: uuid("setlist_id").references(() => setlists.id, { onDelete: "set null" }),
  organizationId: uuid("organization_id").references(() => organizations.id),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
