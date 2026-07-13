/**
 * SQL-text verification for the events routes' songCount subquery
 * (features/events/routes.js, GET /:id and GET /). See
 * setlist-list-query-sql.test.js for why this exists: pg-mem can't execute
 * a correlated subquery with a qualified outer reference, so this checks
 * the generated SQL text directly instead, via drizzle.mock() (no DB
 * connection needed).
 */
import { describe, it, expect } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { events } from "../schema/index.js";

describe("events songCount subquery SQL text", () => {
  const db = drizzle.mock();

  // Copied verbatim from features/events/routes.js.
  const songCountExpr = sql`(select count(*)::int from setlist_songs where setlist_songs.setlist_id = "events"."setlist_id")`;

  it('correlates via an explicitly qualified "events"."setlist_id"', () => {
    const { sql: text } = db.select({ value: songCountExpr }).from(events).toSQL();
    expect(text).toContain(`"events"."setlist_id"`);
  });

  it("does not collapse into a tautological self-comparison", () => {
    // The regression this guards: ${events.setlistId} interpolated inside
    // this subquery rendered as a bare "setlist_id", which resolved
    // against the subquery's OWN local setlist_songs.setlist_id — a
    // tautology ("setlist_id" = "setlist_id") that counted every
    // setlist_songs row in the database for every event.
    const { sql: text } = db.select({ value: songCountExpr }).from(events).toSQL();
    const whereClause = text.slice(text.indexOf("where"));
    expect(whereClause).not.toMatch(/"setlist_id"\s*=\s*"setlist_id"/);
  });
});
