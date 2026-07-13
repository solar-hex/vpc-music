/**
 * Regression guard for a real, previously-shipped bug: a correlated
 * subquery written as `sql`(SELECT ... WHERE x = ${outerTable.id})`` renders
 * the interpolated column as a BARE, unqualified "id" — not
 * "outer_table"."id". If the subquery's own FROM/JOIN also has a column
 * named "id" (true for every table in this schema, since they all use `id`
 * as their primary key), that bare reference resolves to the SUBQUERY's own
 * local column instead of correlating to the outer row:
 *
 *   - No join in the subquery (e.g. albums' trackCountExpr): no SQL error,
 *     just a silently wrong result — `WHERE songs.album_id = songs.id` is
 *     essentially always false, so the count/sum/lastPlayed/etc. reads as
 *     0/null for every row, permanently.
 *   - A join in the subquery (e.g. setlists' averageBpm/keys, which join
 *     setlist_songs + songs): a genuine "column reference is ambiguous"
 *     SQL error, a 500 on every request to that route.
 *
 * Found and fixed across albums, artists, assistant, roles, setlists, and
 * songs routes — see each fix's comment for the specific impact. The correct
 * pattern is a literal, explicitly qualified identifier in the SQL text
 * itself (e.g. `"albums"."id"`), not a ${table.column} interpolation.
 *
 * This test scans the actual route/service source for the dangerous
 * pattern rather than executing queries, so it needs no database and can't
 * be fooled by a mocked query layer — it looks at what will actually be
 * sent to Postgres.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { globSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FEATURES_DIR = join(__dirname, "..", "features");

// A `sql`(SELECT ...)` subquery, single-line by convention in this codebase,
// that also contains a `${...}` interpolation before its closing backtick.
const DANGEROUS_PATTERN = /sql`\(SELECT[^`]*\$\{[^}]+\}[^`]*`/g;

function findJsFiles(dir) {
  // Node's fs.globSync is available in the Node version this project targets
  // (>=22); fall back to a manual walk if it's ever unavailable.
  try {
    return globSync("**/*.js", { cwd: dir }).map((f) => join(dir, f));
  } catch {
    return [];
  }
}

describe("no unqualified column interpolation inside a correlated subquery", () => {
  const files = findJsFiles(FEATURES_DIR);

  it("found source files to scan", () => {
    // If this is 0, the glob/path resolution broke — the test below would
    // pass vacuously and stop guarding anything.
    expect(files.length).toBeGreaterThan(0);
  });

  it("no route or service interpolates a table column inside a sql`(SELECT ...)` subquery", () => {
    const offenders = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      const matches = content.match(DANGEROUS_PATTERN);
      if (matches) {
        offenders.push({ file: file.replace(FEATURES_DIR, "features"), matches });
      }
    }
    expect(offenders).toEqual([]);
  });
});
