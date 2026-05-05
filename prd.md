# VPC Music — Product Requirements Document

> **Status:** Living document  
> **Last updated:** May 4, 2026  
> **Stack:** React 19 + Vite 7 (web), Express + PostgreSQL (API), shared ChordPro utilities

---

## Table of Contents

- [Phased Implementation Plan](#phased-implementation-plan)
  - [Phase 0 — Auth & Infrastructure *(done)*](#phase-0--auth--infrastructure-done)
  - [Phase 1 — Song Library MVP](#phase-1--song-library-mvp)
  - [Phase 2 — Setlists & Performance](#phase-2--setlists--performance)
  - [Phase 3 — Team Management](#phase-3--team-management)
  - [Phase 4 — Sharing](#phase-4--sharing)
  - [Phase 5 — Live Sync (Conductor Mode)](#phase-5--live-sync-conductor-mode)
  - [Phase 6 — Advanced Song Features](#phase-6--advanced-song-features)
  - [Phase 7 — Events & Enhanced Dashboard](#phase-7--events--enhanced-dashboard)
  - [Phase 8 — Offline Support](#phase-8--offline-support)
- [Feature Reference](#feature-reference)
  1. [Product Overview](#1-product-overview)
  2. [User Roles & Permissions](#2-user-roles--permissions)
  3. [Authentication](#3-authentication)
  4. [Landing Page](#4-landing-page)
  5. [App Shell & Navigation](#5-app-shell--navigation)
  6. [Dashboard](#6-dashboard)
  7. [Song Library](#7-song-library)
  8. [Song Editor](#8-song-editor)
  9. [Song Viewer](#9-song-viewer)
  10. [Setlists](#10-setlists)
  11. [Setlist Viewer & Performance Mode](#11-setlist-viewer--performance-mode)
  12. [Conductor Mode (Live Sync)](#12-conductor-mode-live-sync)
  13. [Sharing](#13-sharing)
  14. [Settings](#14-settings)
  15. [Admin / Team Management](#15-admin--team-management)
16. [Offline Support](#16-offline-support)
  16. [Offline Support](#16-offline-support)
  17. [Events](#17-events)
  18. [Notifications & Toast System](#18-notifications--toast-system)

---

## Phased Implementation Plan

Each phase below delivers a self-contained, usable product. Later phases layer on top without breaking earlier ones.

---

### Phase 0 — Auth & Infrastructure *(done)*

**What it enables:** Users can create an account, sign in, and land in an authenticated shell.

| Area | Scope |
|---|---|
| Authentication | Google OAuth popup, email + password login, first-time password setup, invite pre-fill via URL |
| Password recovery | Forgot-password email flow, reset-password page |
| Landing page | Public marketing page with feature overview and sign-in CTA |
| App shell | Top navigation bar, org switcher, theme toggle, sign-out |
| Settings — Profile | Display name, password change |
| Settings — Appearance | Light / dark / system theme, contrast mode |
| Role model | `owner`, `admin`, `musician`, `observer` — enforcement scaffolding in place |

**Standalone test:** A user can register, log in via Google or email, recover a forgotten password, switch themes, and update their display name. Nothing else is functional yet.

---

### Phase 1 — Song Library MVP

**What it enables:** The team can store, browse, and read chord charts.

| Area | Scope |
|---|---|
| Song CRUD | Create, edit, save, delete songs |
| Metadata | Title, artist, key, tempo, category, AKA, shout, tags, draft flag |
| ChordPro editor | Raw textarea with syntax highlighting, live split preview, basic section inserts |
| ChordPro renderer | Chord + lyric rendering, section headers |
| Song list | Paginated list (50/page), text search, sort (last edited / title / recently added) |
| Song viewer | Transpose (step buttons + key picker), show/hide chords, font size, print |
| Single-file import | `.chrd`, `.cho`/`.chordpro`/`.chopro`, `.onsong`, `.txt` |
| Dashboard | Greeting, "New Song" quick action, recent songs panel |

**Standalone test:** A worship leader can add every song to the library, browse them, edit ChordPro content, transpose on any device, and print a chord sheet.

---

### Phase 2 — Setlists & Performance

**What it enables:** The team can build a running order for a service and use it on stage.

| Area | Scope |
|---|---|
| Setlist CRUD | Create, rename, delete setlists with optional category |
| Song ordering | Add songs from library, drag-and-drop and button reorder, remove songs |
| Per-song overrides | Key override and notes per setlist entry |
| Performance mode | Full-screen view: navigate songs, chord toggle, font size, auto-scroll |
| Mark complete / reopen | Archive a setlist when the service is done |
| Dashboard | "New Setlist" quick action, recent setlists panel |

**Standalone test:** A worship leader can build Sunday's setlist, reorder songs, set keys, then hand every musician a device and run through the set in full-screen performance mode.

---

### Phase 3 — Team Management

**What it enables:** Multiple people can use the app with appropriate access control.

| Area | Scope |
|---|---|
| Admin page | Invite members by email + display name + role; invitation email is sent |
| Invite links | Generated invite URL for copy-paste sharing |
| Member list | View all members, change roles, remove members |
| Role enforcement | Observers see read-only UI; musicians can edit; only admins can manage team |
| Settings — Organization | Edit org name; owner can delete the org |
| Org creation | Admins/owners can create additional organizations and switch between them |

**Standalone test:** An admin invites a guitarist as a Musician and a pastor as an Observer. The guitarist can edit songs; the pastor can only read them. The admin can remove either at any time.

---

### Phase 4 — Sharing

**What it enables:** Songs can be shared inside the organization and with people outside it.

| Area | Scope |
|---|---|
| Public share tokens | Generate shareable URLs per song with optional label and expiry; revoke anytime |
| Shared song page | Public read-only viewer at `/shared/:token` (transpose, chord toggle, auto-scroll, print) |
| Direct user shares | Share a song with a specific user by email |
| Share teams | Named groups of org members for one-click multi-user sharing |
| Org-level sharing | Admins batch-share songs to other organizations on the platform |
| Shared library tab | Receiving org browses songs shared to them from other orgs |

**Standalone test:** A worship leader generates a share link for a song and texts it to a volunteer who has no account. The volunteer opens it on their phone and reads the chord chart. The leader can revoke the link at any time.

---

### Phase 5 — Live Sync (Conductor Mode)

**What it enables:** One device controls what every other device in the room is looking at, in real time.

| Area | Scope |
|---|---|
| WebSocket infrastructure | Server-side conductor rooms keyed by setlist ID |
| Conductor role | Navigate songs; broadcast current song index and scroll position |
| Member role | Auto-follow song navigation; mirror scroll position |
| Live status UI | Connection badges in setlist header (Wifi icon, member count) |
| Performance mode integration | Conductor can drive performance mode; members follow along |
| Disconnection handling | "Leave Live" button; graceful cleanup on navigation |

**Standalone test:** A worship leader starts conducting from their laptop. Every musician joins on their phone. The leader navigates to song 3 — every phone instantly shows song 3. The leader scrolls — every phone scrolls with them.

---

### Phase 6 — Advanced Song Features

**What it enables:** Power users get deeper authoring tools and the library becomes richer and more organized.

| Area | Scope |
|---|---|
| Song variations | Named alternate versions of a song (different key, different arrangement); set a default |
| Arrangement builder | Drag-and-drop section sequencer that generates a variation |
| Sticky notes | Color-coded personal notes per song (private to each user) |
| Usage tracking | Log when a song is performed; history list; delete entries |
| Edit history | Chronological log of all edits with author and timestamp |
| Advanced editor | Beginner/advanced mode toggle, command palette, smart suggestions, section organizer, cursor context help, context menu, validation panel, `Ctrl+S` save shortcut |
| Bulk import | Drop multiple files at once with per-file progress tracking |
| ZIP export | Export selected songs as a ZIP in ChordPro, OnSong, or plain text |
| Song groups | Folder-style grouping; group manager delegation to musician members |
| Advanced filters | Filter by group, category, key, tag, tempo range; "Most Used" sort |
| Duplicate detection | Warn when an imported song title matches an existing record |
| Conflict resolution | Field-by-field merge dialog when a save conflicts with a server update |

**Standalone test:** A musician creates a "Low Key" variation of a song for a soloist, adds a sticky note reminding them of a guitar fill, and reviews last month's edit history. An admin bulk-imports 40 `.chordpro` files, organizes them into groups, and exports a ZIP for the keyboard player.

---

### Phase 7 — Events & Enhanced Dashboard

**What it enables:** Services appear as scheduled items and the dashboard becomes a meaningful command center.

| Area | Scope |
|---|---|
| Events | Create events with title, date/time, location, and optional linked setlist |
| Upcoming events panel | Dashboard widget showing next scheduled services |
| Most-used songs panel | Dashboard widget showing frequently-performed songs with use count |
| Mark complete → auto-log | Marking a setlist complete bulk-logs usage for all its songs |

**Standalone test:** An admin schedules Sunday's service with a date and links the setlist. Every team member sees it on their dashboard. After the service, the admin marks the setlist complete and usage counts automatically update for all songs performed.

---

### Phase 8 — Offline Support

**What it enables:** The app remains usable when the venue has poor Wi-Fi or mobile data.

| Area | Scope |
|---|---|
| Song caching | Song API responses cached in `localStorage` on first load; served when offline |
| Setlist caching | Setlist + song list cached; performance mode caches all song contents before entering |
| Offline edit queue | Song edits while offline are queued in `localStorage` with org and timestamp |
| Auto-sync on reconnect | Queue is flushed automatically when connectivity is restored; toast confirms count |
| Conflict detection | `lastKnownUpdatedAt` checked on sync; conflict dialog shown if server has changed |
| Connectivity UI | `WifiOff` banner in app shell; pending edit count badge in nav |

**Standalone test:** A musician opens the setlist backstage (cached), loses Wi-Fi during rehearsal, edits a chord in one song, and closes the laptop. When they open it again at home with Wi-Fi, the edit syncs automatically.

---

## Feature Reference

> Detailed feature specifications for each area of the product.

---

## 1. Product Overview

VPC Music is a private, invite-only web application for a worship team to manage chord charts, build setlists, and stay in sync during rehearsal and live performance. It replaces ad-hoc spreadsheets and disconnected apps with a single hub accessible from any device—phone on a music stand, tablet, laptop, or desktop.

### Core value propositions

| Value | Description |
|---|---|
| ChordPro-native | Industry-standard format for chord chart storage, editing, and export |
| Real-time sync | Conductor Mode pushes current song and scroll position to every device |
| Role-based access | Worship Leaders, Musicians, and Observers have appropriate permissions |
| Offline-capable | Songs and setlists are cached; edits are queued and synced on reconnect |
| Responsive | Fully usable on screens from a 375 px phone up to a wide-format desktop |

---

## 2. User Roles & Permissions

The permission model applies at the **organization** level. A user can be a member of multiple organizations with different roles in each.

| Role | Label in UI | Create / Edit Songs | Delete Songs | Manage Setlists | Manage Members | Manage Org |
|---|---|---|---|---|---|---|
| `owner` | Platform Owner | ✅ | ✅ | ✅ | ✅ | ✅ |
| `admin` | Worship Leader | ✅ | ✅ | ✅ | ✅ | ✅ (not delete) |
| `musician` | Musician | ✅ | ✅ | ✅ | ❌ | ❌ |
| `observer` | Observer | ❌ (read-only) | ❌ | ❌ | ❌ | ❌ |

Additional fine-grained rules:
- **Song Groups**: Admins can assign Musician members as group managers, giving them limited authority to manage songs within their assigned group.
- **Batch org-sharing**: Only `owner` and `admin` can share batches of songs to external organizations.
- **Organization creation**: `owner` and current-org `admin` can create new organizations.

---

## 3. Authentication

### 3.1 Login Page (`/login`)

The login page is a centered card with the VPC Music logo.

**Authentication methods:**
- **Google OAuth** — Primary sign-in path. Opens a popup window that completes the Google flow, then returns a session token.
- **Email + password** — Secondary path, hidden behind a "Sign in with email" toggle to keep the UI clean. When clicked, reveals email and password fields.

**First-time password setup flow:**
- When a user was invited (no password set), entering their email triggers a first-time password setup prompt.
- The page transitions to a "Set your password" form asking for a new password and a confirmation, with a minimum length of 8 characters.
- On success the user is logged in and redirected to the dashboard.

**Invite pre-fill:**
- If a `?email=...` query parameter is present (from an invite link), the email field is pre-populated and the email form is shown automatically.

**Error handling:**
- Incorrect credentials show a toast notification.
- OAuth popup failures show an inline modal message.

**Sandbox mode:**
- When `VITE_SANDBOX=true`, a panel of pre-seeded quick-login accounts is shown (Admin / Musician / Observer) for demo purposes.

**Additional controls:**
- A theme toggle button (dark/light) is available in the top-right corner.
- Authenticated users are immediately redirected to `/dashboard`.

---

### 3.2 Forgot Password (`/forgot-password`)

Simple single-field form. Submitting an email triggers a password reset email. The UI switches to a confirmation state regardless of whether the account exists (security best practice). A link returns the user to sign-in.

---

### 3.3 Reset Password (`/reset-password`)

Reached via the emailed link. Accepts a new password and confirmation, validates minimum length, then logs the user in on success.

---

## 4. Landing Page (`/`)

Public marketing page, not accessible once logged in (redirects to `/dashboard` for authenticated users).

**Navigation bar (sticky):**
- VPC Music logo + brand name (left)
- Theme toggle button
- "Sign in" button linking to `/login`

**Hero section:**
- Headline: "Welcome to VPC Music"
- Sub-headline describing the product purpose
- "Get Started" CTA button linking to `/login`
- Subtle gradient background decoration

**Core Features section ("What you can do here"):**
Six feature cards in a 3-column responsive grid:

| Feature | Summary |
|---|---|
| ChordPro Native | Industry-standard format with full directive support |
| Instant Transpose | Semitone step buttons or direct 12-key picker, real-time recalculation |
| Setlist Builder | Drag-and-drop reordering, per-song key overrides, categories |
| Conductor Mode | Real-time sync of song and scroll position across all devices |
| Auto-Scroll | requestAnimationFrame-based smooth hands-free scroll |
| Flexible Import | `.chrd`, `.cho`/`.chordpro`/`.chopro`, PDF, plain text |

**How It Works section:**
Three numbered steps: Import or Create → Organize → Perform

**Also Built In section:**
Six additional feature cards:

| Feature | Summary |
|---|---|
| Role-Based Access | Worship Leader / Musician / Observer roles |
| Dark & Light Themes | Persistent theme preference |
| Responsive Design | Phone, tablet, laptop, desktop |
| Fast & Modern Stack | React 19, Vite 7, PostgreSQL-backed Express |
| ChordPro Export | Export for OnSong, BandHelper, SongBook, etc. |
| Dashboard & Quick Actions | Jump to recent songs, setlists, or create new content |

**Footer:**
Copyright line and links to sign in / get started.

---

## 5. App Shell & Navigation

All authenticated routes are wrapped in `AppShell`, which provides:

**Top navigation bar:**
- VPC Music logo (links to `/dashboard`)
- Organization switcher dropdown — shows current org name with a chevron; expands to list all orgs the user belongs to, with a "Create organization" option for owners/admins
- Offline indicator badge — shows when the browser is offline; displays a pending edit count if there are queued writes
- Theme toggle (dark / light)
- User menu — shows display name and role badge, with a "Sign out" button

**Mobile menu:**
- Hamburger button collapses/expands the navigation links on small screens

**Navigation links:**
- Dashboard (`/dashboard`)
- Songs (`/songs`)
- Setlists (`/setlists`)
- Settings (`/settings`)
- Admin (`/admin`) — visible only to `admin` and `owner` roles

**Connectivity banner:**
- When offline, a yellow banner with a WifiOff icon is shown at the top of the content area with a "Refresh" button
- When offline edits are pending sync, a count badge appears on the offline indicator

---

## 6. Dashboard (`/dashboard`)

Landing page after login. Personalized overview of the user's library.

**Greeting:**
- "Welcome, [Display Name]" heading with a subtitle

**Quick Actions (role-gated):**
- "New Song" button → `/songs/new` (musicians and above)
- "New Setlist" button → `/setlists/new` (musicians and above)
- "Browse Songs" button → `/songs` (all roles)

**Upcoming Events section:**
- Cards showing scheduled events with title, formatted date/time, optional location, and a linked setlist if one is assigned
- Empty state if no upcoming events

**Recent Songs section:**
- Up to 6 recently-edited songs shown as cards with title, key, tempo indicator, and a direct link
- "View all" link to the full song library

**Most-Used Songs section:**
- Up to 6 songs sorted by total usage count with a use-count badge
- Useful for quickly finding frequently-performed worship songs

---

## 7. Song Library (`/songs`)

Paginated, filterable list of the organization's song library. 50 songs per page.

### 7.1 Search & Filters

| Filter | Options |
|---|---|
| Text search | Full-text search across title, artist, AKA — debounced 300 ms |
| Library scope | "My Library" (organization songs) vs. "Shared Library" (songs shared from other orgs) |
| Group | Dropdown of song groups; disabled in shared scope |
| Category | Dropdown of existing categories |
| Key | Dropdown of all 12 chromatic keys |
| Tag | Dropdown of existing tags |
| Tempo range | Min and max BPM number inputs |
| Sort | Last Edited, Title (A–Z), Recently Added, Most Used |

Active filter indicators are shown as dismissible badges.

### 7.2 Song Cards

Each song in the list shows:
- Selection checkbox (for bulk actions)
- Title, artist, key, tempo indicator (color-coded BPM badge), category
- Tags (if any)
- Draft badge (if `isDraft = true`)
- When a key filter is active, clicking a card opens the song pre-transposed to that key

### 7.3 Bulk Actions

When one or more songs are selected:
- **Export ZIP** — dropdown with three format options:
  - ChordPro (`.cho`)
  - OnSong (`.onsong`)
  - Plain Text (`.txt`)
- **Share to Organizations** — batch-share dialog (admin/owner only)

**Select all visible** checkbox in the list header.

### 7.4 Song Groups

Groups are folders/categories for the song library. Managed via a slide-out panel:
- Create new group (admin/musician)
- Rename group
- Assign manager members (admin only) — musicians assigned as managers can manage songs in that group
- Delete group (with confirmation)

### 7.5 Sharing

Admin/owner users can batch-share selected songs to external organizations:
- Dialog lists all available target organizations
- Shows how many of the selected songs are already shared to each org
- Toggle share/unshare actions and apply in bulk

### 7.6 Pagination

Previous / Next controls with page indicators. Page resets to 0 when any filter changes.

---

## 8. Song Editor (`/songs/new` and `/songs/:id/edit`)

Full-featured song creation and editing environment.

### 8.1 Metadata Fields

| Field | Notes |
|---|---|
| Title | Required |
| AKA | Alternate name/alias |
| Category | Free-text classification |
| Key | 12-key picker |
| Tempo (BPM) | Numeric |
| Artist | Free-text |
| Shout | Short display note (e.g., "Modulates to A at bridge") |
| Tags | Comma-separated, autocomplete from existing tags |
| Draft | Toggle to mark the song as a work-in-progress |

### 8.2 ChordPro Editor

The editor has three view modes switchable from the toolbar:

| Mode | Description |
|---|---|
| Edit | Full-screen raw or rich editor |
| Split | Side-by-side editor + live preview |
| Preview | Read-only rendered output |

**Editor sub-modes:**
- **Beginner mode** — Rich syntax-highlighted textarea with contextual hints, example snippets, and a simplified toolbar
- **Advanced mode** — Full raw ChordPro editor with all power-user features

**Toolbar features (advanced mode):**
- Insert section label (Verse 1–4, Chorus, Pre-Chorus, Bridge, Intro, Outro, Interlude, Instrumental, Tag, Ending, Solo, Turnaround, Vamp, Coda, and a full Song Skeleton template)
- Format document (auto-indent and normalize)
- Validation panel — lists ChordPro syntax issues with line references
- Smart Suggestions panel — AI-assisted chord and structure suggestions
- Cursor Context Help — inline hint about ChordPro syntax at cursor position
- Section Organizer — drag-and-drop reorder of sections without leaving the editor
- Command Palette (keyboard-accessible list of editor actions)
- Context menu on right-click with context-aware options (e.g., transpose selected chord)

**Syntax highlighting overlay:** Chords are colored differently from lyrics and directives in real time.

**Metadata sync:** Directives at the top of the ChordPro content (`{title:}`, `{artist:}`, `{key:}`, `{tempo:}`) are kept in sync with the metadata form fields.

### 8.3 Variations

Songs can have multiple named variations (e.g., different keys for different services or arrangements):
- Create variation: name + optional key override + optional content override
- Switch between variations within the editor
- Set a default variation (the one loaded when viewing the song)

### 8.4 Arrangement Builder

A drag-and-drop panel that constructs an arrangement from the existing sections in the song content:
- Select section instances in order to build a running order
- Generates a variation named after the arrangement
- Previews the resulting content before saving

### 8.5 Import

Multiple import methods are available from a file upload area:

| Method | Accepted formats |
|---|---|
| File drop / picker | `.chrd` (legacy), `.cho` / `.chordpro` / `.chopro`, `.onsong`, `.txt` |
| Bulk import | Multiple files at once; progress list shows per-file status |
| PDF import | PDF chord sheets are parsed and converted |
| Plain text + chords | Paste lyrics and add chords inline |

**Import preview:** Before committing, the user sees the imported title and source format. If the title matches an existing song, a duplicate-detection warning is shown.

**Import conflict handling:** If a song was modified on the server while the user was editing, a field-by-field conflict resolution dialog is shown with "mine" vs. "server" toggles.

### 8.6 Offline Editing

When offline, saving queues the edit in localStorage. On reconnect, the queue is automatically flushed. Queue is scoped to the active organization.

### 8.7 Dirty State Guard

Navigating away from an unsaved song triggers a browser `beforeunload` prompt and an in-app confirmation dialog.

---

## 9. Song Viewer (`/songs/:id`)

Read-optimized single-song page.

### 9.1 Header & Metadata

- Back arrow to `/songs`
- Song title, artist, key, tempo indicator, category, AKA, shout, tags
- Draft badge if applicable
- Edit and Delete buttons (role-gated)

### 9.2 Transpose Controls

- Semitone up / semitone down step buttons
- Direct key picker (all 12 chromatic keys)
- Enharmonic normalization (e.g., `C#` is treated the same as `Db`)
- Transpose state is reflected in the URL query parameter `?key=...`

### 9.3 View Controls

| Control | Description |
|---|---|
| Show/Hide Chords | Toggle chord display for lyrics-only view |
| Nashville Numbers | Toggle between chord names and Nashville Number System (requires song key) |
| Font Size | Dropdown: 12, 14, 16, 18, 20, 24 px |
| Auto-Scroll | Configurable speed slider; starts/stops smooth scroll |
| Print | Opens print dialog with chord sheet optimized print styles |

### 9.4 Variations Panel

If the song has saved variations, a variation switcher is shown. Users can select a variation or return to the original. Active variation is reflected in `?variation=...` URL parameter. Admins/musicians can set the default variation.

### 9.5 Sticky Notes

Personal notes attached to a song (per-user, per-song):
- Color-coded notes: yellow, green, blue, pink, purple
- Create, edit, delete
- Visible only to the note author

### 9.6 Usage History

Track when a song has been performed:
- Log a usage with a date and optional notes
- List of past usages with date and notes
- Delete individual usage records
- Usage data feeds the "Most Used" sort and dashboard widget

### 9.7 Edit History

Chronological log of all edits to the song, with author and timestamp. Expandable panel.

### 9.8 Share Management

A dialog accessible from the Share button:

**Share tokens (public links):**
- Create tokens with an optional label and optional expiry date
- Copy share URL to clipboard
- Rename a token's label
- Revoke (delete) a token

**Direct user shares:**
- Share a song directly with a specific user by email
- Listed with the recipient's name
- Revocable

**Share Teams:**
- Create named teams of org members
- Share a song to a team in one action
- Manage team membership
- Remove team shares

### 9.9 Add to Setlist

Quick-add the current song to any existing setlist from a dropdown picker. The active variation and current display key are passed along.

### 9.10 Keyboard Shortcuts & Foot Pedal Support

| Key | Action |
|---|---|
| `PageDown` / `ArrowDown` | Scroll down |
| `PageUp` / `ArrowUp` | Scroll up |
| `[` / `]` (or custom) | Transpose down / up |

Disabled when any modal is open.

### 9.11 Offline Cache

The song response is cached in localStorage. When offline, the cached version is shown with an info toast.

---

## 10. Setlists (`/setlists`)

List and management of setlists.

### 10.1 Setlist List Page

**Header:**
- Page title "Setlists"
- "New Setlist" button (musicians and above)
- "Show/Hide archive" toggle (shown only if completed setlists exist)

**Active setlists** are shown as clickable cards with name, song count, and optional category.

**Completed archive** is a separate visually de-emphasized section toggleable from a persistent localStorage preference. Completed setlists show a green "Complete" badge.

**Create setlist modal:**
- Name (required)
- Category (optional)
- On save, navigates directly to the new setlist

**Delete:** A trash icon appears on hover over each card. Deletion requires confirmation.

---

## 11. Setlist Viewer & Performance Mode (`/setlists/:id`)

### 11.1 Setlist Header

- Back arrow to `/setlists`
- Setlist name (editable by admins/musicians)
- Song count
- Status badge (active / complete)
- Action buttons: Add Song, Export, Mark Complete / Reopen, Delete, Live Mode controls

### 11.2 Song Order Management

Songs appear as a numbered, drag-and-drop list:
- Grip handle for drag-and-drop reordering (persisted via API on drop)
- Move Up / Move Down arrow buttons (keyboard-accessible alternative)
- Per-song key override display and edit
- Per-song notes field
- Remove song button

### 11.3 Add Song Modal

Search the library by title/artist and click to add. The song appears at the end of the list.

### 11.4 Export

The setlist can be exported as a ZIP of all song charts:
- ChordPro format
- OnSong format
- Plain text

### 11.5 Mark Complete / Reopen

- **Mark Complete:** Sets the setlist status to `complete`. Also automatically logs a usage entry for every song in the setlist (with today's date). Surfaces a success toast showing how many usages were logged.
- **Reopen:** Reverts status back to active.

### 11.6 Performance Mode

Full-screen mode designed for on-stage use. Activated by the "Performance" button.

**Controls:**
- Previous / Next song buttons (and keyboard shortcuts `←`/`→`)
- Song index indicator ("3 / 8")
- Show/Hide chords toggle
- Font size selector
- Auto-scroll (configurable speed, play/pause)
- Transpose controls (up/down semitone, direct key picker)
- **Timer** — optional per-song countdown timer with configurable duration (default 4 min); starts/stops/resets; visual progress bar; pulses red when time is up
- Fullscreen toggle (browser Fullscreen API)
- Exit button returns to the setlist view

**Song display:** ChordPro rendered output fills the viewport with scroll support. Song title, key, and tempo indicator shown in a collapsible header bar.

**Song list sidebar:** Mini song list visible during performance for quick navigation to any song.

**Offline support:** Performance mode caches all song contents before entering; falls back to the cache if offline.

---

## 12. Conductor Mode (Live Sync)

Real-time synchronization via WebSocket for band rehearsal and live performance.

### 12.1 Modes

| Role | Behavior |
|---|---|
| Conductor | Controls what song and scroll position all members see |
| Member | Receives song and scroll updates from the conductor |

### 12.2 Activation

From the Setlist Viewer, a "Go Live" button opens a panel:
- "Conduct" — become the conductor for this setlist
- "Join" — join as a member

Live mode status is shown in the header (green Wifi icon for conductor, blue for member).

### 12.3 Conductor Controls

- Navigate songs using the normal setlist navigation; the current song index is broadcast to all members
- Scroll position is broadcast throttled at ~100 ms intervals
- Members' views scroll to match

### 12.4 Member Behavior

- Current song automatically scrolls into view in the song list
- Page scroll mirrors the conductor's scroll position

### 12.5 Disconnection

A "Leave Live" button disconnects from the session. Navigating away also triggers a leave.

---

## 13. Sharing

### 13.1 Public Share Links (tokens)

Any song can generate one or more public share URLs:
- URL format: `/shared/:token`
- Tokens can have a human-readable label
- Tokens can have an optional expiry date
- Revocable at any time from the share management dialog

### 13.2 Shared Song Page (`/shared/:token`)

A standalone public read-only viewer outside the authenticated AppShell:
- Song metadata (title, artist, key, tempo, category, AKA, shout)
- Full ChordPro rendered content
- Transpose controls
- Show/Hide chords
- Nashville Number toggle
- Font size picker
- Auto-scroll
- Print button
- Theme toggle button
- If the token is invalid or expired, a friendly error message is shown

### 13.3 Direct User Shares

Songs can be shared directly with named users by email. These shares give the recipient read access to the song without making it fully public.

### 13.4 Share Teams

Named groups of org members used to quickly share a song to multiple people at once.

### 13.5 Organization-Level Sharing

Admin/owner users can share songs to other organizations on the platform (a federation model for multi-congregation usage). Shared songs appear in the "Shared Library" tab of the receiving organization's song list.

---

## 14. Settings (`/settings`)

User and organization preferences in a tabbed layout.

### 14.1 Profile

- Display name field (editable, required)
- Save button calls the platform API to update the user record

### 14.2 Password

- Change password form: current password, new password, confirm new password
- Minimum 8 characters
- Only shown when the user has an email/password credential

### 14.3 Appearance

**Theme:**
- Light / Dark / System (follows OS preference)

**Contrast mode:**
- Normal / High Contrast

**Theme Presets:**
- Classic (default)
- Stage Dark (optimized for dark stages)
- Print Light (high-contrast for printing)
- Custom (manual color overrides unlocked)

**Custom color controls** (visible when "Custom" preset is selected):
- Chord color — color picker for inline chord labels
- Secondary chord color — for secondary/bass note chords
- Page background — hex input with a live preview swatch

**Song font family:**
- Default (sans-serif)
- Monospace (fixed-width for precise chord alignment)

**Editor mode:**
- Beginner — simplified toolbar with examples and hints
- Advanced — full ChordPro power-user mode

All appearance settings are persisted per-user to the server and restored on login across devices.

### 14.4 Organization (admin/owner only)

- Organization name field (editable by admin/owner)
- Member count
- "Delete Organization" button (owner only) with a confirmation dialog that lists the member count as a warning

---

## 15. Admin / Team Management (`/admin`)

Accessible only by `admin` and `owner` roles. Non-admins see a "403 Access Denied" message.

### 15.1 Invite Member

Form fields:
- Email address (required)
- Display name (required)
- Role selector: Worship Leader (`admin`), Musician (`musician`), Observer (`observer`)

On submit:
- An invitation email is sent to the new member's address
- An invite URL is generated and shown with a one-click copy button
- The member list refreshes

### 15.2 Member List

Table/card list of all organization members showing:
- Display name and email
- Role badge (color-coded: amber for Worship Leader, blue for Musician, grey for Observer)
- Crown icon for the platform owner
- Inline role change dropdown (admin can change any non-owner member's role)
- Remove member button (with confirmation dialog)

---

## 16. Offline Support

VPC Music is designed to remain functional without a network connection.

### 16.1 Song Caching

When a song is loaded in the Song Viewer, the full API response is stored in `localStorage` (key: `vpc-song-cache-<id>`). On subsequent loads where the network is unavailable, the cached version is served with an informational toast.

### 16.2 Setlist Caching

When a setlist is loaded in the Setlist Viewer, the setlist and its song list are cached. Performance Mode additionally caches all individual song contents when entering performance mode so the entire set is available offline.

### 16.3 Offline Edit Queue

When a song edit is saved while offline, the changes are serialized into `localStorage` under an offline edit queue. Each queued item records:
- Song ID and title
- Organization ID
- The full song payload
- The `lastKnownUpdatedAt` timestamp for conflict detection

On reconnect, the `ConnectivityContext` automatically flushes the queue, applying each edit via the API. A success toast reports how many edits were synced. If the server version has changed, a conflict resolution dialog is shown.

### 16.4 Connectivity Indicator

A `WifiOff` banner appears at the top of the app shell when offline. The navigation shows a badge with the count of pending offline edits.

---

## 17. Events

Events represent scheduled services or rehearsals and appear on the Dashboard.

### 17.1 Event Cards

Each event card shows:
- Event title
- Date/time (formatted with weekday, month, day, hour, minute)
- Optional location (with a map pin icon)
- Linked setlist name (if one is associated) with a direct link

### 17.2 Data Model

Events are stored with at minimum:
- `id`, `title`, `date`, `location` (optional), `setlistId` (optional), `setlistName` (optional)

Events are fetched on the dashboard filtered to upcoming (`upcoming=true`).

---

## 18. Notifications & Toast System

All user-facing feedback uses the `sonner` toast library:

| Type | Trigger examples |
|---|---|
| Success | Song saved, setlist created, usage logged, password changed, member invited, offline edits synced |
| Error | Login failed, song not found, export failed, network error |
| Info | Showing cached song/setlist while offline |
| Warning | (shown inline in UI, e.g., duplicate song detection, dirty-state nav guard) |

Toasts auto-dismiss and appear in the bottom-right corner.
