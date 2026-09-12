# `corpus/` — the songs, as files

This directory is the **durable copy of every song**. The database is a
projection of it. Drop Postgres and nothing is lost; rebuild it with
`corpus:load`.

```
 sources ─[corpus:build]─▶ corpus/ ─[corpus:load]─▶ songs table ─▶ app
                              ▲                          │
                              └──────[corpus:export]─────┘
```

## Do not hand-edit these files

`corpus/` is **build output**. Nothing in `apps/` reads it at runtime.

- To change a song, edit it **in the app** and run `corpus:export`.
- To re-derive from the legacy sources, run `corpus:build`.

The loader verifies every file against `contentSha256` in the manifest and
**fails loudly** if a file was edited by hand, because a hand-edited corpus is
exactly how this turns back into the old file-library the database replaced.

## Layout

| Path | What it is |
|---|---|
| `manifest/<source>.json` | One record per **song**: id, title, file, content hash, metadata, provenance, confidence, decision |
| `sources/<source>.json` | One record per **source file**: path, size, mtime, hash, decision, song id. The coverage ledger |
| `songs/<source>/<slug>--<id8>.chopro` | The chart itself, the exact bytes that land in `songs.content` |
| `media/<tree>.ndjson` | Inventory of audio and notation files. Paths and hashes only — never the bytes |

Filenames carry the first 8 characters of the song id because titles collide:
the library has 18 draft/final pairs (`jesus_is.chrd` and `~jesus_is.chrd`) and
the UPCI tree repeats folder names across years.

## Identity

A song's id comes from `deterministicSongId()` in
`apps/api/src/corpus/identity.js` — a UUID v5 over a **frozen** 16-byte
namespace. Rows already exist in production with these ids, so the namespace
must never change, and a stock `uuidv5()` will not reproduce it.

The manifest is the identity ledger. Once minted, an id is **read, not
re-derived**, so renaming or re-filing a source file keeps its song rather than
orphaning a database row. A moved file is recognised by content hash.

## Determinism

An unchanged source tree must produce a **byte-identical** corpus. No file here
contains a run timestamp — that lives in the gitignored report under
`apps/api/import-reports/`. If `git diff` shows churn after a rebuild with no
source change, that is a bug.

## Commands

```bash
pnpm corpus:build --source chrd --tree <path> [--dry-run] [--exclude <glob>]
pnpm corpus:scan  --tree <path> [--ledger <file>] [--rehash] [--fail-on new]
```

`corpus:scan` reports covered / new / changed / moved / gone. It is built for a
19 GB shared folder: it compares size and mtime first, hashes only what changed,
and **never opens a media file** — reading a cloud placeholder would hydrate
gigabytes.
