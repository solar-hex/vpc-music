# VPC Music

Lead sheets for a church worship team. Sign in, type a few letters, open the chart, change the key, put the phone on the music stand. It replaces the old PHP "Lead Sheets" site and keeps its two-screen simplicity while adding a real ChordPro engine, an editor, imports and exports, offline use and sign-in.

## How it is built

Work lands in layered tranches, each usable on its own:

| Tranche | Delivers |
|---|---|
| 1. Core (done) | Sign in, song list, full-screen chart, editor and file import, one settings page, the old `.chrd` library importer |
| 2. Set lists + perform | Ordered sets with per-song keys, perform mode, print, share link, mark played |
| 3. Scheduling | A set list gets a date; upcoming list; simple month view |
| 4. Backend de-scope | Remove unused API modules, tables and env vars |

Principles: the chart is the product; one way to do each thing; mobile first; delete rather than hide; every tranche ships with all test suites green.

## Stack

- **Web** (`apps/web`): React 19, Vite 7, Tailwind 4, react-router 7, CodeMirror 6 for the editor, `vite-plugin-pwa` for offline use.
- **API** (`apps/api`): Express, Drizzle ORM on Postgres, JWT cookie sessions (180 days, renewed on use), email/password and Google sign-in via Passport, Mailgun for invites and password resets.
- **Engine** (`shared/`): ChordPro parser and serializer, transposition with target-key spelling, Nashville numbers, bar grids, chord shapes, plain-text and OnSong exporters, and the `.chrd` converter. `apps/api/shared/` is a vendored copy kept in sync by `pnpm sync:shared` and checked by `node scripts/check-shared-drift.mjs`.

## Running it

```
pnpm install
cp apps/api/.env.example apps/api/.env   # point DATABASE_URL at a database you own
pnpm dev                                 # web on http://localhost:5176, API on :3001
```

`pnpm docker:up` starts a local Postgres from `compose.yml`; `pnpm db:push` applies the Drizzle schema and `pnpm db:seed` adds a demo team. Check which database your env file points at before running anything that writes.

Other commands:

```
pnpm typecheck
pnpm test            # web tests (vitest + jsdom)
pnpm test:api        # API tests (vitest + pg-mem, no Postgres needed)
pnpm test:scripts    # workspace script tests
pnpm test:all        # all three, what CI runs
pnpm lint
pnpm build:web       # static build in apps/web/dist
pnpm preflight       # typecheck + tests + shared drift check
```

### Environment variables

API (`apps/api/.env.<env>`): `DATABASE_URL`, `PORT`, `NODE_ENV`, `JWT_SECRET`, `JWT_EXPIRES_IN` (default `180d`), `CORS_ORIGIN`, `FRONTEND_URL`, `PDF_CO_API_KEY` (PDF import), `MAILGUN_DOMAIN`, `MAILGUN_API_KEY`, `MAILGUN_API_BASE_URL`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`.

Web: `VITE_API_URL` (empty for the dev proxy), `VITE_SANDBOX` (demo sign-in buttons), `VITE_VAPID_PUBLIC_KEY`, `VITE_LOG_VERBOSE`.

### Deploying

The API runs on DigitalOcean App Platform from `.do/app.yaml` (production) and `.do/app.stg.yaml` (staging); CI builds the Docker image and deploys staging on pushes to `develop`. `pnpm deploy staging|prd` runs `apps/api/deploy.ps1` for a manual deploy. The web app is the static `apps/web/dist` build (nginx config under `deploy/nginx`).

## The app

| Route | What it is |
|---|---|
| `/login` | Email/password or Google. Sessions last months; a link opened while signed out returns there after sign-in. |
| `/songs` | The whole library, loaded once and kept on the device. One box filters by title, alternate title, artist and tags; drafts stay hidden until asked for; lyric matches come from the server. |
| `/songs/:id` | The chart, full screen: key picker, transpose, Nashville numbers, comments toggle, text size, keep-awake, theme, print, downloads, share link, log a play. The key lives in the URL (`?key=Bb`, or `?t=2` for keyless charts). |
| `/songs/new`, `/songs/:id/edit` | Title, artist, year, key, tempo, tags, draft, and one CodeMirror ChordPro editor with an Insert menu, Format, validation and a chord popup. Import a file for review, or many files at once. |
| `/settings` | Profile, Appearance (theme, key spelling, chord colours), Team (admins: invite, roles, rename), Data (import, download the library as a ZIP), About. |
| `/shared/:token` | A public read-only chart. |

Roles: observers read, musicians edit songs, admins (worship leaders) manage the team. One church per deployment.

## ChordPro conventions

- `{title:}`, `{artist:}`, `{key:}`, `{tempo:}`, `{year:}`, `{capo:}`, `{define:}` as in the ChordPro spec.
- `{comment: Verse 1}` is a section header. The section jump bar and the editor's chips are built from these.
- `{ci: text}` is an italic note line inside a section (the old site's `*` lines). The chart's Comments toggle hides them.
- `[G]` is a primary chord. `[*ab]` is a secondary chord annotation (the old site's `^` line): it stacks above the primary chord at the same lyric position, in the secondary colour, and transposes with the song.

## Importing the old library

`.chrd` files convert with `shared/utils/chrd.js`. Preview a folder file by file:

```
pnpm migrate:chrd <source-dir> <output-dir>
```

Load a folder straight into a team's songs (idempotent: re-runs update changed files and never delete):

```
pnpm import:chrd [dev|staging|production] --dir <path> --org <name|uuid> [--created-by <email>] [--dry-run] [--exclude <glob>]
```

Drafts come from the `~` filename prefix. A JSON and text report lands in `apps/api/import-reports/` listing converter warnings, duplicate titles and collisions with existing songs. Always dry-run first.

## The corpus

`corpus/` holds every song as a ChordPro file, committed. It is the durable copy of the library: the database is a projection of it that can be dropped and rebuilt. Each `.chopro` file is the **complete record** — artist, tempo, derived themes, links to its audio and charts, and where it came from all live in the file's directive block, so a song never depends on a side table to be understood.

```
corpus/
  manifest/<source>.json    one record per song: id, title, file, hash, themes
  sources/<source>.json     one record per source file: the coverage ledger
  media/<tree>.ndjson       media inventory — paths, keys and sizes, never bytes
  songs/<source>/<slug>--<id8>.chopro
  themes.json               the theme lexicon; edit it and re-run
  stats.json                the library, counted
