import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { platformApi } from "@/lib/api-client";
import { toast } from "sonner";
import { roleLabel } from "@vpc-music/shared";
import { User, Lock } from "lucide-react";

const inputClass =
  "w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]";

/** Settings → Profile: display name, email, avatar initials, password. */
export function SettingsProfileTab() {
  const { user, activeOrg, refreshUser } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const initials = (user?.displayName || user?.email || "")
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("");

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="space-y-8 max-w-2xl">
      {/* Profile */}
      <section className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <h3 className="flex items-center gap-2 text-lg font-brand text-[hsl(var(--foreground))]">
          <User className="h-5 w-5 text-[hsl(var(--secondary))]" />
          Profile
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-sm font-bold text-[hsl(var(--secondary-foreground))]">
            {initials}
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Your avatar uses your initials across the app.
          </p>
        </div>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-[hsl(var(--foreground))]">Email</label>
            <input id="email" type="email" value={user?.email || ""} disabled className={`${inputClass} opacity-60`} />
          </div>
          <div className="space-y-2">
            <label htmlFor="displayName" className="text-sm font-medium text-[hsl(var(--foreground))]">
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClass}
              placeholder="Your name"
            />
          </div>
          <button type="submit" disabled={savingProfile} className="btn-primary btn-sm">
            {savingProfile ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </section>

      {/* Password */}
      <section className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <h3 className="flex items-center gap-2 text-lg font-brand text-[hsl(var(--foreground))]">
          <Lock className="h-5 w-5 text-[hsl(var(--secondary))]" />
          Change Password
        </h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="currentPassword" className="text-sm font-medium text-[hsl(var(--foreground))]">
              Current Password
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="newPassword" className="text-sm font-medium text-[hsl(var(--foreground))]">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="confirmNewPassword" className="text-sm font-medium text-[hsl(var(--foreground))]">
              Confirm New Password
            </label>
            <input
              id="confirmNewPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className={inputClass}
            />
          </div>
          <button type="submit" disabled={savingPassword} className="btn-primary btn-sm">
            {savingPassword ? "Changing..." : "Change Password"}
          </button>
        </form>
      </section>

      {/* Account info */}
      <section className="space-y-2 text-xs text-[hsl(var(--muted-foreground))]">
        {activeOrg && (
          <>
            <p>Organization: {activeOrg.name}</p>
            <p>Organization Role: {roleLabel(activeOrg.role)}</p>
          </>
        )}
        {user?.role === "owner" && <p>Global Role: Owner</p>}
        <p>User ID: {user?.id}</p>
      </section>
    </div>
  );
}
