/**
 * Integrity of the committed corpus.
 *
 * Runs in CI with no legacy source tree present — it reads only `corpus/`.
 * This is what makes committing the corpus worth the bytes: if any of these
 * fail, the corpus cannot be trusted as the durable copy of the library.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chartToText, parseChart, isSectionToken, isSecondaryToken, transposeToken } from "../shared/index.js";
import { deterministicSongId, normalizeTitle, sha256 } from "../apps/api/src/corpus/identity.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const corpusRoot = join(repoRoot, "corpus");
const manifestPath = join(corpusRoot, "manifest", "chrd.json");

const hasCorpus = existsSync(manifestPath);
const manifest = hasCorpus ? JSON.parse(readFileSync(manifestPath, "utf8")) : { songs: [] };
const ledger = hasCorpus
  ? JSON.parse(readFileSync(join(corpusRoot, "sources", "chrd.json"), "utf8"))
  : { files: [] };

/**
 * Malformed PRIMARY chord tokens inherited from the legacy library — unbalanced
 * brackets (`[C-Bb-[Ab]`, `[Eb/[Ab]`), a backslash for a slash (`[Eb\A]`),
 * doubled slashes (`[Am//G]`, `[Edim//Gb]`), typos (`[Abmy]`, `[-E-]`) and
 * stray digits. They are quarantined rather than dropped, per the rule book.
 *
 * This is a ratchet: the count must never grow. Measured at 15 on the 399-file
 * library; lowering it means a converter fix, which is welcome.
 *
 * Secondary (`*`-prefixed) tokens are deliberately excluded — the `^`-line
 * grammar (sustain runs `*-----`, "below" markers `*ab--f`, note runs) is
 * preserved raw on purpose, so it is not expected to parse as a chord.
 */
const MALFORMED_PRIMARY_TOKEN_BASELINE = 15;

const NON_CHORD_MARKERS = new Set(["N.C.", "n.c.", "NC", "nc", "x", "X", "|"]);

describe.skipIf(!hasCorpus)("committed corpus integrity", () => {
  it("has songs", () => {
    expect(manifest.songs.length).toBeGreaterThan(0);
  });

  it("has unique song ids", () => {
    const ids = manifest.songs.map((s) => s.songId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique corpus filenames", () => {
    const files = manifest.songs.map((s) => s.file);
    expect(new Set(files).size).toBe(files.length);
  });

  it("preserves the frozen production id derivation for every .chrd song", () => {
    // If this fails, ids drifted and every production row would orphan.
    const drifted = manifest.songs.filter(
      (s) => s.sources[0].role === "primary" && s.songId !== deterministicSongId(s.sources[0].path),
    );
    // Only sources recorded as `moved` may legitimately differ from their path.
    expect(drifted.map((s) => s.sources[0].path)).toEqual([]);
  });

  it("points every manifest entry at a file that exists", () => {
    const missing = manifest.songs.filter((s) => !existsSync(join(corpusRoot, s.file)));
    expect(missing.map((s) => s.file)).toEqual([]);
  });

  it("matches every content hash — no file was edited by hand", () => {
    const mismatched = [];
    for (const song of manifest.songs) {
      const content = readFileSync(join(corpusRoot, song.file), "utf8");
      if (sha256(content) !== song.contentSha256) mismatched.push(song.file);
    }
    expect(mismatched).toEqual([]);
  });

  it("round-trips every chart losslessly through the chart parser", () => {
    const broken = [];
    for (const song of manifest.songs) {
      const content = readFileSync(join(corpusRoot, song.file), "utf8");
      if (chartToText(parseChart(content)) !== content) broken.push(song.file);
    }
    expect(broken).toEqual([]);
  });

  it("never emits the double-bracket bug", () => {
    const doubled = manifest.songs.filter((song) =>
      readFileSync(join(corpusRoot, song.file), "utf8").includes("[["),
    );
    expect(doubled.map((s) => s.file)).toEqual([]);
  });

  it("keeps malformed primary chord tokens at or below the legacy baseline", () => {
    const malformed = [];
    for (const song of manifest.songs) {
      const content = readFileSync(join(corpusRoot, song.file), "utf8");
      for (const match of content.matchAll(/\[([^\]]*)\]/g)) {
        const token = match[1];
        if (!token) continue;
        if (isSecondaryToken(token)) continue; // `^`-line grammar, raw by design
        if (isSectionToken(token) || NON_CHORD_MARKERS.has(token)) continue;
        if (/^[|/\s]+$/.test(token)) continue;
        // The engine's own grammar: a token it can transpose is one it understands,
        // including hyphen/plus compound runs like [Bbm-Ab/C-Bbm/Db].
        if (transposeToken(token, 1) !== token) continue;
        malformed.push(`${song.file}: [${token}]`);
      }
    }
    expect(malformed.length).toBeLessThanOrEqual(MALFORMED_PRIMARY_TOKEN_BASELINE);
  });

  it("records every song in the source ledger", () => {
    const ledgerIds = new Set(ledger.files.filter((f) => !f.missingSince).map((f) => f.songId));
    const orphans = manifest.songs.filter((s) => !ledgerIds.has(s.songId));
    expect(orphans.map((s) => s.file)).toEqual([]);
  });

  it("carries an explicit decision for every duplicated title", () => {
    const byTitle = new Map();
    for (const song of manifest.songs) {
      const key = normalizeTitle(song.title);
      if (!byTitle.has(key)) byTitle.set(key, []);
      byTitle.get(key).push(song);
    }
    const duplicates = [...byTitle.values()].filter((group) => group.length > 1);
    // Duplicates are allowed — the draft/final pairs are real — but each song
    // must carry a decision so nothing is silently shadowed.
    for (const group of duplicates) {
      for (const song of group) {
        expect(song.decision, `${song.file} has no decision`).toBeTruthy();
      }
    }
  });

  it("writes no run timestamp into committed files", () => {
    // A timestamp would churn the diff on every rebuild.
    expect(JSON.stringify(manifest)).not.toMatch(/generatedAt/);
    expect(JSON.stringify(ledger)).not.toMatch(/generatedAt/);
  });
});
