import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Auth guard wrapper. Must be used inside the router tree.
 * Shows a loading spinner while checking auth state; redirects to /login when
 * unauthenticated, remembering where the user was headed so a texted link to
 * a chart lands on that chart after sign-in.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  // Captured once: a stable object keeps <Navigate> from re-navigating on
  // every render, and the first location is the one worth returning to.
  const [redirectState] = useState(() => ({ from: `${location.pathname}${location.search}` }));

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--muted))] border-t-[hsl(var(--secondary))]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={redirectState} />;
  }

  return <>{children}</>;
}
