import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, useParams } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { RouteErrorPage } from "./components/shared/RouteErrorPage";
import { ProtectedRoute } from "./components/shared/ProtectedRoute";

// ── Pages ────────────────────────────────────────
import { SharedSongPage } from "./pages/SharedSongPage";
import { SharedSetlistPage } from "./pages/SharedSetlistPage";
import { SongListPage } from "./pages/songs/SongListPage";
import { SongChartPage } from "./pages/songs/SongChartPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { NotFoundPage } from "./pages/NotFoundPage";

// The editor pulls in CodeMirror; keep it out of the list/chart bundle.
const SongEditPage = lazy(() => import("./pages/songs/SongEditPage").then((module) => ({ default: module.SongEditPage })));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage").then((module) => ({ default: module.SettingsPage })));

/*
 * Tranche 1 is deliberately small: songs, one chart, one editor, one settings
 * page. Set-list code (pages/setlists/{SetlistHubPage,SetlistViewPage,PerformPage},
 * components/setlists/*, hooks/useConductor, hooks/useApiList,
 * components/shared/{CardGrid,StatusBadge}, components/songs/MetronomeWidget,
 * utils/{capo,key-compat}) stays in the tree, compiled and tested but
 * unrouted, until tranche 2 mounts it again.
 */

function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="spinner" />
    </div>
  );
}

function RedirectToChart() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/songs/${id}`} replace />;
}

export const router = createBrowserRouter([
  // ── Public routes (no AppShell) ──────────────
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Navigate to="/songs" replace />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorPage />,
  },
  { path: "/login", element: <LoginPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  { path: "/shared/:token", element: <SharedSongPage /> },
  { path: "/shared/setlist/:token", element: <SharedSetlistPage /> },

  // The chart itself — full-bleed, no shell: the screen on the music stand.
  {
    path: "/songs/:id",
    element: (
      <ProtectedRoute>
        <SongChartPage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorPage />,
  },
  { path: "/songs/:id/focus", element: <RedirectToChart /> },

  // ── Authenticated routes (inside AppShell) ───
  {
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      { path: "/songs", element: <SongListPage /> },
      {
        path: "/songs/new",
        element: (
          <Suspense fallback={<Loading />}>
            <SongEditPage />
          </Suspense>
        ),
      },
      {
        path: "/songs/:id/edit",
        element: (
          <Suspense fallback={<Loading />}>
            <SongEditPage />
          </Suspense>
        ),
      },
      {
        path: "/settings",
        element: (
          <Suspense fallback={<Loading />}>
            <SettingsPage />
          </Suspense>
        ),
      },
      // Bookmarks from the previous layout land somewhere sensible.
      { path: "/settings/*", element: <Navigate to="/settings" replace /> },
      { path: "/dashboard/*", element: <Navigate to="/songs" replace /> },
      { path: "/admin/*", element: <Navigate to="/settings#team" replace /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
