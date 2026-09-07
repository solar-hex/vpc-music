# Roles and Access Checklist

This document is a working reference for the **four current roles** in VPC Music.

It is written from the perspective of the **current product behavior and codebase as of March 16, 2026**.

> **Current audit status:** Backend route hardening is in place for the audited write endpoints, previously public song/setlist/event detail routes now require authentication, and dedicated role-matrix coverage exists for the protected write routes. Frontend observer UI gating is **complete** — all edit/create/delete controls are hidden for observers across SongListPage, SongViewPage, SongEditPage, SetlistsPage, SetlistViewPage, and DashboardPage. Role-display polish is **complete** — `ROLE_DESCRIPTIONS` added to shared constants, role badge shown in AppShell header, and descriptions displayed in the invite form. Frontend rendering tests (22 tests across 5 pages × 4 roles) are **passing**. Owner bypass behavior, musician/admin separation, and admin-only vs editor-level boundaries have now been reviewed against the current middleware and role-gated UI coverage.

## Role model at a glance

There are **two layers of role assignment** in the app:

- **Global role**
  - `owner`
  - `member`
- **Organization role**
  - `admin`
  - `musician`
  - `observer`

In practice, the four roles we talk about day-to-day are:

1. **Owner** — global super-user
2. **Admin** — organization worship leader / org administrator
3. **Musician** — organization editor / contributor
4. **Observer** — organization read-only viewer

---

# 1) Owner

> Global super-user. An owner bypasses org-level role checks.

## What an Owner can do

- [x] Sign in to the system as a full-access user.
- [x] Bypass org-level role restrictions in backend permission checks.
- [x] Access admin-only areas even when not assigned as org `admin` in the active org.
- [x] View and manage team membership through the admin area.
- [x] Invite users to an organization.
- [x] Change organization member roles.
- [x] Remove members from an organization.
- [x] Receive all organizations in the authenticated org-selection context, even without direct membership rows for each org.
- [x] Create songs.
- [x] Edit songs.
- [x] Delete songs.
- [x] Create, edit, and delete song variations.
- [x] Set or clear the **default variation** for a song.
- [x] Add songs or song variations to setlists.
- [x] Create and manage setlists.
- [x] Use sharing/export features available in the song viewer.
- [x] Batch share selected songs with other organizations and edit those org shares from the library.
- [x] Use logging/history/notes features available to signed-in users.
- [x] See the system as a global `owner` in settings/profile UI.

## What an Owner cannot do

- [x] They are **not limited** by normal org role checks.
- [x] They do **not** need to be org `admin` to pass admin-style backend guards.
- [x] They do **not automatically create new product features or hidden owner-only UI** unless the code explicitly provides them.
- [x] They do **not** currently have a separately documented owner-only workflow beyond global override behavior.

## Notes

- This is the **highest privilege** role in the system.
- Owner is the safest role to treat as the **audit baseline for full access**.

---

# 2) Admin

> Organization-level leader with full team-management access inside the org.

## What an Admin can do

- [x] Sign in and use the app normally.
- [x] Access the **Team Management / Admin** page for the active organization.
- [x] View organization members.
- [x] Invite new users into the organization.
- [x] Assign org roles (`admin`, `musician`, `observer`) when inviting.
- [x] Change an existing member’s org role.
- [x] Remove members from the organization.
- [x] Create songs.
- [x] Edit songs.
- [x] Delete songs.
- [x] Create song variations.
- [x] Edit song variations.
- [x] Delete song variations.
- [x] Set or clear the **default variation** for a song.
- [x] Add songs or selected variations to setlists.
- [x] Create and manage setlists.
- [x] Use sharing/export options in the song viewer.
- [x] Batch share selected songs with other organizations and edit those org shares from the library.
- [x] Use notes, usage logging, and song history features exposed to signed-in users.

## What an Admin cannot do

- [x] They do **not** have the global override power of an `owner`.
- [x] They do **not** become a system-wide super-user outside their org context.
- [x] They do **not** have a separate global role in the database unless also marked as `owner`.

## Notes

- In the UI and seed data, this role maps closely to **Worship Leader**.
- If we are auditing permissions, Admin is the **highest normal organization role**.

---

# 3) Musician

> Organization contributor who can work with song content, but is not a team administrator.

## What a Musician can do

- [x] Sign in and use the app normally.
- [x] View songs.
- [x] Use song viewing tools such as chords, Nashville view, print, and export actions available in the viewer.
- [x] Create songs.
- [x] Edit songs.
- [x] Delete songs.
- [x] Create song variations.
- [x] Edit song variations.
- [x] Delete song variations.
- [x] Set or clear the **default variation** for a song.
- [x] Add songs or selected variations to setlists.
- [x] Create and manage setlists, where the relevant route or UI is available to authenticated org members.
- [x] Use notes, usage logging, and song history features available in the song workflow.

## What a Musician cannot do

