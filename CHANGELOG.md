# Changelog

All notable changes to this project should be documented in this file.

This project follows a simple Keep a Changelog-style format.

## [Unreleased]

<!-- changelog-cursor: 47de68f — last commit recorded below. Log new commits in the range 47de68f..HEAD, then advance this marker to the newest hash. -->

### Changed — Simplification tranche 1 (September 2026)

- Legacy `.chrd` conversion (`shared/utils/chrd.js`) now handles the real library: already-bracketed chords are no longer double-bracketed, chord columns follow the chord name (matching the old site's own OnSong export), drafts are detected from the `~` filename prefix, `^` secondary chord lines become inline `[*x]` annotation tokens on the lyric line, `*` comments become `{ci: ...}` note lines, zero-width and non-ASCII characters are cleaned, and unlabeled header lines, bracketed section names, `#[Verse 2]` headers and decorated tokens (`[Ebm]*`) are handled with warnings
- ChordPro parser: `{ci}` / `{comment_italic}` (and `{cb}`) are in-section note lines rather than section headers, and `toChordProString` round-trips them
- Transpose engine: compound tokens (`B8-Db8-Eb8`, `e-gb-ab`), starred secondary tokens, optional `(Gbm)` chords, bass-only `/G` tokens, bracketed chords on bar lines, and mixed-case quality words (`Dma7`, `CmAug`) now transpose
- Plain-text, OnSong and PDF exports print a secondary chord row above the primary row and render note lines
- New `pnpm import:chrd [env] --dir <path> --org <name|uuid> [--created-by <email>] [--dry-run] [--exclude <glob>]` imports a `.chrd` library directly into an organization's songs with deterministic ids (re-runs update rather than duplicate), a membership guard, and a JSON/text report under `apps/api/import-reports/` (gitignored)
- Root `pnpm test:api` added; `pnpm test:all` now runs web, API and script suites
- The song page is now a full-screen lead sheet (`/songs/:id`, outside the app shell) modelled on the old site: a fixed toolbar (search, key picker, transpose down/up, Nashville numbers, comments, text size, keep-awake, theme, More menu with print/downloads/share link/log a play/edit/delete) and a bottom section jump bar. Transposition lives in the URL (`?key=Bb`, or `?t=2` for keyless charts) so links and reloads keep the key; view preferences (text size, comments, Nashville, keep-awake) persist per device
- The chart renderer is controls-free: hosts pass the net `transpose`; it renders `[*x]` secondary chords as a second row and `{ci}` notes in italics, and gives each section an id for the jump bar
- Removed from the song page: detail tabs (media, history), focus mode as a separate page, variations UI, instrument-part layers, ink annotations, share-link management, visibility tiers, similar songs, collaboration threads, sticky notes, staff notation and the metronome
- The app shell is a single header (logo, New song, account menu) instead of a sidebar with six sections; signing in lands on the song list, and a link opened while signed out returns there after sign-in. Single-church mode: the org switcher, org creation and cross-org sharing UI are gone
- The song list is the old site's search page again: the whole library loads once (and is kept on the device for offline use), one box filters it instantly by title, alternate title, artist and tags, songs are grouped A to Z, drafts stay hidden until "Show drafts", a key carried from the chart opens every song in that key, and lyric matches from the server appear under "Also found in lyrics"
- The song editor page keeps title, artist, year, key, tempo, tags and draft; category, energy, alternate title, shout, arrangement builder, staff notation and variation editing are gone. Import (single file for review, or many files at once) is available from the song list and the editor; a conflict on save now offers "Reload their version" or "Overwrite with mine"
- The ChordPro editor is one CodeMirror surface with a small toolbar: Edit/Split/Preview, an Insert menu (sections, a `{ci: }` comment line, a `[*]` secondary chord), Format, section chips, a chord popup on a selection or Ctrl+K, validation with inline fixes and a short cheat sheet. Ctrl+/ toggles a `{ci}` note line and Alt+Up/Down transposes the current line. The beginner/advanced mode switch, the textarea with its syntax overlay, command palette, context menu, smart suggestions, cursor help, section organizer, help panel and arrangement builder are gone
- Settings is one page with stacked sections: Profile (name, password), Appearance (theme, key spelling as flats or sharps, the two chord colours with a live preview), Team for admins (rename the team, invite one or many, roles, resend, remove), Data (import files, download the whole library as a ChordPro/OnSong/text ZIP) and About (version, what's new, sign out). The key spelling preference now drives the chart's key picker and the editor's key list. Removed: high-contrast mode, theme presets, page background and display font choices, the editor mode switch, duration display, time zone, the integrations placeholder, CSV import, the set list PDF export, and the separate admin pages (organization slug/logo, provisioning, custom roles, the delete-organization danger zone)
- Removed pages: dashboard and analytics, artists and albums, media library, set list templates, schedule/events/calendar/rehearsals, admin availability, roles and activity tabs, the marketing landing page, the AI assistant and the notification center (set lists and perform mode return in tranche 2, scheduling in tranche 3)
- Sessions last 180 days instead of 7 (`JWT_EXPIRES_IN`), the cookie lives exactly as long as its token, `GET /auth/me` renews the cookie once it is past half of its life, and the cookie is marked `Secure` on staging as well as production
- Fixed: signing in left a seeded member looking like someone with no team ("Ask your worship leader for an invite") until the next page load, because `POST /auth/login` answered without the caller's organizations while `GET /auth/me` included them. Login, register, set-password and the Google popup callback now return the same user shape as `/auth/me`, built by one shared loader
- The API no longer mounts `/assistant` (and drops `ANTHROPIC_API_KEY`), runs the notification reminder cron, or starts the Socket.IO conductor server; the web app drops the Material Icons font, react-query, react-hook-form, zod, class-variance-authority, framer-motion, abcjs and the nine unused Radix packages, and `lib/api-client.ts` keeps only the endpoints the app calls
- CI and `pnpm preflight` run `pnpm test:all` (web, API and scripts). Docs: README rewritten around the tranche plan, `CLAUDE.md` added, the PRD, role model and editor notes moved to `docs/archive/`, prototypes and stale task/test dumps deleted

### Changed — mobile-first pass, statistics, schedule and ChordPro gaps (`47de68f`)

- Modals render as bottom sheets on phones via `ResponsiveModal` (Escape, backdrop close, focus trap); new `ActionMenu` (dropdown on desktop, sheet on mobile); hover-only controls visible on touch; 44px targets
- Statistics: `song_usages` gained `setlist_id` and `source`; completing an event or set list logs plays idempotently and reopening removes them; new `/stats` overview and per-song endpoints; dashboard Analytics tab; perform mode "Mark as played"
- Events, calendar and rehearsals merged into one Schedule tab; set list print view and public set list share links (`/shared/setlist/:token`)
- ChordPro: `{sov}`/`{sob}` environments, `{sot}` tab sections kept verbatim, `{define:}` chord shapes; capo selector with a "play X, sounds Y" banner; audio metronome in perform mode; tap-a-chord SVG fretboard diagrams; ink annotations saved per user per song
- Migration `scripts/migrate-2026-07-stats-tiers.mjs` (idempotent) covers every schema change since `e1c6771`
- Most of this UI was removed again by the simplification tranche above; the engine work (`{define:}`, environments, chord shapes) and the statistics columns remain

### Added — song retrieval, sharing tiers and instrument layers (`30d0903`)

- Song search matches lyrics, not just metadata; global Ctrl+K quick launcher; single-song focus mode at `/songs/:id/focus`
- "Switch to a similar song" ranked by tempo, shared tags and energy, with key-transition ratings
- Versioning tiers (personal, organization, global) with variation promotion and a line diff; a global core library visible to every org; residual cross-org IDOR on song update/delete closed
- Owner-only organization provisioning, bulk invite and resend invite
- Per-musician instrument layers (`song_instrument_parts`: icon, colour, ChordPro notes, optional ABC staff) that transpose with the base chart
- Requires the schema migration above (`songs.tier`, `song_instrument_parts`); the quick launcher, focus page, similar-songs panel, tiers UI, provisioning and instrument layers were removed again by the simplification tranche

### Fixed — cross-org security & data-integrity hardening (July 2026)

- Closed a cross-org IDOR across every setlist route (`GET /:id`, export, `PUT`, approve/archive/unarchive/restore/complete/reopen, delete, permanent-delete, and all `/:id/songs` mutations): lookups resolved rows by id alone, letting any authenticated member of any org view, edit, reorder, or delete another org's setlist. Every lookup/update/delete is now scoped to the caller's `organizationId` via a `loadSetlistInOrg()` helper
- Closed the same cross-org IDOR on events routes (`GET/PUT/DELETE /:id`, `/complete`, `PATCH /:id/status`) — `GET /:id` was also missing org middleware entirely — via a matching `loadEventInOrg()` helper
- Fixed a correlated-subquery bug corrupting counts/aggregates at 13 sites across albums, artists, assistant, roles, setlists, and songs: `${table.id}` interpolated inside a `sql` subquery rendered as a bare, unqualified `id` that silently resolved to the subquery's own row — album track counts, artist song counts, song play counts/last-played, group counts, and role member counts all read as 0/null, and the setlists list's `averageBpm`/`keys` columns 500'd with "ambiguous column" (the real root cause behind "dashboard shows nothing after creating a setlist"). Fixed with explicit literal identifiers (`"setlists"."id"`)
- Fixed a tautological variant on events' `songCount` subquery, where both interpolations collapsed to the same bare `setlist_id` (`"setlist_id" = "setlist_id"`, always true) so every event counted every `setlist_songs` row in the whole database across all orgs
- Hardened `GET /` on both setlists and events so a request that resolves no org context returns an empty list instead of every org's rows
- Seed `api-client`'s active org synchronously from `localStorage` so a page's data-fetch effect can't race ahead of `AuthContext`'s org-sync effect and fire without an `X-Organization-Id` header on first load; surfaced previously-swallowed archive/trash "Undo" failures as a toast
- Added a pg-mem-backed e2e test harness (real Express routes + real Drizzle queries, no external Postgres), two-org IDOR regression tests, and a case-insensitive static guard against the dangerous `${table.column}`-in-subquery pattern

### Fixed — setlist/dashboard load reliability (July 2026)

- One failing dashboard request no longer blanks the whole page: `Promise.all` rejected as a unit and the outer catch swallowed it, hiding sections whose own requests had succeeded. Switched to `Promise.allSettled` with a per-call `safe()` wrapper so each section fails independently
- Seed `SetlistViewPage` from router navigation state on create/use-template so it renders immediately instead of racing an immediate re-fetch of a just-committed row (which surfaced as a false "Setlist not found"); a failed background refresh no longer clobbers seeded data, and load errors now distinguish a genuine 404 from other failures
- Eliminated a duplicate setlist-refresh (and its double error toast) caused by React StrictMode double-invoking the load effect, via a `cancelled` cleanup flag; added stage-by-stage `[Create]`/`[Refresh]` logging to surface the real cause of background-GET failures
- Setlist creation now runs in a transaction with error handling for a missing setlist in the response

### Fixed — music-engine correctness (July 2026)

- Resolve unusual enharmonic roots (`Cb`, `Fb`, `E#`, `B#`) in the transpose engine: `noteIndex()` checked only the standard 12-name tables, so chords/keys spelled this way silently failed to transpose (e.g. `transposeChord("Cbm7", 2)` returned unchanged). Now falls back to the enharmonic-alias map, fixing everything built on `interval`/`transposeChord`/`transposeKeyName`
- FlowStrip's key-transition ribbon called the raw circle-of-fifths grader instead of the `flow.keyTransition()` facade, so a smooth `C → Cm` move rendered as an amber "notable" connector instead of green "smooth"; wired it to the corrected grader and added first-time coverage
- Retired the stale, now-diverged `transitionQuality()` grader and the dead `.quality` field, unifying on the single correct key-transition path
- Fixed a latent gap in `flow.js`'s note table (`B#` was missing, so `circleDistance("B#", "D")` returned null) by delegating to the one canonical `noteIndex()`

### Changed — shared-module consolidation & de-duplication (July 2026)

- Consolidated the chords API into `shared/utils/chords.js` as an ESM facade (namespaced `chords`) over the existing `transpose.js` + `chart.js` primitives — a single source of truth for `parseChord`/`transposeChord`/`interval`/`preferFlats`/`parseChart`/`transposeChart`/`toText`, with `transposeChart` rewriting the `{key: ...}` directive so a rendered chart's key label tracks its chords
- Consolidated set-flow analysis into `shared/utils/setflow.js` (namespaced `flow`) as a thin facade over `flow.js`, exposing `analyze`/`keyTransition`/`fmt` with parallel/relative major-minor treated as smooth modulations
- Centralized composition helpers in `transpose.js`: `spellForTarget` (target-key enharmonic spelling) and `composeTranspose` (stored key + set-list override + live nudge → normalized shift), wiring `ChordProRenderer`, `PerformanceMode`, and `SongViewPage` off their hand-rolled copies
- Centralized time/date formatters in `lib/format.ts` (`formatDuration`, `formatSetlistDuration`, `timeAgo`, `toDateKey`, `toLocalInputValue`, `formatEventDateTime`, `formatShortDate`), collapsing several byte-identical copies
- Deduplicated residual key math: a shared `normalizeEnharmonicKey` and `parseKeyRoot` replace three copies of the sharp↔flat alias table; `capo.ts` delegates to shared `interval`/`transposeKeyName`
- Extracted shared UI primitives — `EmptyState` (18 hand-written empty blocks), `StatusBadge` (unifying setlist + event status pills), `CardGrid` (12 copy-pasted grid shells) — and a `useApiList` hook collapsing the fetch/loading/refresh boilerplate across 7 uniform list pages
- Synced root `shared/` into `apps/api/shared/` (the structured-chart commit left the API copy running stale transposition logic) and raised the web test timeout to 15s to stabilize the heavy jsdom suite under parallel load

### Added — song filtering (July 2026)

- `SongFilterToolbar` for enhanced song filtering and sorting

### Added — foundation spec: charts, rehearsal mode, set flow (July 2026)

- Structured chart engine (`shared/utils/transpose.js`): section tokens like `[Chorus]`/`[Bridge 2]` are never parsed as chords; strict chord grammar keeps extensions intact (`C#m7b5`, `A7(#9)`, `Fsus4`); slash chords transpose both halves; bar lines `| G | C/E | D |` transpose in place; enharmonic spelling follows the *target* key (flat keys F/Bb/Eb/Ab/Db/Gb and relative minors get flats); zero-net transposition returns the stored chart byte-for-byte, so round-trips are lossless
- Transposition stays a view concern: charts are stored once in the source key, every rendered view (song page, set list, rehearsal mode, exports) transposes at render time, and a per-set-list key override now actually transposes the chart instead of only relabelling the key
- Rehearsal mode at `/setlists/:id/perform`: full-bleed dark route outside the app shell with wake lock (re-acquired on tab return), cache-first offline loading, minimum 18px chart type with the size persisted across sessions, one-tap live transpose per song, a BPM visual pulse, elapsed set time, and BPM/duration-derived autoscroll — and deliberately no editing, comments, or notifications
- Set flow analysis strip under the set list builder: energy sparkline, key sequence coloured by circle-of-fifths transition quality (relative minors treated as their relative major), and a duration bar that includes between-song gaps and talk time against the event's music slot
- Flow advisory signals (never blocking): key clashes, energy plateaus, flat curves, unready songs, over/under time, soft open/close, and repeat-set overlap with the last completed event; recomputed client-side on every reorder
- Chart text uploads (`.cho`, `.chordpro`, `.crd`, `.txt`, …) are read into `media.content` with a detected `format` so charts are searchable text, not opaque files
- New per-song energy override (1–5, else derived from BPM), per-item talk seconds in the builder, and a music-slot target on events

### Migration notes (foundation spec)

- Run `pnpm --filter @vpc-music/api db:push`: new columns `media.content` + `media.format`, `songs.energy`, `setlist_songs.talk_seconds`, `events.target_seconds`

### Added — tabbed sections build-out (July 2026)

- Tabbed sub-navigation on every sidebar section as real nested routes (deep-linkable, back-button-safe); the sidebar stays at six items
- Dashboard tabs: Overview (with next-event countdown, rehearsals-this-week, awaiting-approval, and stale-song stat cards), Song usage (sortable play report with "not played in X days" filter), and Event history (completed events expandable to the set played)
- Songs tabs: Media library (org-wide file grid with type filter, unattached surfacing, and song linking) and song detail tabs Details / Charts & media (uploads with inline chart, PDF, text, and audio previews) / History (play stats, play log, edit log, appears-in set lists)
- Set Lists tabs: Templates (reusable slot structures; applying creates a set list with labelled empty slots), Events (with type/status and a full event detail page whose "Mark completed" logs a play per song), Calendar (month view of events + rehearsals, click-a-day create), and Rehearsals
- Artists tabs: Albums (org-wide, with artist and track counts) and artist detail tabs Profile (editable) / Songs / Albums
- Admin tabs: Organization (name, slug, logo, owner-only danger zone), Members, Availability (member×date grid — everyone edits their own row, admins edit all), Roles & permissions (read-only matrix + custom-role manager), and Activity log (filterable audit trail)
- Settings tabs: Profile, Preferences (key notation, duration display, time zone, theme), Integrations (placeholder shells), and Import & export (CSV song import + print-ready set list export)
- Set list approval flow (draft → in review → approved) with a new `setlists:approve` permission, plus soft builder warnings for slow-song runs and long totals
- Media uploads stored under `uploads/` and served at `/uploads`; song metadata gains time signature, duration, genre, and album link
- Switching organizations now resets the route to the section's default tab so record IDs never cross org boundaries

### Migration notes (tabbed build-out)

- Run `pnpm --filter @vpc-music/api db:push`: new tables `albums`, `media`, `setlist_templates`, `rehearsals`, `availability`, `activity_log`; new columns on `organizations` (slug, logo), `events` (type/status/completed_at), `setlists` (status enum values), `setlist_songs` (nullable song_id, slot_label), `songs` (album/time-signature/duration/genre)
- The API host needs a writable `uploads/` directory for media files

### Added — prototype merge (July 2026)

- Sidebar app shell replacing the top nav: sectioned navigation (Main / Library / Tools), org switcher under the logo, user block, and a bottom control bar with theme toggle and notification bell; mobile top bar with slide-in drawer
- Redesigned dashboard: Next Performance hero, quick actions with pinnable favorites and single-key shortcuts, service-plan detail modal, event create/edit dialog (first event UI), and team avatars row
- Event plan fields: theme, prepared-by, and team assignments on events (`theme`, `prepared_by`, `team` columns)
- Setlist Hub: searchable/sortable grid with duration, key range, average BPM, and leader metadata; archive with grouped-by-date panel; trash with restore, undo toasts, and admin-only permanent delete
- Song statuses (Ready / Needs Review / In Rehearsal / Updated / Missing Chords), per-user favorites, song archive/trash, and a three-dot song actions menu
- Per-setlist-song performance tools: capo suggestions, arrangement style, planned duration, and transition cues (speaking, prayer, instrumental, countdown) shown in performance mode
- Staff notation (ABC) viewing and editing via lazily-loaded abcjs, plus a WebAudio metronome in the song viewer
- Performance mode stage-brightness slider and capo/arrangement chips
- Artists directory: browse/search/manage artists, detail view with top songs, and automatic linking of songs by artist name
- In-app notification center backed by a real notifications table: invite/role-change/event/setlist producers, unread badge, mark-read/clear, periodic upcoming-event reminders, and 90-day retention cleanup
- AI assistant (Anthropic tool-use loop): floating chat that searches the library and creates songs, setlists, and events with role-filtered tools and per-user rate limiting (requires `ANTHROPIC_API_KEY`)
- Custom roles & permissions: permission catalog in shared constants, `requirePermission` middleware overlaying the base role model, role CRUD + member assignment, and an admin Roles & Permissions manager

### Changed — prototype merge (July 2026)

- Song and setlist deletion is now soft (trash + restore); permanent deletion is a separate admin-only action
- API tolerates the `/api` path prefix again (restores compatibility with proxies that don't rewrite, and fixed 108 stale API tests)
- Write-route guards converted from fixed role checks to permission checks (`songs:edit`, `setlists:edit`, `events:edit`, `artists:edit`, `team:manage`) with identical default behavior
- Empty-org onboarding moved from the dashboard into the app shell so it covers every org-scoped page

### Migration notes

- Run `pnpm --filter @vpc-music/api db:push` against the target database: new tables `artists`, `notifications`, `org_roles`, `song_favorites`; new columns on `songs`, `setlists`, `setlist_songs`, `events`, `organization_members`
- Set `ANTHROPIC_API_KEY` in the API environment to enable the assistant (the endpoint returns 503 without it)

### Added

- Organization management endpoints, org switcher flow, and empty-org onboarding
- Role-aware UI gating for owner, admin, musician, and observer workflows
- ChordPro editor Phase 1 and Phase 2 features, including syntax highlighting, validation, help, command palette, split preview, context menu, and auto-formatting
- Performance mode upgrades including countdown timer, live navigation, and full-screen layout
- Expanded import/export support for OnSong, OpenSong XML, plain text, variation export, and multi-song ZIP export
- Song metadata improvements including tags, tempo indicators, associated shout, categories, and AKA support
- Song groups, delegated group management, and authenticated shared-song flows
- Group CRUD and delegation test coverage across the API and web library UI
- `CONTRIBUTING.md` contributor workflow guide

### Changed

- Role labels and descriptions are centralized through shared constants
- Observer write access is blocked in both backend routes and frontend UI
- Song library filters now cover tags, categories, BPM range, sort, pagination, and key-aware navigation
- Migration tooling now preserves secondary chord lines and emits structured reports

### Tested

- Focused API and web validation for song-group CRUD and delegation workflows
- Existing task-plan milestones documented in `202603161-tasks.md`

## [0.1.0] - 2026-03-16

### Added

- Monorepo foundation with Express API, React web app, shared music utilities, and deployment scripts
- ChordPro-first song model with import/export helpers and transposition utilities
- Authentication, organization membership, RBAC, setlists, events, sharing, sticky notes, and history foundations
- PWA/offline shell support, design system styling, dashboard workflows, and stage-focused song rendering
