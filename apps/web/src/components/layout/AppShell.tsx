import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useConnectivity } from "@/contexts/ConnectivityContext";
import { Building2, WifiOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { CreateOrgDialog } from "@/components/shared/CreateOrgDialog";
import { Sidebar } from "./Sidebar";
import { MobileTopBar } from "./MobileTopBar";
import { NotificationPanel } from "./NotificationPanel";
import { AiChat } from "@/components/assistant/AiChat";
import { SongQuickLauncher } from "@/components/songs/SongQuickLauncher";

export function AppShell() {
  const { user, logout, refreshUser, switchOrg } = useAuth();
  const { isOnline, pendingOfflineEditCount, syncingOfflineEdits } = useConnectivity();
  const navigate = useNavigate();
  const location = useLocation();
  const [showCreateOrgDialog, setShowCreateOrgDialog] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success("Signed out");
    navigate("/");
  };

  const handleOrganizationCreated = async (organization: { id: string }) => {
    switchOrg(organization.id);
    await refreshUser();
  };

  // Users without any organization see onboarding instead of org-scoped pages.
  // Settings stays reachable so they can still manage their profile/password.
  const noOrg = !!user && (user.organizations?.length ?? 0) === 0;
  const showOnboarding = noOrg && !location.pathname.startsWith("/settings");

  return (
    <div className="min-h-screen flex bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <Sidebar
        onRequestCreateOrg={() => setShowCreateOrgDialog(true)}
        onLogout={handleLogout}
        bottomExtras={<NotificationPanel />}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <MobileTopBar
          onRequestCreateOrg={() => setShowCreateOrgDialog(true)}
          onLogout={handleLogout}
          bottomExtras={<NotificationPanel />}
        />
        {/* Spacer under the fixed mobile top bar */}
        <div className="md:hidden h-14" aria-hidden="true" />

        {(!isOnline || pendingOfflineEditCount > 0) && (
          <div
            className={`border-b px-4 py-2 text-sm ${
              isOnline
                ? "border-[hsl(var(--border))] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
            }`}
          >
            <div className="mx-auto flex max-w-6xl items-center gap-2">
              {isOnline ? <RefreshCw className={`h-4 w-4 ${syncingOfflineEdits ? "animate-spin" : ""}`} /> : <WifiOff className="h-4 w-4" />}
              {!isOnline ? (
                <span>
                  You&apos;re offline. Cached songs and setlists stay available, and existing song edits will queue until you reconnect.
                </span>
              ) : (
                <span>
                  {syncingOfflineEdits ? "Syncing offline edits…" : `${pendingOfflineEditCount} offline edit${pendingOfflineEditCount === 1 ? "" : "s"} waiting to sync.`}
                </span>
              )}
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6">
          {showOnboarding ? (
            <div className="card-empty bg-[hsl(var(--muted))]">
              <Building2 className="mx-auto h-10 w-10 text-[hsl(var(--muted-foreground))]" />
              <h2 className="mt-3 text-lg font-medium">No organization yet</h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                You&apos;re not a member of any organization. Ask your worship team leader for an invite, or create a new
                organization.
              </p>
              <button type="button" onClick={() => setShowCreateOrgDialog(true)} className="btn-primary mt-4">
                Create organization
              </button>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      {/* Global quick-song launcher — Cmd/Ctrl+K or "/" from anywhere */}
      <SongQuickLauncher />

      {/* Floating AI assistant (z-40, under PerformanceMode's z-50 overlay) */}
      <AiChat />

      <CreateOrgDialog
        open={showCreateOrgDialog}
        onClose={() => setShowCreateOrgDialog(false)}
        onCreated={handleOrganizationCreated}
      />
    </div>
  );
}
