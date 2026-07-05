import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { RouteErrorPage } from "./components/shared/RouteErrorPage";
import { ProtectedRoute } from "./components/shared/ProtectedRoute";

// ── Pages ────────────────────────────────────────
import { LandingPage } from "./pages/LandingPage";
import { SharedSongPage } from "./pages/SharedSongPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SongListPage } from "./pages/songs/SongListPage";
import { SongViewPage } from "./pages/songs/SongViewPage";
import { SongEditPage } from "./pages/songs/SongEditPage";
import { SetlistHubPage } from "./pages/setlists/SetlistHubPage";
import { ArtistsPage } from "./pages/artists/ArtistsPage";
import { SetlistViewPage } from "./pages/setlists/SetlistViewPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { SettingsPage } from "./pages/settings/SettingsPage";
import { AdminPage } from "./pages/admin/AdminPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export const router = createBrowserRouter([
  // ── Public routes (no AppShell) ──────────────
  { path: "/", element: <LandingPage />, errorElement: <RouteErrorPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  { path: "/shared/:token", element: <SharedSongPage /> },

  // ── Authenticated routes (inside AppShell) ───
  {
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/songs", element: <SongListPage /> },
      { path: "/songs/new", element: <SongEditPage /> },
      { path: "/songs/:id", element: <SongViewPage /> },
      { path: "/songs/:id/edit", element: <SongEditPage /> },
      { path: "/setlists", element: <SetlistHubPage /> },
      { path: "/setlists/new", element: <SetlistHubPage /> },
      { path: "/setlists/:id", element: <SetlistViewPage /> },
      { path: "/artists", element: <ArtistsPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/admin", element: <AdminPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
