import { describe, expect, it } from "vitest";
import { cleanArtist, loadArtistTable, normalizeArtist, normalizeCredits } from "../corpus/artists.js";

describe("cleanArtist", () => {
  it("tidies whitespace, quotes and stray separators", () => {
    expect(cleanArtist("  CeCe  Winans ")).toBe("CeCe Winans");
    expect(cleanArtist("Sinach –")).toBe("Sinach");
    expect(cleanArtist("O’Brien")).toBe("O'Brien");
    expect(cleanArtist(null)).toBe("");
  });
});

describe("normalizeArtist", () => {
  it("spells the name out and keeps the common short form searchable", () => {
    expect(normalizeArtist("Indiana Bible College")).toBe("Indiana Bible College (IBC)");
    expect(normalizeArtist("IBC")).toBe("Indiana Bible College (IBC)");
    expect(normalizeArtist("Texas Bible College")).toBe("Texas Bible College (TBC)");
  });

  it("canonicalises casing, so a lowercase credit still reads properly", () => {
    expect(normalizeArtist("indiana bible college")).toBe("Indiana Bible College (IBC)");
    expect(normalizeArtist("INDIANA BIBLE COLLEGE")).toBe("Indiana Bible College (IBC)");
  });

  it("never doubles a short form the chart already carried", () => {
    expect(normalizeArtist("Indiana Bible College (IBC)")).toBe("Indiana Bible College (IBC)");
  });

  it("folds known variants onto one name", () => {
    expect(normalizeArtist("Charity Gale")).toBe("Charity Gayle");
    expect(normalizeArtist("Hillsong")).toBe("Hillsong Worship");
    expect(normalizeArtist("Elevation")).toBe("Elevation Worship");
    expect(normalizeArtist("Maverick City")).toBe("Maverick City Music");
  });

  it("leaves an artist it has no opinion about exactly as written", () => {
    // Collectives and joint credits must survive intact.
    expect(normalizeArtist("J.J. Hairston & Youthful Praise")).toBe("J.J. Hairston & Youthful Praise");
    expect(normalizeArtist("David & Nicole Binion")).toBe("David & Nicole Binion");
    expect(normalizeArtist("CeCe Winans")).toBe("CeCe Winans");
  });

  it("drops publisher and placeholder credits rather than storing them", () => {
    // "UPCI Music" is the label on their own releases, not an artist.
    expect(normalizeArtist("UPCI Music")).toBeNull();
    expect(normalizeArtist("Unknown")).toBeNull();
    expect(normalizeArtist("")).toBeNull();
    expect(normalizeArtist(null)).toBeNull();
  });

  it("keeps a credit as printed where there is no table, as on the API server", () => {
    // The API image carries no corpus; the in-app PDF import must still work.
    const tablePath = "/nowhere/corpus/artists.json";
    expect(normalizeArtist("IBC", { tablePath })).toBe("IBC");
    expect(normalizeCredits({ artist: "Charity Gale", writers: "A, B" }, { tablePath }).artist).toBe("Charity Gale");
  });

  it("ships a table whose aliases all resolve", () => {
    const t = loadArtistTable();
    for (const target of Object.values(t.aliases)) {
      expect(typeof target).toBe("string");
      expect(target.length).toBeGreaterThan(1);
    }
    // every initialism key must be a spelled-out name, not itself an acronym
    for (const name of Object.keys(t.initialisms)) {
      expect(name.split(/\s+/).length).toBeGreaterThan(1);
    }
  });
});

describe("normalizeCredits", () => {
  it("separates the performer from the songwriters", () => {
    expect(
      normalizeCredits({ artist: "IBC", writers: "Brian Johnson, Chris Tomlin and Jason Ingram" }),
    ).toEqual({
      artist: "Indiana Bible College (IBC)",
      writers: "Brian Johnson, Chris Tomlin, Jason Ingram",
    });
  });

  it("de-duplicates writers and drops noise", () => {
    expect(normalizeCredits({ writers: "Jane Doe, Jane Doe, &, x" }).writers).toBe("Jane Doe");
  });

  it("returns nulls rather than empty strings", () => {
    expect(normalizeCredits({})).toEqual({ artist: null, writers: null });
  });
});
