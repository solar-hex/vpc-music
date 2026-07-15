import { useState, useEffect, useCallback } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { adminApi, shareApi, type DirectSongShare, type OrgUser, type ShareTeam, type ShareToken, type SongTeamShare } from "@/lib/api-client";
import { toast } from "sonner";
import { X, Copy, Check, ExternalLink, Ban, Plus, Tag, Loader2 } from "lucide-react";

interface ConfirmState {
  title: string;
  description: string;
  confirmLabel: string;
  action: () => Promise<void>;
}

interface ShareManageDialogProps {
  songId: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Dialog to manage share tokens for a song:
 * - List existing tokens with label, created date, status
 * - Create new tokens with optional label + expiry
 * - Copy share URLs, rename labels, revoke tokens
 */
export function ShareManageDialog({ songId, open, onClose }: ShareManageDialogProps) {
  const [shares, setShares] = useState<ShareToken[]>([]);
  const [directShares, setDirectShares] = useState<DirectSongShare[]>([]);
  const [teams, setTeams] = useState<ShareTeam[]>([]);
  const [teamShares, setTeamShares] = useState<SongTeamShare[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatingDirectShare, setCreatingDirectShare] = useState(false);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [sharingTeamId, setSharingTeamId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [newDirectShareEmail, setNewDirectShareEmail] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamMemberIds, setNewTeamMemberIds] = useState<string[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [removingDirectShareId, setRemovingDirectShareId] = useState<string | null>(null);
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);
  const [removingTeamShareId, setRemovingTeamShareId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmingAction, setConfirmingAction] = useState(false);

  const loadShares = useCallback(async () => {
    setLoading(true);
    try {
      const [res, directRes, teamsRes, teamSharesRes, membersRes] = await Promise.all([
        shareApi.list(songId),
        shareApi.listDirect(songId),
        shareApi.listTeams(),
        shareApi.listTeamShares(songId),
        adminApi.listUsers(),
      ]);
      setShares(res.shares);
      setDirectShares(directRes.directShares);
      setTeams(teamsRes.teams);
      setTeamShares(teamSharesRes.teamShares);
      setOrgMembers(membersRes.users);
    } catch {
      toast.error("Failed to load sharing settings");
    } finally {
      setLoading(false);
    }
  }, [songId]);

  useEffect(() => {
    if (open) {
      loadShares();
      setNewLabel("");
      setNewExpiry("");
      setNewDirectShareEmail("");
      setNewTeamName("");
      setNewTeamMemberIds([]);
      setSelectedTeamId("");
    }
  }, [open, loadShares]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const data: { label?: string; expiresInDays?: number } = {};
      if (newLabel.trim()) data.label = newLabel.trim();
      if (newExpiry) data.expiresInDays = parseInt(newExpiry, 10);

      await shareApi.create(songId, data);
      toast.success("Share link created");
      setNewLabel("");
      setNewExpiry("");
      await loadShares();
    } catch (err: any) {
      toast.error(err.message || "Failed to create link");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (token: string, id: string) => {
    const url = `${window.location.origin}/shared/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Link copied");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = async (tokenId: string) => {
    setConfirmState({
      title: "Revoke this share link?",
      description: "It will no longer be accessible.",
      confirmLabel: "Revoke link",
      action: async () => {
        await shareApi.revoke(songId, tokenId);
        setShares((prev) => prev.map((s) => (s.id === tokenId ? { ...s, revoked: true } : s)));
        toast.success("Share link revoked");
      },
    });
  };

  const handleStartEdit = (share: ShareToken) => {
    setEditingId(share.id);
    setEditLabel(share.label || "");
  };

  const handleSaveLabel = async (tokenId: string) => {
    try {
      const res = await shareApi.update(songId, tokenId, {
        label: editLabel.trim() || null,
      });
      setShares((prev) =>
        prev.map((s) => (s.id === tokenId ? res.shareToken : s)),
      );
      setEditingId(null);
      toast.success("Label updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update label");
    }
  };

  const handleCreateDirectShare = async () => {
    const email = newDirectShareEmail.trim();
    if (!email) {
      toast.error("Email is required");
      return;
    }

    setCreatingDirectShare(true);
    try {
      const res = await shareApi.createDirect(songId, { email });
      setDirectShares((prev) => {
        const withoutExisting = prev.filter((share) => share.id !== res.directShare.id && share.userId !== res.directShare.userId);
        return [...withoutExisting, res.directShare];
      });
      setNewDirectShareEmail("");
      toast.success("Song shared with user");
    } catch (err: any) {
      toast.error(err.message || "Failed to share song");
    } finally {
      setCreatingDirectShare(false);
    }
  };

  const handleRemoveDirectShare = async (shareId: string) => {
    setConfirmState({
      title: "Remove this direct song share?",
      description: "The selected user will lose direct access to this song.",
      confirmLabel: "Remove share",
      action: async () => {
        setRemovingDirectShareId(shareId);
        try {
          await shareApi.removeDirect(songId, shareId);
          setDirectShares((prev) => prev.filter((share) => share.id !== shareId));
          toast.success("Direct share removed");
        } finally {
          setRemovingDirectShareId(null);
        }
      },
    });
  };

  const handleCreateTeam = async () => {
    const name = newTeamName.trim();
    if (!name) {
      toast.error("Team name is required");
      return;
    }

    if (newTeamMemberIds.length === 0) {
      toast.error("Select at least one team member");
      return;
    }

    setCreatingTeam(true);
    try {
      const res = await shareApi.createTeam({ name, userIds: newTeamMemberIds });
      setTeams((prev) => [...prev, res.team]);
      setNewTeamName("");
      setNewTeamMemberIds([]);
      setSelectedTeamId(res.team.id);
      toast.success("Share team created");
    } catch (err: any) {
      toast.error(err.message || "Failed to create team");
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleShareWithTeam = async () => {
    if (!selectedTeamId) {
      toast.error("Choose a team first");
      return;
    }

    setSharingTeamId(selectedTeamId);
    try {
      const res = await shareApi.createTeamShare(songId, { teamId: selectedTeamId });
      setTeamShares((prev) => {
        const withoutExisting = prev.filter((share) => share.id !== res.teamShare.id && share.teamId !== res.teamShare.teamId);
        return [...withoutExisting, res.teamShare];
      });
      toast.success("Song shared with team");
    } catch (err: any) {
      toast.error(err.message || "Failed to share song with team");
    } finally {
      setSharingTeamId(null);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    setConfirmState({
      title: "Delete this share team?",
      description: "Songs shared to it will lose team access.",
      confirmLabel: "Delete team",
      action: async () => {
        setDeletingTeamId(teamId);
        try {
          await shareApi.deleteTeam(teamId);
          setTeams((prev) => prev.filter((team) => team.id !== teamId));
          setTeamShares((prev) => prev.filter((share) => share.teamId !== teamId));
          if (selectedTeamId === teamId) {
            setSelectedTeamId("");
          }
          toast.success("Share team deleted");
        } finally {
          setDeletingTeamId(null);
        }
      },
    });
  };

  const handleRemoveTeamShare = async (shareId: string) => {
    setConfirmState({
      title: "Remove this team song share?",
      description: "The shared team will lose access to this song.",
      confirmLabel: "Remove team share",
      action: async () => {
        setRemovingTeamShareId(shareId);
        try {
          await shareApi.removeTeamShare(songId, shareId);
          setTeamShares((prev) => prev.filter((share) => share.id !== shareId));
          toast.success("Team share removed");
        } finally {
          setRemovingTeamShareId(null);
        }
      },
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmState) return;
    setConfirmingAction(true);
    try {
      await confirmState.action();
      setConfirmState(null);
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setConfirmingAction(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatus = (share: ShareToken) => {
    if (share.revoked) return { text: "Revoked", color: "text-red-500" };
    if (share.expiresAt && new Date(share.expiresAt) < new Date())
      return { text: "Expired", color: "text-amber-500" };
    return { text: "Active", color: "text-green-500" };
  };

  if (!open) return null;

  const activeShares = shares.filter((s) => !s.revoked);
  const revokedShares = shares.filter((s) => s.revoked);
  const availableTeams = teams.filter((team) => !teamShares.some((share) => share.teamId === team.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 print-hidden">
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4">
          <h3 className="text-lg font-brand text-[hsl(var(--foreground))]">
            Manage Share Links
          </h3>
          <button
            onClick={onClose}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Create new link section */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-[hsl(var(--foreground))]">
              Create New Link
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Label (optional)"
                className="flex-1 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              />
              <select
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value)}
                className="rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 py-2 text-sm text-[hsl(var(--foreground))]"
              >
                <option value="">No expiry</option>
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
              </select>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--secondary))] px-3 py-2 text-sm font-medium text-[hsl(var(--secondary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Create
              </button>
            </div>
          </div>

          <hr className="border-[hsl(var(--border))]" />

          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-[hsl(var(--foreground))]">
                Share with Specific Users
              </h4>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Grant access to signed-in users without creating a public link.
              </p>
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                value={newDirectShareEmail}
                onChange={(e) => setNewDirectShareEmail(e.target.value)}
                placeholder="User email"
                className="flex-1 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              />
              <button
                onClick={handleCreateDirectShare}
                disabled={creatingDirectShare}
                className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--secondary))] px-3 py-2 text-sm font-medium text-[hsl(var(--secondary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {creatingDirectShare ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Share
              </button>
            </div>

            {directShares.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                No direct user shares yet.
              </p>
            ) : (
              <div className="space-y-2">
                {directShares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-[hsl(var(--border))] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
                        {share.displayName || share.email}
                      </p>
                      {share.displayName && (
                        <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                          {share.email}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDirectShare(share.id)}
                      disabled={removingDirectShareId === share.id}
                      className="rounded-md border border-[hsl(var(--border))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <hr className="border-[hsl(var(--border))]" />

          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-[hsl(var(--foreground))]">
                Share with Teams
              </h4>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Share this song with a reusable team of organization members.
              </p>
            </div>

            <div className="flex gap-2">
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="flex-1 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
              >
                <option value="">Select a team</option>
                {availableTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.memberCount})
                  </option>
                ))}
              </select>
              <button
                onClick={handleShareWithTeam}
                disabled={!selectedTeamId || sharingTeamId === selectedTeamId}
                className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--secondary))] px-3 py-2 text-sm font-medium text-[hsl(var(--secondary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {sharingTeamId === selectedTeamId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Share
              </button>
            </div>

            {teamShares.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                This song is not shared with any teams yet.
              </p>
            ) : (
              <div className="space-y-2">
                {teamShares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-[hsl(var(--border))] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">{share.teamName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTeamShare(share.id)}
                      disabled={removingTeamShareId === share.id}
                      className="rounded-md border border-[hsl(var(--border))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <hr className="border-[hsl(var(--border))]" />

          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-[hsl(var(--foreground))]">
                Create Share Team
              </h4>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Create a reusable team for sharing songs with the same group of members.
              </p>
            </div>
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Band, vocals, youth team..."
              className="w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            />
            <select
              multiple
              value={newTeamMemberIds}
              onChange={(e) => setNewTeamMemberIds(Array.from(e.target.selectedOptions).map((option) => option.value))}
              className="min-h-28 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
            >
              {orgMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {(member.displayName || member.email)} — {member.orgRole}
                </option>
              ))}
            </select>
            <button
              onClick={handleCreateTeam}
              disabled={creatingTeam}
              className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--secondary))] px-3 py-2 text-sm font-medium text-[hsl(var(--secondary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {creatingTeam ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Team
            </button>

            {teams.length > 0 && (
              <div className="space-y-2">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-[hsl(var(--border))] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">{team.name}</p>
                      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                        {team.memberNames.join(", ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteTeam(team.id)}
                      disabled={deletingTeamId === team.id}
                      className="rounded-md border border-[hsl(var(--border))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <hr className="border-[hsl(var(--border))]" />

          {/* Loading */}
          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
            </div>
          )}

          {/* Empty state */}
          {!loading && shares.length === 0 && (
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))] py-4">
              No share links yet. Create one above.
            </p>
          )}

          {/* Active tokens */}
          {activeShares.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Active ({activeShares.length})
              </h4>
              {activeShares.map((share) => (
                <ShareRow
                  key={share.id}
                  share={share}
                  status={getStatus(share)}
                  copiedId={copiedId}
                  editingId={editingId}
                  editLabel={editLabel}
                  onCopy={handleCopy}
                  onRevoke={handleRevoke}
                  onStartEdit={handleStartEdit}
                  onEditLabelChange={setEditLabel}
                  onSaveLabel={handleSaveLabel}
                  onCancelEdit={() => setEditingId(null)}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}

          {/* Revoked tokens */}
          {revokedShares.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Revoked ({revokedShares.length})
              </h4>
              {revokedShares.map((share) => (
                <ShareRow
                  key={share.id}
                  share={share}
                  status={getStatus(share)}
                  copiedId={copiedId}
                  editingId={editingId}
                  editLabel={editLabel}
                  onCopy={handleCopy}
                  onRevoke={handleRevoke}
                  onStartEdit={handleStartEdit}
                  onEditLabelChange={setEditLabel}
                  onSaveLabel={handleSaveLabel}
                  onCancelEdit={() => setEditingId(null)}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[hsl(var(--border))] px-5 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md border border-[hsl(var(--border))] px-4 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title ?? "Confirm action"}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        busy={confirmingAction}
        onClose={() => {
          if (!confirmingAction) {
            setConfirmState(null);
          }
        }}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}

// ── Individual share row ─────────────────────────────────────
interface ShareRowProps {
  share: ShareToken;
  status: { text: string; color: string };
  copiedId: string | null;
  editingId: string | null;
  editLabel: string;
  onCopy: (token: string, id: string) => void;
  onRevoke: (id: string) => void;
  onStartEdit: (share: ShareToken) => void;
  onEditLabelChange: (val: string) => void;
  onSaveLabel: (id: string) => void;
  onCancelEdit: () => void;
  formatDate: (d?: string) => string;
}

function ShareRow({
  share,
  status,
  copiedId,
  editingId,
  editLabel,
  onCopy,
  onRevoke,
  onStartEdit,
  onEditLabelChange,
  onSaveLabel,
  onCancelEdit,
  formatDate,
}: ShareRowProps) {
  const isEditing = editingId === share.id;
  const isRevoked = !!share.revoked;
  const isExpired = share.expiresAt ? new Date(share.expiresAt) < new Date() : false;

  return (
    <div
      className={`rounded-md border border-[hsl(var(--border))] px-3 py-2.5 space-y-1.5 ${
        isRevoked || isExpired ? "opacity-60" : ""
      }`}
    >
      {/* Top row: label + status + actions */}
      <div className="flex items-center gap-2">
        {isEditing ? (
          <div className="flex flex-1 items-center gap-1.5">
            <input
              type="text"
              value={editLabel}
              onChange={(e) => onEditLabelChange(e.target.value)}
              placeholder="Enter label..."
              className="flex-1 rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 py-1 text-xs text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveLabel(share.id);
                if (e.key === "Escape") onCancelEdit();
              }}
            />
            <button
              onClick={() => onSaveLabel(share.id)}
              className="text-xs text-[hsl(var(--secondary))] hover:underline"
            >
              Save
            </button>
            <button
              onClick={onCancelEdit}
              className="text-xs text-[hsl(var(--muted-foreground))] hover:underline"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => onStartEdit(share)}
            className="flex-1 text-left text-sm font-medium text-[hsl(var(--foreground))] hover:text-[hsl(var(--secondary))] transition-colors truncate"
            title="Click to rename"
          >
            {share.label || (
              <span className="italic text-[hsl(var(--muted-foreground))]">
                Untitled link
              </span>
            )}
          </button>
        )}
        <span className={`text-xs font-semibold uppercase ${status.color}`}>
          {status.text}
        </span>
      </div>

      {/* Bottom row: meta + action buttons */}
      <div className="flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]">
        <span>Created {formatDate(share.createdAt)}</span>
        {share.expiresAt && !isRevoked && (
          <span>· Expires {formatDate(share.expiresAt)}</span>
        )}
        <div className="flex-1" />
        {!isRevoked && !isExpired && (
          <>
            <button
              onClick={() => onCopy(share.token, share.id)}
              className="inline-flex items-center gap-1 text-[hsl(var(--secondary))] hover:underline"
              title="Copy share link"
            >
              {copiedId === share.id ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copiedId === share.id ? "Copied" : "Copy"}
            </button>
            <a
              href={`/shared/${share.token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[hsl(var(--secondary))] hover:underline"
              title="Open share link"
            >
              <ExternalLink className="h-3 w-3" /> Open
            </a>
            <button
              onClick={() => onRevoke(share.id)}
              className="inline-flex items-center gap-1 text-[hsl(var(--destructive))] hover:underline"
              title="Revoke this link"
            >
              <Ban className="h-3 w-3" /> Revoke
            </button>
          </>
        )}
      </div>
    </div>
  );
}
