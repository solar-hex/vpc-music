# Changelog

All notable changes to this project should be documented in this file.

This project follows a simple Keep a Changelog-style format.

## [Unreleased]

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
