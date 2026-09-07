import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { User } from "lucide-react";
import { roleLabel } from "@vpc-music/shared";
import { useAuth } from "@/contexts/AuthContext";
import { platformApi } from "@/lib/api-client";
import { SettingsSection } from "./SettingsSection";

/** Display name, email, password, and who you are on the team. */
export function ProfileSection() {
  const { user, activeOrg, refreshUser } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!displayName.trim()) {
      toast.error("Display name is required");
      return;
    }
    setSavingProfile(true);
    try {
      await platformApi.updateProfile({ displayName: displayName.trim() });
      await refreshUser();
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setSavingPassword(true);
    try {
      await platformApi.changePassword({ currentPassword, newPassword });
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <SettingsSection
      id="profile"
      title="Profile"
      icon={User}
      description={
        activeOrg
          ? `${activeOrg.name} · ${user?.role === "owner" ? "Owner" : roleLabel(activeOrg.role)}`
          : "You are not on a team yet."
      }
    >
      <form onSubmit={handleSaveProfile} className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-[hsl(var(--muted-foreground))]">Email</span>
          <input type="email" value={user?.email || ""} disabled className="input w-full opacity-60" aria-label="Email" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[hsl(var(--muted-foreground))]">Display name</span>
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="input w-full"
            placeholder="Your name"
            aria-label="Display name"
          />
        </label>
        <button type="submit" disabled={savingProfile} className="btn-primary btn-sm">
          {savingProfile ? "Saving..." : "Save profile"}
        </button>
      </form>

      <form onSubmit={handleChangePassword} className="space-y-3 border-t border-[hsl(var(--border))] pt-4">
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Change password</h3>
        <label className="block text-sm">
          <span className="mb-1 block text-[hsl(var(--muted-foreground))]">Current password</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            className="input w-full"
            aria-label="Current password"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-[hsl(var(--muted-foreground))]">New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              className="input w-full"
              aria-label="New password"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[hsl(var(--muted-foreground))]">Confirm new password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              className="input w-full"
              aria-label="Confirm new password"
            />
          </label>
        </div>
        <button type="submit" disabled={savingPassword} className="btn-outline btn-sm">
          {savingPassword ? "Changing..." : "Change password"}
        </button>
      </form>
    </SettingsSection>
  );
}
