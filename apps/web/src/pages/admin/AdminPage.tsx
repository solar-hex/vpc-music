import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { adminApi, rolesApi, orgsApi, type OrgUser, type OrgRole } from "@/lib/api-client";
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
  Send,
  Users,
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
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Bulk invite
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkRole, setBulkRole] = useState("musician");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Provision an org for someone else (owner only)
  const isPlatformOwner = user?.role === "owner";
  const [provName, setProvName] = useState("");
  const [provEmail, setProvEmail] = useState("");
  const [provDisplayName, setProvDisplayName] = useState("");
  const [provisioning, setProvisioning] = useState(false);
  const [provInviteUrl, setProvInviteUrl] = useState<string | null>(null);

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
  }, [isAdmin]);

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

  const handleResend = async (member: OrgUser) => {
    setResendingId(member.id);
    try {
      const res = await adminApi.resendInvite(member.id);
      toast.success(res.message);
      setCopiedUrl(res.inviteUrl);
    } catch (err: any) {
      toast.error(err.message || "Failed to resend invite");
    } finally {
      setResendingId(null);
    }
  };

  const handleBulkInvite = async () => {
    // One entry per line: "email", or "email, Display Name".
    const entries = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [email, ...nameParts] = line.split(/[,;\t]/).map((p) => p.trim());
        return { email, displayName: nameParts.join(" ") || email, role: bulkRole };
      })
      .filter((e) => e.email);

    if (entries.length === 0) {
      toast.error("Add at least one email address");
      return;
    }
    setBulkSubmitting(true);
    try {
      const res = await adminApi.inviteBulk(entries);
      const skipped = res.results.filter((r) => r.status === "skipped").length;
      const errored = res.results.filter((r) => r.status === "error").length;
      toast.success(
        `${res.invited} invited${skipped ? `, ${skipped} already members` : ""}${errored ? `, ${errored} failed` : ""}`,
      );
      setBulkText("");
      setBulkOpen(false);
      await loadMembers();
    } catch (err: any) {
      toast.error(err.message || "Bulk invite failed");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provName.trim() || !provEmail.trim()) {
      toast.error("Organization name and admin email are required");
      return;
    }
    setProvisioning(true);
    try {
      const res = await orgsApi.provision({
        name: provName.trim(),
        adminEmail: provEmail.trim(),
        adminDisplayName: provDisplayName.trim() || undefined,
      });
      toast.success(`Created ${res.organization.name} and invited ${res.admin.email} as admin`);
      setProvInviteUrl(res.admin.inviteUrl);
      setProvName("");
      setProvEmail("");
      setProvDisplayName("");
    } catch (err: any) {
      toast.error(err.message || "Failed to provision organization");
    } finally {
      setProvisioning(false);
    }
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

      {/* Invite section */}
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 space-y-4">
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

        {/* Bulk invite */}
        <div className="border-t border-[hsl(var(--border))] pt-3">
          <button
            type="button"
            onClick={() => setBulkOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--secondary))] hover:underline"
          >
            <Users className="h-4 w-4" /> {bulkOpen ? "Hide bulk invite" : "Invite several at once"}
          </button>
          {bulkOpen && (
            <div className="mt-3 space-y-2">
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={4}
                placeholder={"One per line:\njane@church.org, Jane Smith\nmark@church.org"}
                className="input font-mono text-xs"
                aria-label="Bulk invite emails"
              />
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-[hsl(var(--muted-foreground))]">Role for all:</label>
                <select
                  value={bulkRole}
                  onChange={(e) => setBulkRole(e.target.value)}
                  className="select btn-sm w-auto"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleBulkInvite}
                  disabled={bulkSubmitting}
                  className="btn-primary btn-sm"
                >
                  {bulkSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send invites
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Members list */}
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
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
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5"
                >
                  {/* Identity — full width on phones so controls wrap below */}
                  <div className="flex min-w-0 flex-1 basis-52 items-center gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-sm font-medium text-[hsl(var(--muted-foreground))]">
                      {(member.displayName || member.email)[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
                          {member.displayName || member.email}
                        </span>
                        {isSelf && (
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">
                            (you)
                          </span>
                        )}
                        {isOwner && (
                          <span title="Global owner">
                            <Crown className="h-3.5 w-3.5 text-amber-500" />
                          </span>
                        )}
                        {!member.hasPassword && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            Invited
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[hsl(var(--muted-foreground))] truncate block">
                        {member.email}
                      </span>
                    </div>
                  </div>

                  {/* Controls — second line on phones, inline on sm+ */}
                  <div className="flex w-full flex-wrap items-center gap-2 pl-12 sm:w-auto sm:pl-0">
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

                    {/* Role badge (desktop only) */}
                    <span
                      className={`hidden lg:inline-flex text-xs font-semibold uppercase px-2 py-0.5 rounded ${roleBadge(member.orgRole)}`}
                    >
                      {roleLabel(member.orgRole)}
                    </span>

                    {!member.hasPassword && !isSelf && (
                      <button
                        onClick={() => handleResend(member)}
                        disabled={resendingId === member.id}
                        className="p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--secondary))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50"
                        title="Resend invite link"
                        aria-label={`Resend invite to ${member.displayName || member.email}`}
                      >
                        {resendingId === member.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </button>
                    )}

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
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Provision an org for someone else — developer/owner only */}
      {isPlatformOwner && (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 space-y-4">
          <h2 className="text-lg font-brand text-[hsl(var(--foreground))] flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            Provision an organization
          </h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Create a brand-new organization for another team and make the person you name its admin. They&apos;ll get an
            email invite; you won&apos;t be added as a member. New orgs immediately see the shared core library.
          </p>
          <form onSubmit={handleProvision} className="flex flex-wrap gap-3">
            <input
              type="text"
              value={provName}
              onChange={(e) => setProvName(e.target.value)}
              placeholder="Organization name *"
              aria-label="New organization name"
              required
              className="flex-1 min-w-50 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
            />
            <input
              type="email"
              value={provEmail}
              onChange={(e) => setProvEmail(e.target.value)}
              placeholder="Admin email *"
              aria-label="Admin email"
              required
              className="flex-1 min-w-50 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={provDisplayName}
              onChange={(e) => setProvDisplayName(e.target.value)}
              placeholder="Admin name"
              aria-label="Admin display name"
              className="w-40 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
            />
            <button type="submit" disabled={provisioning} className="btn-primary">
              {provisioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Provision
            </button>
          </form>
          {provInviteUrl && (
            <div className="flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-xs">
              <span className="flex-1 truncate text-[hsl(var(--muted-foreground))]">{provInviteUrl}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(provInviteUrl);
                  toast.success("Invite link copied");
                }}
                className="inline-flex items-center gap-1 text-[hsl(var(--secondary))] hover:underline"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
          )}
        </div>
      )}

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
