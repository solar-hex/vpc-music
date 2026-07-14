import { lazy, Suspense, useState } from "react";
import { Shield, Music, Eye, LogOut, Sparkles } from "lucide-react";
import { roleLabel } from "@vpc-music/shared";
import { useAuth } from "@/contexts/AuthContext";

// Loaded on demand so the changelog text isn't pulled into the sidebar bundle
// until someone actually opens "What's new".
const ChangelogDialog = lazy(() => import("./ChangelogDialog"));

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
  const [showChangelog, setShowChangelog] = useState(false);
  if (!user) return null;

  return (
    <div className="flex items-center gap-3 px-2 py-3">
      <button
        type="button"
        onClick={() => setShowChangelog(true)}
        className="group relative flex items-center justify-center h-9 w-9 rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] text-xs font-bold shrink-0 transition-opacity hover:opacity-90"
        title="What's new"
        aria-label="What's new"
      >
        {userInitials(user)}
        <span className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center h-3.5 w-3.5 rounded-full bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] opacity-70 transition-opacity group-hover:opacity-100">
          <Sparkles className="h-2.5 w-2.5" />
        </span>
      </button>
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

      {showChangelog && (
        <Suspense fallback={null}>
          <ChangelogDialog onClose={() => setShowChangelog(false)} />
        </Suspense>
      )}
    </div>
  );
}
