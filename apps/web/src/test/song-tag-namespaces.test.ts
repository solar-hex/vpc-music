import { describe, it, expect } from "vitest";
import { matchesQuery, searchHaystack } from "@/lib/song-search";

/**
 * The tag column carries four namespaces once the corpus loader has run:
 * a plain tag, `theme:x` detected from the lyrics, `!theme:x` recording that
 * a person ruled that theme out, and `flag:x` for properties like the old
 * site's tilde. Search used to join the raw column into its haystack, which
 * made "theme" match most of the library and, worse, made a ruled-out theme
 * match the very songs someone had rejected it for.
 */
const song = (tags: string | null) => ({ title: "Nothing But The Blood", aka: null, artist: "Robert Lowry", tags });

describe("search over namespaced tags", () => {
  it("matches a theme by name", () => {
    expect(matchesQuery(song("theme:blood"), "blood")).toBe(true);
  });

  it("matches a multi-word theme id written with spaces", () => {
    expect(matchesQuery(song("theme:holy-spirit"), "holy spirit")).toBe(true);
  });

  it("does not match a theme a person ruled out", () => {
    expect(matchesQuery(song("!theme:healing"), "healing")).toBe(false);
  });

  it("keeps a rejected theme out even when another theme is present", () => {
    const s = song("theme:blood,!theme:healing");
    expect(matchesQuery(s, "blood")).toBe(true);
    expect(matchesQuery(s, "healing")).toBe(false);
  });

  it("does not let the namespace words themselves match", () => {
    const s = song("hymn,theme:blood,flag:unlisted");
    expect(matchesQuery(s, "theme")).toBe(false);
    expect(matchesQuery(s, "flag")).toBe(false);
    expect(matchesQuery(s, "unlisted")).toBe(false);
  });

  it("still matches a plain tag someone typed", () => {
    expect(matchesQuery(song("hymn"), "hymn")).toBe(true);
  });

  it("still matches title and artist", () => {
    expect(matchesQuery(song(null), "lowry")).toBe(true);
    expect(matchesQuery(song(null), "nothing blood")).toBe(true);
  });

  it("builds a haystack without any namespace prefixes", () => {
    const haystack = searchHaystack(song("hymn,theme:holy-spirit,!theme:healing,flag:unlisted"));
    expect(haystack).toContain("hymn");
    expect(haystack).toContain("holy spirit");
    expect(haystack).not.toContain("theme:");
    expect(haystack).not.toContain("flag:");
    expect(haystack).not.toContain("healing");
  });

  it("survives an empty or missing tag column", () => {
    expect(matchesQuery(song(null), "blood")).toBe(true);
    expect(matchesQuery(song(""), "blood")).toBe(true);
  });
});
