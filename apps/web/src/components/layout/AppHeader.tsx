import { Link, useNavigate } from "react-router-dom";
import { LogOut, Plus, Settings } from "lucide-react";
import { toast } from "sonner";
import { ThemedLogo } from "@/components/ui/ThemedLogo";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { useAuth } from "@/contexts/AuthContext";

function initialsOf(name: string | undefined, email: string | undefined) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

/**
 * The only app chrome: logo home link, "New song" for editors, and an
 * account menu (Settings, Sign out). Everything else lives on the pages.
 */
export function AppHeader() {
  const { user, activeOrg, logout } = useAuth();
  const navigate = useNavigate();
  const canEdit = user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician";

  const handleLogout = async () => {
    await logout();
    toast.success("Signed out");
    navigate("/login");
  };

  return (
    <header className="print-hidden sticky top-0 z-20 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-3 sm:px-6">
        <Link to="/songs" className="flex items-center gap-2 font-brand text-lg text-[hsl(var(--foreground))]" aria-label="VPC Music home">
          <ThemedLogo className="h-8 w-8 rounded-md" alt="" />
          <span>VPC Music</span>
        </Link>
        <div className="flex-1" />
        {canEdit && (
          <Link to="/songs/new" className="btn-icon btn-ghost h-11 w-11" title="New song" aria-label="New song">
            <Plus className="h-5 w-5" />
          </Link>
        )}
        <ActionMenu
          trigger={
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-xs font-semibold text-[hsl(var(--secondary-foreground))]">
              {initialsOf(user?.displayName, user?.email)}
            </span>
          }
          triggerClassName="btn-icon btn-ghost h-11 w-11 rounded-full"
          triggerTitle={user?.displayName || user?.email}
          label="Account menu"
          items={[
            { label: "Settings", icon: <Settings />, onSelect: () => navigate("/settings") },
            { label: "Sign out", icon: <LogOut />, onSelect: () => void handleLogout() },
          ]}
        />
      </div>
    </header>
  );
}
