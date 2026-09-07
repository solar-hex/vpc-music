import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ProfileSection } from "./ProfileSection";
import { AppearanceSection } from "./AppearanceSection";
import { TeamSection } from "./TeamSection";
import { DataSection } from "./DataSection";
import { AboutSection } from "./AboutSection";

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "appearance", label: "Appearance" },
  { id: "team", label: "Team", adminOnly: true },
  { id: "data", label: "Data" },
  { id: "about", label: "About" },
] as const;

/**
 * The one settings page: stacked sections with pill anchors. Team is only
 * for admins (and the platform owner); everything else is per person.
 */
export function SettingsPage() {
  const { user, activeOrg } = useAuth();
  const { hash } = useLocation();
  const isAdmin = user?.role === "owner" || activeOrg?.role === "admin";
  const sections = SECTIONS.filter((section) => !("adminOnly" in section && section.adminOnly) || isAdmin);

  // A hash from a link (or the old /admin redirect) scrolls to its section.
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(hash.slice(1));
    target?.scrollIntoView({ block: "start" });
  }, [hash]);

  return (
    <div className="space-y-8 px-3 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-brand text-[hsl(var(--foreground))]">Settings</h1>
        <nav aria-label="Settings sections" className="mt-3 flex flex-wrap gap-2">
          {sections.map((section) => (
            <a key={section.id} href={`#${section.id}`} className="btn-outline btn-sm">
              {section.label}
            </a>
          ))}
        </nav>
      </div>

      <ProfileSection />
      <AppearanceSection />
      {isAdmin && <TeamSection />}
      <DataSection />
      <AboutSection />
    </div>
  );
}
