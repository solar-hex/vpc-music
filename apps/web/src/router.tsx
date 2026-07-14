import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { RouteErrorPage } from "./components/shared/RouteErrorPage";
import { ProtectedRoute } from "./components/shared/ProtectedRoute";
import { SectionLayout } from "./components/layout/SectionTabs";

// ── Pages ────────────────────────────────────────
import { LandingPage } from "./pages/LandingPage";
import { SharedSongPage } from "./pages/SharedSongPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DashboardUsageTab } from "./pages/dashboard/DashboardUsageTab";
import { DashboardHistoryTab } from "./pages/dashboard/DashboardHistoryTab";
import { SongListPage } from "./pages/songs/SongListPage";
import { MediaLibraryPage } from "./pages/songs/MediaLibraryPage";
import { SongViewPage } from "./pages/songs/SongViewPage";
import { SongFocusPage } from "./pages/songs/SongFocusPage";
import { SongDetailLayout } from "./pages/songs/SongDetailLayout";
import { SongMediaTab } from "./pages/songs/SongMediaTab";
import { SongHistoryTab } from "./pages/songs/SongHistoryTab";
import { SongEditPage } from "./pages/songs/SongEditPage";
import { SetlistHubPage } from "./pages/setlists/SetlistHubPage";
import { TemplatesPage } from "./pages/setlists/TemplatesPage";
import { EventsPage } from "./pages/setlists/EventsPage";
import { EventDetailPage } from "./pages/setlists/EventDetailPage";
import { CalendarPage } from "./pages/setlists/CalendarPage";
import { RehearsalsPage } from "./pages/setlists/RehearsalsPage";
import { SetlistViewPage } from "./pages/setlists/SetlistViewPage";
import { PerformPage } from "./pages/setlists/PerformPage";
import { ArtistsPage } from "./pages/artists/ArtistsPage";
import { AlbumsPage } from "./pages/artists/AlbumsPage";
import { ArtistDetailLayout, ArtistProfileTab, ArtistSongsTab, ArtistAlbumsTab } from "./pages/artists/ArtistDetailPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { SettingsProfileTab } from "./pages/settings/SettingsProfileTab";
import { SettingsPreferencesTab } from "./pages/settings/SettingsPreferencesTab";
import { SettingsIntegrationsTab } from "./pages/settings/SettingsIntegrationsTab";
import { SettingsDataTab } from "./pages/settings/SettingsDataTab";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminOrganizationTab } from "./pages/admin/AdminOrganizationTab";
import { AdminPage } from "./pages/admin/AdminPage";
import { AdminAvailabilityTab } from "./pages/admin/AdminAvailabilityTab";
import { AdminRolesTab } from "./pages/admin/AdminRolesTab";
import { AdminActivityTab } from "./pages/admin/AdminActivityTab";
import { NotFoundPage } from "./pages/NotFoundPage";

// All feature growth happens inside these sections as nested tab routes —
// the sidebar stays at six items.
export const router = createBrowserRouter([
  // ── Public routes (no AppShell) ──────────────
  { path: "/", element: <LandingPage />, errorElement: <RouteErrorPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  { path: "/shared/:token", element: <SharedSongPage /> },

  // Rehearsal mode — full-bleed, no shell. The only screen used under pressure.
  {
    path: "/setlists/:id/perform",
    element: (
      <ProtectedRoute>
        <PerformPage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorPage />,
  },

  // Single-song focus mode — full-bleed reader, no shell (story 3).
  {
    path: "/songs/:id/focus",
    element: (
      <ProtectedRoute>
        <SongFocusPage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorPage />,
  },

  // ── Authenticated routes (inside AppShell) ───
  {
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      {
        path: "/dashboard",
        element: (
          <SectionLayout
            tabs={[
              { to: "", label: "Overview" },
              { to: "usage", label: "Song usage" },
              { to: "history", label: "Event history" },
            ]}
          />
        ),
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "usage", element: <DashboardUsageTab /> },
          { path: "history", element: <DashboardHistoryTab /> },
        ],
      },
      {
        path: "/admin",
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminOrganizationTab /> },
          { path: "members", element: <AdminPage /> },
          { path: "availability", element: <AdminAvailabilityTab /> },
          { path: "roles", element: <AdminRolesTab /> },
          { path: "activity", element: <AdminActivityTab /> },
        ],
      },
      {
        path: "/songs",
        element: (
          <SectionLayout
            tabs={[
              { to: "", label: "All songs" },
              { to: "media", label: "Media library" },
            ]}
          />
        ),
        children: [
          { index: true, element: <SongListPage /> },
          { path: "media", element: <MediaLibraryPage /> },
        ],
      },
      { path: "/songs/new", element: <SongEditPage /> },
      {
        path: "/songs/:id",
        element: <SongDetailLayout />,
        children: [
          { index: true, element: <SongViewPage /> },
          { path: "media", element: <SongMediaTab /> },
          { path: "history", element: <SongHistoryTab /> },
        ],
      },
      { path: "/songs/:id/edit", element: <SongEditPage /> },
      {
        path: "/setlists",
        element: (
          <SectionLayout
            tabs={[
              { to: "", label: "Set lists" },
              { to: "templates", label: "Templates" },
              { to: "events", label: "Events" },
              { to: "calendar", label: "Calendar" },
              { to: "rehearsals", label: "Rehearsals" },
            ]}
          />
        ),
        children: [
          { index: true, element: <SetlistHubPage /> },
          { path: "templates", element: <TemplatesPage /> },
          { path: "events", element: <EventsPage /> },
          { path: "calendar", element: <CalendarPage /> },
          { path: "rehearsals", element: <RehearsalsPage /> },
        ],
      },
      { path: "/setlists/new", element: <SetlistHubPage /> },
      { path: "/setlists/events/:id", element: <EventDetailPage /> },
      { path: "/setlists/:id", element: <SetlistViewPage /> },
      {
        path: "/artists",
        element: (
          <SectionLayout
            tabs={[
              { to: "", label: "All artists" },
              { to: "albums", label: "Albums" },
            ]}
          />
        ),
        children: [
          { index: true, element: <ArtistsPage /> },
          { path: "albums", element: <AlbumsPage /> },
        ],
      },
      {
        path: "/artists/:id",
        element: <ArtistDetailLayout />,
        children: [
          { index: true, element: <ArtistProfileTab /> },
          { path: "songs", element: <ArtistSongsTab /> },
          { path: "albums", element: <ArtistAlbumsTab /> },
        ],
      },
      {
        path: "/settings",
        element: (
          <SectionLayout
            tabs={[
              { to: "", label: "Profile" },
              { to: "preferences", label: "Preferences" },
              { to: "integrations", label: "Integrations" },
              { to: "data", label: "Import & export" },
            ]}
          />
        ),
        children: [
          { index: true, element: <SettingsProfileTab /> },
          { path: "preferences", element: <SettingsPreferencesTab /> },
          { path: "integrations", element: <SettingsIntegrationsTab /> },
          { path: "data", element: <SettingsDataTab /> },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
