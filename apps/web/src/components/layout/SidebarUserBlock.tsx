import { Shield, Music, Eye, LogOut } from "lucide-react";
import { roleLabel } from "@vpc-music/shared";
import { useAuth } from "@/contexts/AuthContext";

export function userInitials(user: { displayName?: string | null; email?: string | null } | null): string {
  if (!user) return "";
  return (user.displayName || user.email || "")
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("");
}

export function RoleBadge() {
  const { user, activeOrg } = useAuth();
  if (!activeOrg?.role) return null;

  const isOwner = user?.role === "owner";
  const Icon = isOwner || activeOrg.role === "admin" ? Shield : activeOrg.role === "musician" ? Music : Eye;

  return (
    <span
      data-testid="role-badge"
      className={`badge text-[10px] ${
        isOwner
          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
          : activeOrg.role === "admin"
            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
            : activeOrg.role === "musician"
              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
      }`}
    >
      <Icon className="h-2.5 w-2.5" />
      {isOwner ? "Owner" : roleLabel(activeOrg.role)}
    </span>
  );
}

export function SidebarUserBlock({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="flex items-center gap-3 px-2 py-3">
      <div
        className="flex items-center justify-center h-9 w-9 rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] text-xs font-bold shrink-0"
        title={user.displayName || user.email}
      >
        {userInitials(user)}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-[hsl(var(--foreground))] truncate block leading-tight">
          {user.displayName || user.email}
        </span>
        <RoleBadge />
      </div>
      <button
        onClick={onLogout}
        className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] transition-colors"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
