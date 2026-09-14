# Handoff: the data is in, the app surface is yours

This describes what the corpus work has put into the database, so the app-side
session can build on it without re-deriving anything. Nothing here needs a
schema change.

## Where things stand

Production (`prd-vpc-music`, org **VPC Band**) holds **889 visible songs** — up
from 399 — plus 20 archived duplicates. `pnpm corpus:load production --org
"VPC Band" --fields all` is idempotent: a re-run reports `0 to insert, 0 to
update, 889 unchanged`. It is the ONLY writer into `songs`; the legacy bulk
importer is deleted.

| | count |
|---|---|
| songs visible | 889 |
| not a draft (the "ready" list) | 527 |
| drafts | 362 |
| labelled `status = missing_chords` | 194 |
| with an artist | 275 across 168 names |
| with a key | 684 |
| with a tempo | 308 |
| carrying `theme:` tags | 773 |
| carrying `flag:unlisted` | 39 (5 also `flag:secular`) |
| with an `aka` | 23 |
| lyrics only, no chords | 346 |

## What is already in the data that the app does not show

### 1. Audio and chart PDFs — the biggest unused asset

**378 songs carry 1,542 audio links** and **371 link their original chord-chart
PDF.** They live in the song's ChordPro body as `x_*` directives, so they are
already on every row of `songs.content` — no join, no media table, no upload.

```
{x_audio_soprano: https://s3.us-central-1.wasabisys.com/proj-vpcmusic/v1/prd/media/songs/holy-ghost--f162ec06/audio/soprano.mp3}
{x_audio_alto: …}
{x_audio_tenor: …}
{x_audio_full_mix: …}
{x_audio_loop_144_5bpm: …}
{x_chart_chord_chart: …}
{x_dropbox: https://www.dropbox.com/scl/fo/…&subpath=…}
```

Coverage: soprano 321, alto 323, tenor 318, full mix 124, loops 83+.

**Built 2026-09-14.** The chart page reads these with `songMedia(directives)`
in `apps/web/src/lib/song-media.ts`, which orders parts for a singer, labels
stems by instrument and loops by tempo, and drops empty values. The old
`mediaLinksFrom` in `apps/api/src/corpus/enrich.js` was never imported and has
been deleted.

**A directive key appears at most once** — the parser keeps the last value —
which is why every media file gets its own key rather than repeating `x_media`.

A vocalist opening a song and tapping "Alto" is the church-choir use case.

**It did not need only UI.** The bucket behind these URLs is private, so a
plain `<audio src>` gets 403. `GET /songs/:id/media/:key` checks the caller can
see the song and answers 302 to a presigned URL valid for 15 minutes. It signs
only URLs on the configured endpoint and bucket, because song content is
editable and the stored URL is untrusted. The app addresses media by directive
key through `songsApi.mediaHref`; never link a stored media URL directly.

### 2. `songs.tags` carries four namespaces

Parse it with `parseTagField` from `@vpc-music/shared` — never `split(",")`:

| value | meaning |
|---|---|
| `hymn` | a plain tag someone typed |
| `theme:blood` | a theme the lexicon detected from the lyrics |
| `!theme:blood` | a human said no — a tombstone, not an absence |
| `flag:unlisted` | the old site's `~` prefix: kept out of the default list |

`flag:unlisted` is **not access control** — the song still opens from a direct
or shared link. Anything that rewrites the column must carry every namespace
through, or it deletes data (this was a real bug: the theme pass dropped flags).

### 3. `songs.status` now means something

194 songs carry `status = "missing_chords"`: a finished lyrics sheet with no
chords. They are still drafts today, and they should probably stop being —
they are complete as lyrics, and the church wants them findable. The reason
they are still hidden is that nothing in the UI distinguishes them yet, so
un-drafting them would put 194 chord-less rows into the list unlabelled.
Render the status and the switch is a one-line change on the corpus side.

177 PDF charts came OUT of draft because the publisher's own Nashville number
chart agrees with them (`corpus/verified.json`, `{x_verified:}` on each chart).
That is what took the ready list from 350 to 527.

### 4. Derived facts live in `shared/utils/library.js`

`songCompleteness`, `tempoBand`, `completenessBand`, `hasChords`,
`parseTagField`, `SONG_FLAGS`. Completeness is **derived, never stored** — a
column would be a cache of six fields in the same row and every write path
would have to remember to recompute it. The web app, the API and the corpus
scripts all read this one module, so a percentage means one thing everywhere.

## The four jobs worth doing on the app side

Listed with what each already has.

1. **Media playback on the chart page.** Data is done (above). Needs: a control
   row on `SongChartPage`, and a decision about whether audio belongs in the
   offline cache (the files are large; the PWA caches charts today).
2. **Bulk metadata editing.** Tranche 4 pairs the filters with "the bulk
   metadata editing that makes those filters worth having". `/library` already
   filters to a set and puts it in the URL (`/library?missing=artist&key=Bb`);
   what is missing is selecting rows and setting artist/key/tempo/tags in one
   pass. `PATCH` per song exists; a bulk endpoint does not.
3. **Set lists and perform mode.** Already written, compiled and tested but
   unrouted: `pages/setlists/*`, `components/setlists/*`, `hooks/useConductor.ts`.
   This is tranche 2, the current tranche.
4. **Search cannot see album or writers.** `matchesQuery` in
   `apps/web/src/lib/song-search.ts` looks at title, aka, artist and tags. 211
   songs carry `{x_album:}` and 112 carry `{x_writers:}` in their body, findable
   only through the slower server-side lyric search.

## Rules that hold the data together

- `corpus/` is the durable copy; Postgres is a projection that can be dropped
  and rebuilt. The chart FILE is the complete record, not the manifest.
- `deterministicSongId` is frozen. Production rows carry these ids and a stock
  `uuidv5()` will not reproduce the namespace — call the function. Two literal
  ids are pinned in `scripts/corpus-build.test.mjs`.
- Themes only ever get ADDED. A rejection is stored as `!theme:x`.
- Nothing is ever deleted. A duplicate is `supersede` in the manifest and
  `is_archived` in the database, and `POST /songs/:id/unarchive` reverses it.
- Run `pnpm sync:shared` after any `shared/` edit; CI fails on drift.

## What no amount of data work will fix

Measured, not assumed:

- **614 songs have no artist** and there is no offline source for them. Only 6
  retired duplicate copies carry an artist, and none of their winners lack one.
  The master index has source URLs but no artist column. This needs a web
  lookup or a person.
- **587 have no tempo.** The media filenames are exhausted: of 168 folders
  carrying an unambiguous BPM, 150 have already been applied and 3 remain.
- **191 of the 205 keyless songs have no chords** to infer a key from.
- **888 of 889 have no year**, and none is obtainable.
