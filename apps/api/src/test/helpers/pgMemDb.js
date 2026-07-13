/**
 * Real-database test helper — spins up an in-memory Postgres-compatible
 * engine (pg-mem), loads the actual schema, and returns a genuine Drizzle
 * `db`/`pool` pair. Unlike the hand-rolled chainable mocks used elsewhere in
 * this test suite (which only verify a route calls .insert()/.select() in
 * the right shape), this executes REAL SQL — real constraints, real
 * RETURNING, real serialization — so it catches bugs a shape-mock can't.
 *
 * Usage: `vi.mock("../../db.js", () => createPgMemDb())` at the top of a
 * test file, before importing the app.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { newDb } from "pg-mem";
import { drizzle } from "drizzle-orm/node-postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_SQL = readFileSync(join(__dirname, "schema.sql"), "utf8");

export function createPgMemDb() {
  const memDb = newDb({ autoCreateForeignKeyIndices: true });
  memDb.public.registerFunction({
    name: "gen_random_uuid",
    returns: "uuid",
    implementation: randomUUID,
    // Without this, pg-mem treats the function as pure and memoizes its
    // result per query shape — every row in a multi-row context (or every
    // call across reused query plans) gets the SAME "random" id.
    impure: true,
  });
  memDb.public.none(SCHEMA_SQL);

  const { Pool } = memDb.adapters.createPg();
  const pool = new Pool();

  // pg-mem's pg adapter doesn't support two query-config options that
  // drizzle-orm/node-postgres always attaches: a custom `types.getTypeParser`
  // (for parameterized queries, safe to drop — pg-mem has its own internal
  // type system) and `rowMode: "array"` (for RETURNING/insert queries,
  // which Drizzle relies on to positionally map results back to named
  // columns using its own metadata). Dropping `rowMode` outright silently
  // corrupts every .returning() call — pg-mem still returns object rows, so
  // Drizzle zips its column list against object values instead of an array
  // and every field comes back undefined. Instead, re-shape the *result*
  // into array rows (using the field order pg-mem itself reports) so
  // Drizzle gets exactly what it asked for.
  const realQuery = pool.query.bind(pool);
  pool.query = async (config, ...rest) => {
    if (!config || typeof config !== "object" || !("types" in config || "rowMode" in config)) {
      return realQuery(config, ...rest);
    }
    const { types, rowMode, ...clean } = config;
    const result = await realQuery(clean, ...rest);
    // pg-mem doesn't populate result.fields for this adapter path, so fall
    // back to the row objects' own key order (JS preserves string-key
    // insertion order, and pg-mem's row keys already match the SQL column
    // list — e.g. `returning "id", "name"` — since that's what it selected).
    if (rowMode === "array" && Array.isArray(result.rows) && result.rows.length > 0) {
      const columns = Object.keys(result.rows[0]);
      result.rows = result.rows.map((row) => columns.map((name) => row[name]));
    }
    return result;
  };

  const db = drizzle(pool);
  return { db, pool };
}
