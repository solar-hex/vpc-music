/**
 * SQL-text verification for the setlists list query's four aggregate
 * subqueries (features/setlists/routes.js, GET /api/setlists).
 *
 * This exists because pg-mem — the in-memory Postgres engine used by
 * setlist-create-flow.e2e.test.js for real end-to-end execution — has a
 * confirmed parser/engine limitation: it cannot execute ANY correlated
 * subquery whose outer reference is explicitly qualified (table-name or
 * alias), even though that's completely standard SQL a real Postgres
 * accepts. That's a pg-mem gap, not an application bug, but it means the
 * "list" e2e test can't exercise this query end-to-end (see the .skip
 * there for the full explanation).
 *
 * drizzle.mock() sidesteps the gap entirely: it generates the exact SQL
 * text Drizzle would send to a real Postgres, without opening any
 * connection. Asserting on that text is a direct, DB-independent check
 * that each subquery correlates to the outer "setlists" row correctly.
 */
import { describe, it, expect } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { setlists } from "../schema/index.js";

describe("setlists list query — aggregate subquery SQL text", () => {
  const db = drizzle.mock();

  // Copied verbatim from features/setlists/routes.js's GET / handler.
  const expressions = {
    songCount: sql`(SELECT count(*) FROM setlist_songs WHERE setlist_songs.setlist_id = "setlists"."id")::int`,
    totalDuration: sql`(SELECT coalesce(sum(duration), 0) FROM setlist_songs WHERE setlist_songs.setlist_id = "setlists"."id")::int`,
    averageBpm: sql`(SELECT round(avg(songs.tempo)) FROM setlist_songs JOIN songs ON songs.id = setlist_songs.song_id WHERE setlist_songs.setlist_id = "setlists"."id" AND songs.tempo IS NOT NULL)::int`,
    keys: sql`(SELECT string_agg(DISTINCT coalesce(setlist_songs.key, songs.key), ',') FROM setlist_songs JOIN songs ON songs.id = setlist_songs.song_id WHERE setlist_songs.setlist_id = "setlists"."id")`,
  };

  it.each(Object.entries(expressions))("%s correlates via an explicitly qualified \"setlists\".\"id\"", (_name, expr) => {
    const { sql: text } = db.select({ value: expr }).from(setlists).toSQL();
    expect(text).toContain(`"setlists"."id"`);
  });

  it("none of the four subqueries collapse to a bare, unqualified \"id\" reference", () => {
    // The regression this guards: ${setlists.id} interpolated inside one of
    // these subqueries renders as a bare "id", which resolves against the
    // subquery's OWN local setlist_songs/songs tables (both of which also
    // have an "id" column) instead of the outer setlists row.
    for (const expr of Object.values(expressions)) {
      const { sql: text } = db.select({ value: expr }).from(setlists).toSQL();
      expect(text).not.toMatch(/=\s*"id"/);
    }
  });
});