```

```
pnpm corpus:build --source chrd|docx --tree <path> [--dry-run]
pnpm corpus:scan  --tree <path>            # covered / new / changed / moved / gone
pnpm corpus:media --tree <path> [--apply]  # media to Wasabi; dry run by default
pnpm corpus:stats                          # coverage, themes, completeness
pnpm corpus:reader                         # dist/songbook.html — one offline file
pnpm gap:report                            # what the church wants that we do not have
pnpm gap:resolve                           # "probably here under another name" → aliases
```

A rebuild of an unchanged tree produces a **byte-identical** corpus, so `git diff` only ever shows real content changes. Run metadata goes to the gitignored report, never into a committed file.

`corpus:scan` is built for a 19 GB shared folder: it compares size and mtime first, hashes only what changed, and never opens a media file — reading a cloud placeholder would pull gigabytes down. A renamed or re-filed source is matched by content hash and keeps its song rather than orphaning a row.

### The songbook

`pnpm corpus:reader` builds `dist/songbook.html`: one self-contained file with every chart, no server and no network. It embeds the real shared engine, so transposition behaves exactly as it does in the app. This is deliberately not the PWA — the PWA is the *app* working offline; the songbook is a *document* that outlives the app, the database and the hosting.

### The library page

`/library` in the app is the same roll-up as `pnpm corpus:stats`, over whatever is in
the database: coverage per field, completeness, tempo bands, themes, artists — and every
number is a filter, so tapping "Artist 284 / 1058" lists the songs with no artist. It reads
the copy of the library already on the device, so it works offline and costs no endpoint.
The derivation is shared (`shared/utils/library.js`), so the percentages on screen are the
percentages the build reports. Filters live in the URL: `/library?missing=artist&key=Bb`.

### What is still missing

`pnpm gap:report` measures the library against the two song lists the church keeps:
465 curated titles with a status, and an 8,234-title index that records the website each
one came from. Both are read straight out of the `.xlsx` and committed to `corpus/lists/`
as NDJSON, so every later run reproduces from git rather than from someone's Dropbox:

```
pnpm gap:report --targeted <TargetedSongList.xlsx> --master <FullSongList.xlsx>   # refresh
pnpm gap:report                                                                   # re-run
```

It is read-only, and the 8,234-title index is deliberately never loaded into the database —
it would bury a 1,058-song library under 7,000 ghosts and break every count. The report
groups what is missing **by source website**, because sourcing is a batch job you work one
site at a time, and lists the songs in neither external list separately: no website will
ever supply their artist, so they are the manual-enrichment priority.

### Dropping files in

`intake/inbox/` takes anything — PDFs, Word documents, `.chrd`, `.onsong`, audio. `pnpm intake` says what it would do with each; `pnpm intake --apply` files them into `processed/`, `duplicate/`, `media/` or `rejected/` and records the decision in `intake/log.ndjson`. See `intake/README.md`.

## Repository map

```
apps/web/src
  pages/        songs (list, chart, edit), settings, auth, shared views
  components/   songs (renderer, toolbar, editor, import), layout, ui, shared
  hooks/        useSongLibrary, useWakeLock, useKeyboardShortcuts
  lib/          api-client, song-search, song-import, chart-prefs, offline-cache
apps/api/src
  routes/auth.js, features/<module>/routes.js, schema/, test/ (pg-mem harness)
shared/utils    chordpro, transpose, nashville, chart, chrd, onsong, plainText
scripts/        db-push, import-chrd-library, migrate-chrd-library, sync-shared, preflight
docs/archive    the original PRD, role model and editor notes
```

`CHANGELOG.md` records what changed and why. `CONTRIBUTING.md` has the working agreements.
