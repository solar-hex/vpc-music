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
- `shared/` — the ChordPro engine (parse, transpose, Nashville, exporters, `.chrd` converter). `apps/api/shared/` is a vendored copy: after any edit under `shared/`, run `pnpm sync:shared`; CI fails on drift.
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
```

Every tranche ships with typecheck, web, API and script tests green.

## ChordPro conventions

- `{comment: Verse 1}` is a section header. `{ci: text}` is an italic note line inside a section (hidden by the chart's Comments toggle).
- `[G]` is a primary chord. `[*ab]` is a secondary chord annotation; it stacks above the primary chord at the same lyric position (the old site's `^` line).
- Transposition state lives in the URL: `?key=Bb`, or `?t=2` for keyless charts.

## Database safety

`apps/api/.env`, `.env.local` and `.env.production` may all point at the PRODUCTION database. Before running anything that writes (`db:push`, `db:seed`, `import:chrd`), check the `DATABASE_URL` in the env file you are about to use, and prefer `--dry-run` first. Table drops need an explicit go-ahead and a backup.
