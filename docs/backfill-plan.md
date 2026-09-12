# Backfilling the library

What is missing, where it can come from, and the order to do it in. Measured
2026-09-12 with `pnpm corpus:stats` over 752 corpus songs and a read-only query
against production (399 songs, org VPC Band).

## Where the gaps are

| Field | Have | Missing | Can it be derived? |
|---|---:|---:|---|
| Title | 752 | 0 | — |
| Themes | 615 | 137 | **Yes**, from lyrics — already done |
| Key | 409 | 343 | Partly: the `.chrd` line-2 key; a `.docx` rarely has one |
| Tempo | 54 | 698 | **Partly**, from media filenames (`My-Help-loop-bpm77.mp3`) |
| Artist | 3 | 749 | **No.** It never existed in the source |
| Year | 1 | 751 | No |

Artist is the one that matters and the one nothing local can answer. Grepping
all 399 legacy `.chrd` files for metadata yields exactly two values —
`Author: John Newton` and `Year: 1779`, both in `amazing_grace.chrd`. There is
nothing to backfill *from*; it has to be sourced or typed.

## Order of work

Cheapest and safest first. Everything before stage 4 is reversible and touches
no database.

### 1. Derived, already in the files — done

Themes (1,485 labels across 615 songs), media links, Dropbox provenance and
derived tempo now live in each `.chopro` file as `x_*` directives. Rebuilds are
byte-identical, so re-running is free.

### 2. Tempo from media — done for what exists

54 songs carry a tempo, up from 25, read out of loop filenames. The ceiling is
low for a reason: only ~100 songs have media at all, because 243 media folders
belong to songs with no chart in the library.

Remaining lever: **convert the UPCI chord charts**. Those PDFs carry title,
artist (`Sinach`), key (`Key: B`) and chords as real text, and there are ~291 of
them. This is the single largest untapped source of both songs and metadata,
and it needs the local PDF extractor (`pdfjs-dist`, reusing steps 2–7 of
`pdfToChordPro.js`). Not built yet.

### 3. Artist — needs a decision, not a script

Options, roughly in order of value for effort:

1. **UPCI chord charts** carry the artist in the header. Converting them fills
   in artist for the songs they cover, and adds ~291 new charts besides.
2. **The chorusbooks** in the Dropbox `Song Lists/` folder
   (`0-Complete-Chorusbook-with-Intro-and-Index.pdf`) may carry attributions
   for the older material, which is where most of the 749 gaps are.
3. **Bulk entry in the app**, once tranche 4's multi-select edit exists. Slow,
   but it is the only route for VPC-specific songs that appear in no external
   index — and 144 of the library's songs appear in neither master list.

Do not guess an artist from a title. A wrong attribution is worse than a blank.

### 4. Loading into Postgres — the first thing that writes

Production is live with 399 songs, and every corpus `.chrd` id already matches
a production row, so this is an update in place, never a duplicate.

Order, each with a dry run first and the plan shown before it writes:

1. **`corpus:load --fields tags`** — write the 1,485 theme labels into
   `songs.tags`. Additive, and the importer excludes `tags` from its
   fingerprint, so a re-import can never clobber them. Reversible: the tags
   column is ours alone.
2. **`corpus:load --fields core`** — refresh title/key/artist/year/tempo/content
   for the 399, picking up derived tempo. Same seven fields the existing
   importer owns, same ids.
3. **The 353 `.docx` songs** — a separate decision, below.

Nothing in stages 1–3 writes, so they can be redone freely. Stage 4 needs
explicit approval per run, and `apps/api/.env` points at production.

## Three decisions that shape the rest

**The 345 lyrics-only songs.** They would nearly double the library with charts
that have no chords. They are all drafts and all low confidence, so the app
hides them by default — but they will show up in search. Either they go in as
drafts, or they stay in the corpus until someone adds chords.

**169 duplicate titles.** A supersede pass is needed before loading, or pairs
appear in the app. The converter deliberately never merges: it proposes, a
human disposes. The `.chrd` side should win wherever both exist, since the
`.docx` side is usually lyrics-only.

**508 rhythm and vocal PDFs.** Confirmed to have no text layer at all — they
are engraved Sibelius notation. They cannot become songs; they are media, and
they are already in Wasabi.

## What a complete song looks like

```
{title: Holy Ghost}
{key: Bb}
{tempo: 150}
{x_tempo_source: derived from media filename}
{x_theme: holy-spirit, revival, baptism, healing, praise, victory}
{x_source: chrd:~holy_ghost.chrd}
{x_dropbox: https://www.dropbox.com/scl/fo/…&subpath=%2FUPCI…%2FHoly%20Ghost}
{x_audio_soprano: https://s3.us-central-1.wasabisys.com/proj-vpcmusic/v1/prd/…}
{x_audio_alto: …}
{x_audio_tenor: …}
{x_chart_chord_chart: …}
```

Everything about the song is in the song. The manifest indexes the files; it is
not a second home for their metadata.
