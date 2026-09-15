import { Outlet, useLocation } from "react-router-dom";
import { Building2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { pageWidthClass } from "@/lib/page-width";
import { EmptyState } from "@/components/shared/EmptyState";
import { AppHeader } from "./AppHeader";
import { OfflineBanner } from "./OfflineBanner";

/**
 * Header, offline notice, page. A user with no team membership sees a single
 * explanation instead of org-scoped pages (settings stay reachable so they can
 * still manage their own profile).
 */
export function AppShell() {
  const { user, activeOrg } = useAuth();
  const { pageWidth } = useTheme();
  const location = useLocation();
  const noTeam = Boolean(user) && !activeOrg;
  const showNoTeam = noTeam && !location.pathname.startsWith("/settings");
  // Two charts side by side need the whole screen, whatever the page width setting.
  const wide = location.pathname.startsWith("/library/duplicates/");

  return (
    <div className="flex min-h-dvh flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <AppHeader />
      <OfflineBanner />
      <main className={`mx-auto w-full ${wide ? "max-w-none" : pageWidthClass(pageWidth)} flex-1 px-3 py-3 sm:px-6 sm:py-4`}>
        {showNoTeam ? (
          <EmptyState
            icon={Building2}
            message="You're not on the team yet. Ask your worship leader for an invite."
          />
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
