/**
 * The song list payload is the contract the web library screen is built on:
 * `useSongLibrary` loads the whole library once and `lib/song-search.ts`
 * filters over the fields it gets back. A column dropped from that select is
 * invisible to the other song tests, which mock the query chain and so return
 * whatever the test hands them — `year` went missing this way and shipped.
 *
 * An end-to-end check is not available: the list select carries a correlated
 * `lastPlayed` subquery that pg-mem cannot execute ("column songs.id does not
 * exist"), and the query is correct in real Postgres, so it is not worth
 * reshaping production SQL to suit the harness. This guards the source
 * instead, in the same spirit as the static guard on the `${table.column}`
 * subquery bug.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(__dirname, "../features/songs/routes.js"), "utf8");

/** The select block of `GET /songs`, identified by its `lastPlayed` subquery. */
function listSelectBlock() {
  const marker = SOURCE.indexOf("lastPlayed:");
  expect(marker, "the song list select should still carry lastPlayed").toBeGreaterThan(-1);
  const start = SOURCE.lastIndexOf(".select({", marker);
  const end = SOURCE.indexOf(".from(songs)", marker);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return SOURCE.slice(start, end);
}

describe("GET /songs payload", () => {
  // Every field the web library actually reads off a list row.
  const REQUIRED = [
    "id", // row links
    "title", // row, search, A to Z grouping
    "aka", // search
    "artist", // row, search
    "tags", // search, and the other session's grouping work
    "key", // key pill
    "tempo",
    "year",
    "isDraft", // the drafts toggle
  ];

  it.each(REQUIRED)("selects %s", (field) => {
    expect(listSelectBlock()).toMatch(new RegExp(`\\b${field}:\\s*songs\\.${field}\\b`));
  });

  it("keeps year, which was missing from this select once already", () => {
    expect(listSelectBlock()).toMatch(/\byear:\s*songs\.year\b/);
  });
});
