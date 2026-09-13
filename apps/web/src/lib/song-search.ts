import { parseTagField } from "@vpc-music/shared";
import type { Song } from "@/lib/api-client";

/** Lowercase, strip accents and apostrophes, collapse whitespace. */
export function normalize(text: string | null | undefined): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * What a query is matched against: the title, the alternate title, the artist,
 * the tags a person typed, and the themes detected from the lyrics.
 *
 * The tag column carries four namespaces, so it cannot go in raw. A negated
 * theme (`!theme:healing`) records that someone said the song is NOT about
 * healing, and matching it would return the exact songs a person ruled out.
 * Flags (`flag:unlisted`) are properties, not subjects, so searching "flag"
 * should not return a third of the library.
 */
export function searchHaystack(song: Pick<Song, "title" | "aka" | "artist" | "tags">): string {
  const { tags, themes } = parseTagField(song.tags);
  return normalize(
    [song.title, song.aka, song.artist, ...tags, ...themes.map((theme) => theme.replace(/-/g, " "))]
      .filter(Boolean)
      .join(" "),
  );
}

/** Every word of the query must appear somewhere in `searchHaystack`. */
export function matchesQuery(song: Pick<Song, "title" | "aka" | "artist" | "tags">, query: string): boolean {
  const tokens = normalize(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = searchHaystack(song);
  return tokens.every((token) => haystack.includes(token));
}

/** Alphabetical by title, the way the old site listed everything. */
export function sortForList<T extends Pick<Song, "title">>(songs: T[]): T[] {
  return [...songs].sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" }));
}

export interface LetterGroup<T> {
  letter: string;
  songs: T[];
}

/** A to Z groups for sticky letter headers; titles that start with anything else go under "#". */
export function groupByLetter<T extends Pick<Song, "title">>(songs: T[]): LetterGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const song of songs) {
    const first = normalize(song.title).charAt(0).toUpperCase();
    const letter = /^[A-Z]$/.test(first) ? first : "#";
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter)!.push(song);
  }
  return [...groups.entries()].map(([letter, entries]) => ({ letter, songs: entries }));
}
