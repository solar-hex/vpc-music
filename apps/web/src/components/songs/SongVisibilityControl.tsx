import { useState } from "react";
import { songsApi, type Song, type SongTier } from "@/lib/api-client";
import { toast } from "sonner";
import { Lock, Users, Globe } from "lucide-react";

const TIER_META: Record<SongTier, { label: string; badge: string; Icon: typeof Lock }> = {
  personal: { label: "Private", badge: "badge-muted", Icon: Lock },
  organization: { label: "Organization", badge: "badge-muted", Icon: Users },
  global: { label: "Core library", badge: "badge-success", Icon: Globe },
};

/**
 * Shows a song's sharing tier and lets permitted users change it (story 6).
 * personal ↔ organization is available to the creator/admin; the global "core
 * library" tier is developer-only, so the option only appears for owners.
 */
export function SongVisibilityControl({
  song,
  isOwner,
  isAdmin,
  currentUserId,
  onChanged,
}: {
  song: Song;
  isOwner: boolean;
  isAdmin: boolean;
  currentUserId?: string;
  onChanged: (updated: Song) => void;
}) {
  const [saving, setSaving] = useState(false);
  const tier: SongTier = song.tier ?? "organization";
  const meta = TIER_META[tier];
  const isCreator = Boolean(song.createdBy && song.createdBy === currentUserId);
  const canManage = isOwner || isAdmin || isCreator;

  const change = async (next: SongTier) => {
    if (next === tier) return;
    setSaving(true);
    try {
      const res = await songsApi.setTier(song.id, next);
      onChanged(res.song);
      toast.success(
        next === "global"
          ? "Added to the global core library"
          : next === "personal"
            ? "Now private to you"
            : "Shared with your organization",
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to change visibility");
    } finally {
      setSaving(false);
    }
  };

  // Global songs are developer-managed: everyone else sees a read-only badge.
  if (tier === "global" && !isOwner) {
    return (
      <span className={meta.badge} title="Part of the platform-wide core library">
        <meta.Icon className="h-3 w-3" /> {meta.label}
      </span>
    );
  }

  if (!canManage) {
    // Don't clutter the header with the default "organization" state.
    if (tier === "organization") return null;
    return (
      <span className={meta.badge}>
        <meta.Icon className="h-3 w-3" /> {meta.label}
      </span>
    );
  }

  return (
    <select
      value={tier}
      onChange={(e) => change(e.target.value as SongTier)}
      disabled={saving}
      className="select btn-sm w-auto"
      title="Who can see this song"
      aria-label="Song visibility"
    >
      <option value="personal">Private (only me)</option>
      <option value="organization">Organization</option>
      {(isOwner || tier === "global") && <option value="global">Core library (all orgs)</option>}
    </select>
  );
}
