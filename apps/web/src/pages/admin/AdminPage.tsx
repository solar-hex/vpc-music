import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { RolesPermissionsManager } from "@/components/admin/RolesPermissionsManager";
import { adminApi, rolesApi, type OrgUser, type OrgRole } from "@/lib/api-client";
import { toast } from "sonner";
import { roleLabel, ROLE_DESCRIPTIONS } from "@vpc-music/shared";
import {
  UserPlus,
  Shield,
  Music,
  Eye,
  Trash2,
  Loader2,
  Crown,
  Copy,
  Users,
  ShieldCheck,
} from "lucide-react";

const ROLE_OPTIONS: { value: string; label: string; icon: typeof Shield }[] = [
  { value: "admin", label: "Worship Leader", icon: Shield },
  { value: "musician", label: "Musician", icon: Music },
  { value: "observer", label: "Observer", icon: Eye },
];

function roleBadge(role: string) {
  switch (role) {
    case "admin":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    case "musician":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "observer":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export function AdminPage() {
  const { user, activeOrg } = useAuth();
  const [members, setMembers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<"users" | "roles">("users");
  const [customRoles, setCustomRoles] = useState<OrgRole[]>([]);

  // Invite form
  const [invEmail, setInvEmail] = useState("");
  const [invName, setInvName] = useState("");
  const [invRole, setInvRole] = useState("musician");
  const [inviting, setInviting] = useState(false);

  // Invite link copy state
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [pendingRemoveMember, setPendingRemoveMember] = useState<OrgUser | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const isAdmin =
    activeOrg?.role === "admin" || user?.role === "owner";

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listUsers();
      setMembers(res.users);
    } catch {
      toast.error("Failed to load team members");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadMembers();
  }, [isAdmin, loadMembers]);

  useEffect(() => {
    if (!isAdmin) return;
    rolesApi
      .list()
      .then((res) => setCustomRoles(res.roles.filter((role) => !role.isSystem)))
      .catch(() => setCustomRoles([]));
  }, [isAdmin, section]);

  // Guard: non-admins see a forbidden message
  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <h1 className="text-2xl font-brand text-[hsl(var(--foreground))] mb-2">
          Access Denied
        </h1>
        <p className="text-[hsl(var(--muted-foreground))]">
          You need admin permissions to view this page.
        </p>
      </div>
    );
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invEmail.trim()) {
      toast.error("Email is required");
      return;
    }
    if (!invName.trim()) {
      toast.error("Display name is required");
      return;
    }
    setInviting(true);
    try {
      const res = await adminApi.invite({
        email: invEmail.trim(),
        displayName: invName.trim(),
        role: invRole,
      });
      toast.success(res.message);
      setCopiedUrl(res.inviteUrl);
      setInvEmail("");
      setInvName("");
      setInvRole("musician");
      await loadMembers();
    } catch (err: any) {
      toast.error(err.message || "Failed to invite user");
    } finally {
      setInviting(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!copiedUrl) return;
    await navigator.clipboard.writeText(copiedUrl);
    toast.success("Invite link copied");
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await adminApi.updateRole(userId, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, orgRole: newRole as OrgUser["orgRole"] } : m)),
      );
      toast.success("Role updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    }
  };

  const handleCustomRoleChange = async (userId: string, customRoleId: string) => {
    try {
      await adminApi.updateCustomRole(userId, customRoleId || null);
      setMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, customRoleId: customRoleId || null } : m)),
      );
      toast.success(customRoleId ? "Custom role assigned" : "Custom role cleared");
    } catch (err: any) {
      toast.error(err.message || "Failed to update custom role");
    }
  };

  const handleRemove = async () => {
    if (!pendingRemoveMember) return;
    setRemovingMemberId(pendingRemoveMember.id);
    try {
      const res = await adminApi.removeMember(pendingRemoveMember.id);
      toast.success(res.message);
      setMembers((prev) => prev.filter((m) => m.id !== pendingRemoveMember.id));
      setPendingRemoveMember(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member");
    } finally {
      setRemovingMemberId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-brand text-[hsl(var(--foreground))]">
          Team Management
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Manage members of{" "}
          <span className="font-medium text-[hsl(var(--foreground))]">
            {activeOrg?.name || "your organization"}
          </span>
        </p>
      </div>

      {/* Section tabs */}
      <div className="flex items-center gap-1 border-b border-[hsl(var(--border))]" role="tablist">
        <button
          role="tab"
          aria-selected={section === "users"}
          onClick={() => setSection("users")}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            section === "users"
              ? "border-[hsl(var(--secondary))] text-[hsl(var(--secondary))]"
              : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          }`}
        >
          <Users className="h-4 w-4" /> Users
        </button>
        <button
          role="tab"
          aria-selected={section === "roles"}
          onClick={() => setSection("roles")}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            section === "roles"
              ? "border-[hsl(var(--secondary))] text-[hsl(var(--secondary))]"
              : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          }`}
        >
          <ShieldCheck className="h-4 w-4" /> Roles &amp; Permissions
        </button>
      </div>

      {section === "roles" && <RolesPermissionsManager />}

      {/* Invite section */}
      <div className={`rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 space-y-4 ${section !== "users" ? "hidden" : ""}`}>
        <h2 className="text-lg font-brand text-[hsl(var(--foreground))] flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-[hsl(var(--secondary))]" />
          Invite Member
        </h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Required fields are marked with <span className="font-medium text-[hsl(var(--destructive))]">*</span>. The invite sends an email directly to the team member.
        </p>
        <form onSubmit={handleInvite} className="flex flex-wrap gap-3">
          <input
            type="email"
            value={invEmail}
            onChange={(e) => setInvEmail(e.target.value)}
            placeholder="Email address *"
            aria-label="Email address (required)"
            required
            className="flex-1 min-w-50 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          />
          <input
            type="text"
            value={invName}
            onChange={(e) => setInvName(e.target.value)}
            placeholder="Display name *"
            aria-label="Display name (required)"
            required
            className="w-40 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          />
          <select
            value={invRole}
            onChange={(e) => setInvRole(e.target.value)}
            className="rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 py-2 text-sm text-[hsl(var(--foreground))]"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={inviting}
            className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--secondary))] px-4 py-2 text-sm font-medium text-[hsl(var(--secondary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {inviting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Send Email Invite
          </button>
        </form>
        {ROLE_DESCRIPTIONS[invRole as keyof typeof ROLE_DESCRIPTIONS] && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] -mt-1">
            <span className="font-medium">{ROLE_OPTIONS.find(r => r.value === invRole)?.label ?? invRole}:</span>{" "}
            {ROLE_DESCRIPTIONS[invRole as keyof typeof ROLE_DESCRIPTIONS]}
          </p>
        )}

        {/* Show invite link after successful invite */}
        {copiedUrl && (
          <div className="flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-xs">
            <span className="flex-1 truncate text-[hsl(var(--muted-foreground))]">
              {copiedUrl}
            </span>
            <button
              onClick={handleCopyInvite}
              className="inline-flex items-center gap-1 text-[hsl(var(--secondary))] hover:underline"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
        )}
      </div>

      {/* Members list */}
      <div className={`rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] ${section !== "users" ? "hidden" : ""}`}>
        <div className="border-b border-[hsl(var(--border))] px-5 py-3">
          <h2 className="text-lg font-brand text-[hsl(var(--foreground))]">
            Members ({members.length})
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-center text-sm text-[hsl(var(--muted-foreground))] py-8">
            No members yet. Invite someone above.
          </p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border))]">
            {members.map((member) => {
              const isSelf = member.id === user?.id;
              const isOwner = member.globalRole === "owner";
              return (
                <li
                  key={member.id}
                  className="flex items-center gap-4 px-5 py-3"
                >
                  {/* Avatar placeholder */}
                  <div className="h-9 w-9 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-sm font-medium text-[hsl(var(--muted-foreground))]">
                    {(member.displayName || member.email)[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
                        {member.displayName || member.email}
                      </span>
                      {isSelf && (
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                          (you)
                        </span>
                      )}
                      {isOwner && (
                        <span title="Global owner">
                          <Crown className="h-3.5 w-3.5 text-amber-500" />
                        </span>
                      )}
                      {!member.hasPassword && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          Invited
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[hsl(var(--muted-foreground))] truncate block">
                      {member.email}
                    </span>
                  </div>

                  {/* Role selector */}
                  <select
                    value={member.orgRole}
                    onChange={(e) =>
                      handleRoleChange(member.id, e.target.value)
                    }
                    disabled={isSelf}
                    className={`rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 py-1 text-xs text-[hsl(var(--foreground))] ${isSelf ? "opacity-50 cursor-not-allowed" : ""}`}
                    title={isSelf ? "You cannot change your own role" : "Change role"}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>

                  {/* Custom-role overlay selector */}
                  {customRoles.length > 0 && (
                    <select
                      value={member.customRoleId ?? ""}
                      onChange={(e) => handleCustomRoleChange(member.id, e.target.value)}
                      disabled={isSelf}
                      className={`rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 py-1 text-xs text-[hsl(var(--foreground))] ${isSelf ? "opacity-50 cursor-not-allowed" : ""}`}
                      title="Custom role overlay (replaces base permissions)"
                      aria-label={`Custom role for ${member.displayName || member.email}`}
                    >
                      <option value="">No custom role</option>
                      {customRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Role badge (visible on smaller contexts) */}
                  <span
                    className={`hidden sm:inline-flex text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${roleBadge(member.orgRole)}`}
                  >
                    {roleLabel(member.orgRole)}
                  </span>

                  {/* Remove button */}
                  <button
                    onClick={() => setPendingRemoveMember(member)}
                    disabled={isSelf}
                    className={`p-1.5 rounded-md transition-colors ${
                      isSelf
                        ? "text-[hsl(var(--muted-foreground))] opacity-30 cursor-not-allowed"
                        : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] hover:bg-[hsl(var(--muted))]"
                    }`}
                    title={isSelf ? "You cannot remove yourself" : "Remove from organization"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingRemoveMember)}
        title={pendingRemoveMember ? `Remove ${pendingRemoveMember.displayName || pendingRemoveMember.email}?` : "Remove member?"}
        description="This removes the member from the current organization."
        confirmLabel="Remove member"
        busy={removingMemberId === pendingRemoveMember?.id}
        onClose={() => {
          if (!removingMemberId) {
            setPendingRemoveMember(null);
          }
        }}
        onConfirm={handleRemove}
      />
    </div>
  );
}
