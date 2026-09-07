import { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Info, LogOut, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { SettingsSection } from "./SettingsSection";

// The changelog dialog embeds the whole CHANGELOG.md; load it on demand.
const ChangelogDialog = lazy(() => import("@/components/layout/ChangelogDialog"));

/** Version, what's new, sign out. */
export function AboutSection() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [changelogOpen, setChangelogOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success("Signed out");
    navigate("/login");
  };

  return (
    <SettingsSection id="about" title="About" icon={Info} description={`VPC Music ${__APP_VERSION__}`}>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setChangelogOpen(true)} className="btn-outline btn-sm">
          <Sparkles className="h-4 w-4" /> What's new
        </button>
        <button type="button" onClick={() => void handleLogout()} className="btn-ghost btn-sm">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
      {changelogOpen && (
        <Suspense fallback={null}>
          <ChangelogDialog onClose={() => setChangelogOpen(false)} />
        </Suspense>
      )}
    </SettingsSection>
  );
}
