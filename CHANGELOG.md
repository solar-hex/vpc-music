# Changelog

All notable changes to this project should be documented in this file.

This project follows a simple Keep a Changelog-style format.

## [Unreleased]

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