- [x] Cannot access the **Team Management / Admin** page.
- [x] Cannot invite users through the admin workflow.
- [x] Cannot change other members’ org roles.
- [x] Cannot remove members from the organization.
- [x] Cannot batch share songs with other organizations or edit org-share assignments.
- [x] Does not have global `owner` bypass privileges.

## Notes

- Musician is currently the **highest non-admin editing role**.
- This role is explicitly allowed to set a song’s **default variation**.

---

# 4) Observer

> Read-only viewer for songs and performance workflows.

## What an Observer can do

- [x] Sign in and access the app.
- [x] View songs.
- [x] View song variations.
- [x] Open songs from setlists, including variation-specific links.
- [x] Use read-oriented song viewer tools such as print/view/export actions that are exposed from the viewer.
- [x] Participate in read-only/performance consumption scenarios the UI allows.

## What an Observer cannot do

- [x] Cannot access the **Team Management / Admin** page.
- [x] Cannot invite users.
- [x] Cannot change org roles.
- [x] Cannot remove members.
- [x] Cannot set or clear the **default variation** for a song.
- [x] Cannot batch share songs with other organizations or edit org-share assignments.
- [x] Cannot be treated as an editor-level role.
- [x] Should be considered **read-only** for content governance.

## Notes

- In seed/demo language, this is the **view-only** role.
- Observer should be the primary role used to verify that editing controls stay hidden or blocked.
- Backend mutation routes are now protected against observer writes.
- Frontend UI gating is **complete**: all edit/create/delete buttons are hidden for observers. SongEditPage redirects observers away with a toast error. Read-only features (Print, Export, chord toggle, Nashville, font size, AutoScroll, Live Mode) remain accessible.
- The `canEdit` pattern used across all pages: `user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician"`.

---

# Capability matrix

## Team / membership management

- **Owner**
  - [x] Can access admin page
  - [x] Can invite members
  - [x] Can change roles
  - [x] Can remove members
- **Admin**
  - [x] Can access admin page
  - [x] Can invite members
  - [x] Can change roles
  - [x] Can remove members
- **Musician**
  - [x] Cannot access admin page
  - [x] Cannot invite members
  - [x] Cannot change roles
  - [x] Cannot remove members
- **Observer**
  - [x] Cannot access admin page
  - [x] Cannot invite members
  - [x] Cannot change roles
  - [x] Cannot remove members

## Song editing

- **Owner**
  - [x] Can create songs
  - [x] Can edit songs
  - [x] Can delete songs
- **Admin**
  - [x] Can create songs
  - [x] Can edit songs
  - [x] Can delete songs
- **Musician**
  - [x] Can create songs
  - [x] Can edit songs
  - [x] Can delete songs
- **Observer**
  - [x] Should not have edit authority

## Variations

- **Owner**
  - [x] Can create/edit/delete variations
  - [x] Can set default variation
- **Admin**
  - [x] Can create/edit/delete variations
  - [x] Can set default variation
- **Musician**
  - [x] Can create/edit/delete variations
  - [x] Can set default variation
- **Observer**
  - [x] Can view variations
  - [x] Cannot set default variation
  - [x] Should not have edit authority over variations

## Setlists

- **Owner**
  - [x] Can manage setlists
  - [x] Can add selected song variations to setlists
- **Admin**
  - [x] Can manage setlists
  - [x] Can add selected song variations to setlists
- **Musician**
  - [x] Can manage setlists in normal workflow
  - [x] Can add selected song variations to setlists
- **Observer**
  - [x] Can view setlist-linked songs
  - [x] Should not be treated as a setlist editor unless code explicitly says so

## Global override

- **Owner**
  - [x] Has global bypass for org-role middleware
- **Admin**
  - [x] No global bypass
- **Musician**
  - [x] No global bypass
- **Observer**
  - [x] No global bypass

---

# Audit reminders

When we begin the code audit, these are the main questions to verify:

- [x] Are song create/edit/delete routes explicitly protected to match the intended roles?
- [x] Are variation create/edit/delete routes explicitly protected to match the intended roles?
- [x] Are setlist create/edit/delete actions explicitly protected to match the intended roles?
- [x] Are protected write routes covered by role-matrix integration tests?
- [x] Are observer users blocked both in the **UI** and the **API**, not just one layer? *(API hardening done; UI gating done — 22 frontend rendering tests verify observer sees no edit controls)*
- [x] Are owner privileges intentional everywhere they bypass org checks? *(Yes — current middleware explicitly treats global `owner` as the documented override baseline.)*
- [x] Are there any places where musician currently has more or less access than intended? *(No unintended drift found in the audited write routes or the role-gated UI coverage. Musician remains the highest non-admin editor role.)*
- [x] Are there any places where admin-only and editor-level features are mixed together unintentionally? *(No unintended mixing found in the audited paths: team management stays admin-only, while song/setlist editing remains available to admin + musician.)*

---

# Short version

- **Owner** = full system override
- **Admin** = full org management + content management
- **Musician** = content editor, but not team manager
- **Observer** = read-only viewer
