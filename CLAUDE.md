# VPC Music — working notes for Claude

A worship team's lead-sheet app: sign in, find a song, put the chart on a music stand. It replaces the old PHP "Lead Sheets" site and keeps its simplicity.

## Principles

1. The chart is the product. Every screen exists to get a musician to a chart faster.
2. One way to do each thing: one search, one editor surface, one modal component (`components/ui/ResponsiveModal.tsx`), one settings page.
3. Mobile first: a phone on a music stand, then let it widen.
4. Delete, don't hide. Git history keeps what we remove.
5. Build in layered tranches, core outward. Every feature the codebase carries has a tranche; nothing sits in an open-ended backlog.

| Tranche | Delivers |
|---|---|
| 1. Core | Sign in, song list, chart, editor, settings, library import. Done. |
| 2. Offline library, then set lists + perform | Every chart kept on the device (a phone has to work at a church with no internet), then ordered sets with per-song keys, perform mode, print, share link, mark played |
| 3. Scheduling | A set list gets a date; upcoming list; simple month view |
| 4. Find and organise | Filter by artist / tag / key / tempo, sort orders, collections, favourites, archive, and the bulk metadata editing that makes those filters worth having |
| 5. More than one version | Song variations, per-instrument layers, per-person capo |
| 6. Marks and extra notation | Ink annotations, sticky notes, staff notation (ABC), media attachments, similar songs |
| 7. Team depth | Custom roles, activity log, notifications, analytics, artists and albums |
| 8. Backend de-scope | Delete only what tranches 1-7 leave unclaimed, then drop tables (approval + backup) |

Work on the current tranche. Do not build ahead into a later one without being asked, and do not delete a table a later tranche claims. Multi-church is deliberately outside the map. The plan with per-tranche outlines and a progress log lives at `C:\Users\The Catalyst\.claude\plans\i-would-like-you-eager-jellyfish.md`.

## Layout

- `apps/web` — React 19 + Vite 7 + Tailwind 4 + react-router 7, CodeMirror for the editor, PWA.
- `apps/api` — Express + Drizzle + Postgres, JWT cookie sessions (180 days, renewed on use), Google sign-in.
- `shared/` — the ChordPro engine (parse, transpose, Nashville, exporters, `.chrd` converter) plus `utils/library.js`, the derived facts (completeness, tempo bands, the `theme:`/`!theme:` tag grammar) that the corpus scripts and the `/library` page both read, so a percentage means one thing everywhere. `apps/api/shared/` is a vendored copy: after any edit under `shared/`, run `pnpm sync:shared`; CI fails on drift.
- Tranche-2 code (`pages/setlists/*`, `components/setlists/*`, `hooks/useConductor.ts`) stays in the tree, compiled and tested but unrouted.

## Commands

```
pnpm dev            # web on :5176, api on :3001
pnpm typecheck
pnpm test           # web (vitest, jsdom)
pnpm test:api       # api (vitest, pg-mem harness, no Postgres needed)
pnpm test:scripts
pnpm test:all       # what CI runs
pnpm lint
pnpm build:web
pnpm sync:shared && node scripts/check-shared-drift.mjs
pnpm import:chrd [env] --dir <path> --org <name|uuid> --dry-run

# the corpus — files first, database second
pnpm corpus:build --source chrd|docx --tree <path> [--dry-run]
pnpm corpus:scan  --tree <path>            # covered / new / changed / moved / gone
pnpm corpus:media --tree <path> [--apply]  # media to Wasabi; dry run by default
pnpm corpus:stats                          # the whole library, counted
pnpm corpus:reader                         # dist/songbook.html, one offline file
pnpm gap:report                            # targeted list vs the library, by source site
pnpm gap:resolve [--list|--approve <n>]    # alternate titles → corpus/aliases.json
pnpm intake [--apply]                      # file whatever is in intake/inbox/
```

Every tranche ships with typecheck, web, API and script tests green.

## The corpus

`corpus/` is the durable copy of every song; Postgres is a projection of it
that can be dropped and rebuilt. The pipeline is two-phase, and the phases are
separated by a file boundary so there is exactly one writer:

```
build:  sources → corpus/songs/*.chopro     (never touches a database)
load:   corpus  → songs table               (not built yet; needs approval)
```

Rules that hold the whole thing together:

- **A chart file is the complete record.** Artist, tempo, derived themes, media
  links and provenance live in the file's directive block as `x_*` directives,
  not in a side table. Nothing in the app renders unknown directives, so they
  travel with the chart invisibly. A directive key appears at most once — the
  parser keeps the last value — so every media file gets its own key.
- **Rebuilds are byte-identical.** No run timestamps in committed files; those
  go to the gitignored report. Churn after a no-op rebuild is a bug.
- **`deterministicSongId` is frozen.** Production rows carry these ids, and a
  stock `uuidv5()` will not reproduce the namespace. Call the function.
- **`corpus:scan` never opens a media file.** Reading a cloud placeholder
  hydrates gigabytes; identity for media is path + size + mtime, with a
  two-second tolerance because sync clients drift.
- **Themes only ever get added.** A human's rejection is stored as
  `!theme:blood`, so broadening `corpus/themes.json` never undoes a correction.
- **`songs.tags` holds four namespaces**, all parsed in `shared/utils/library.js`:
  a plain tag, `theme:x`, `!theme:x` (a rejection), and `flag:x` (a property of
  the song, not a subject). `flag:unlisted` is the old site's `~` filename
  prefix, which kept a song out of the default list — it is NOT access control.
  Anything that rewrites the column must carry every namespace through.

## ChordPro conventions

- `{comment: Verse 1}` is a section header. `{ci: text}` is an italic note line inside a section (hidden by the chart's Comments toggle).
- `[G]` is a primary chord. `[*ab]` is a secondary chord annotation; it stacks above the primary chord at the same lyric position (the old site's `^` line).
- Transposition state lives in the URL: `?key=Bb`, or `?t=2` for keyless charts.

## Database safety

`apps/api/.env`, `.env.local` and `.env.production` may all point at the PRODUCTION database. Before running anything that writes (`db:push`, `db:seed`, `import:chrd`), check the `DATABASE_URL` in the env file you are about to use, and prefer `--dry-run` first. Table drops need an explicit go-ahead and a backup.
