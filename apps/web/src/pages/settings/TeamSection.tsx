import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Copy, Loader2, Send, Trash2, Users } from "lucide-react";
import { roleLabel, ROLE_DESCRIPTIONS } from "@vpc-music/shared";
import { useAuth } from "@/contexts/AuthContext";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { adminApi, orgsApi, type OrgUser } from "@/lib/api-client";
import { SettingsSection } from "./SettingsSection";

const ROLE_OPTIONS = [
  { value: "admin", label: "Worship Leader" },
  { value: "musician", label: "Musician" },
  { value: "observer", label: "Observer" },
];

/**
 * Admin only: the team's name, invitations (one or many) and the member list
 * with role changes, invite resends and removal.
 */
export function TeamSection() {
  const { user, activeOrg, refreshUser } = useAuth();
  const [members, setMembers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [teamName, setTeamName] = useState(activeOrg?.name ?? "");
  const [savingName, setSavingName] = useState(false);

  const [invEmail, setInvEmail] = useState("");
  const [invName, setInvName] = useState("");
  const [invRole, setInvRole] = useState("musician");
  const [inviting, setInviting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkRole, setBulkRole] = useState("musician");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const [resendingId, setResendingId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<OrgUser | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    setTeamName(activeOrg?.name ?? "");
  }, [activeOrg?.name]);

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
    void loadMembers();
  }, [loadMembers]);

  const handleRename = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeOrg) return;
    if (!teamName.trim()) {
      toast.error("Team name is required");
      return;
    }
    setSavingName(true);
    try {
      await orgsApi.update(activeOrg.id, { name: teamName.trim() });
      await refreshUser();
      toast.success("Team renamed");
    } catch (err: any) {
      toast.error(err.message || "Failed to rename the team");
    } finally {
      setSavingName(false);
    }
  };

  const handleInvite = async (event: FormEvent) => {
    event.preventDefault();
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
      const res = await adminApi.invite({ email: invEmail.trim(), displayName: invName.trim(), role: invRole });
      toast.success(res.message);
      setInviteUrl(res.inviteUrl);
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

  const handleBulkInvite = async () => {
    // One entry per line: "email", or "email, Display Name".
    const entries = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [email, ...nameParts] = line.split(/[,;\t]/).map((part) => part.trim());
        return { email, displayName: nameParts.join(" ") || email, role: bulkRole };
      })
      .filter((entry) => entry.email);
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

  const handleCopyInvite = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied");
  };

  const handleResend = async (member: OrgUser) => {
    setResendingId(member.id);
    try {
      const res = await adminApi.resendInvite(member.id);
      toast.success(res.message);
      setInviteUrl(res.inviteUrl);
    } catch (err: any) {
      toast.error(err.message || "Failed to resend invite");
    } finally {
      setResendingId(null);
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await adminApi.updateRole(userId, role);
      setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, orgRole: role as OrgUser["orgRole"] } : m)));
      toast.success("Role updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    }
  };

  const handleRemove = async () => {
    if (!pendingRemove) return;
    setRemovingId(pendingRemove.id);
    try {
      const res = await adminApi.removeMember(pendingRemove.id);
      toast.success(res.message);
      setMembers((prev) => prev.filter((m) => m.id !== pendingRemove.id));
      setPendingRemove(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <SettingsSection id="team" title="Team" icon={Users} description="Who can see and edit the library.">
      {activeOrg && (
        <form onSubmit={handleRename} className="flex flex-wrap items-end gap-2">
          <label className="block flex-1 text-sm">
            <span className="mb-1 block text-[hsl(var(--muted-foreground))]">Team name</span>
            <input
              type="text"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              className="input w-full"
              aria-label="Team name"
              disabled={savingName}
            />
          </label>
          <button type="submit" disabled={savingName} className="btn-outline btn-sm">
            {savingName ? "Saving..." : "Rename"}
          </button>
        </form>
      )}

      <form onSubmit={handleInvite} className="space-y-2 border-t border-[hsl(var(--border))] pt-4">
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Invite someone</h3>
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            value={invEmail}
            onChange={(event) => setInvEmail(event.target.value)}
            placeholder="Email address"
            aria-label="Email address"
            className="input min-w-0 flex-1 basis-48"
          />
          <input
            type="text"
            value={invName}
            onChange={(event) => setInvName(event.target.value)}
            placeholder="Display name"
            aria-label="Display name for the invite"
            className="input min-w-0 flex-1 basis-40"
          />
          <select value={invRole} onChange={(event) => setInvRole(event.target.value)} className="select w-auto" aria-label="Role">
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button type="submit" disabled={inviting} className="btn-primary btn-sm">
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send invite
          </button>
        </div>
        {ROLE_DESCRIPTIONS[invRole as keyof typeof ROLE_DESCRIPTIONS] && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            <span className="font-medium">{ROLE_OPTIONS.find((r) => r.value === invRole)?.label ?? invRole}:</span>{" "}
            {ROLE_DESCRIPTIONS[invRole as keyof typeof ROLE_DESCRIPTIONS]}
          </p>
        )}
        {inviteUrl && (
          <div className="flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-xs">
            <span className="flex-1 truncate text-[hsl(var(--muted-foreground))]">{inviteUrl}</span>
            <button type="button" onClick={() => void handleCopyInvite()} className="inline-flex items-center gap-1 text-[hsl(var(--secondary))] hover:underline">
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
        )}
        <button type="button" onClick={() => setBulkOpen((open) => !open)} className="text-sm text-[hsl(var(--secondary))] hover:underline">
          {bulkOpen ? "Hide bulk invite" : "Invite several at once"}
        </button>
        {bulkOpen && (
          <div className="space-y-2">
            <textarea
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
              rows={4}
              placeholder={"One per line:\njane@church.org, Jane Smith\nmark@church.org"}
              className="input font-mono text-xs"
              aria-label="Bulk invite emails"
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-[hsl(var(--muted-foreground))]" htmlFor="bulk-role">
                Role for all:
              </label>
              <select id="bulk-role" value={bulkRole} onChange={(event) => setBulkRole(event.target.value)} className="select btn-sm w-auto">
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => void handleBulkInvite()} disabled={bulkSubmitting} className="btn-primary btn-sm">
                {bulkSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send invites
              </button>
            </div>
          </div>
        )}
      </form>

      <div className="border-t border-[hsl(var(--border))] pt-4">
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Members ({members.length})</h3>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : members.length === 0 ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">No members yet. Invite someone above.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[hsl(var(--border))]">
            {members.map((member) => {
              const isSelf = member.id === user?.id;
              const name = member.displayName || member.email;
              return (
                <li key={member.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                  <div className="min-w-0 flex-1 basis-48">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-[hsl(var(--foreground))]">{name}</span>
                      {isSelf && <span className="text-xs text-[hsl(var(--muted-foreground))]">(you)</span>}
                      {!member.hasPassword && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          Invited
                        </span>
                      )}
                    </div>
                    <span className="block truncate text-xs text-[hsl(var(--muted-foreground))]">{member.email}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <select
                      value={member.orgRole}
                      onChange={(event) => void handleRoleChange(member.id, event.target.value)}
                      disabled={isSelf}
                      className="select w-auto text-xs"
                      aria-label={`Role for ${name}`}
                      title={isSelf ? "You cannot change your own role" : `Change role (currently ${roleLabel(member.orgRole)})`}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    {!member.hasPassword && !isSelf && (
                      <button
                        type="button"
                        onClick={() => void handleResend(member)}
                        disabled={resendingId === member.id}
                        className="btn-icon btn-ghost h-11 w-11"
                        title="Resend invite link"
                        aria-label={`Resend invite to ${name}`}
                      >
                        {resendingId === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPendingRemove(member)}
                      disabled={isSelf}
                      className="btn-icon btn-ghost h-11 w-11 disabled:opacity-30"
                      title={isSelf ? "You cannot remove yourself" : "Remove from team"}
                      aria-label={`Remove ${name} from the team`}
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

      <ConfirmDialog
        open={Boolean(pendingRemove)}
        title={pendingRemove ? `Remove ${pendingRemove.displayName || pendingRemove.email}?` : "Remove member?"}
        description="They lose access to the library until invited again."
        confirmLabel="Remove member"
        busy={removingId === pendingRemove?.id}
        onClose={() => {
          if (!removingId) setPendingRemove(null);
        }}
        onConfirm={handleRemove}
      />
    </SettingsSection>
  );
}
