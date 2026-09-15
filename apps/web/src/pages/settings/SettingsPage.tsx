import { useRef, type KeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ProfileSection } from "./ProfileSection";
import { AppearanceSection } from "./AppearanceSection";
import { TeamSection } from "./TeamSection";
import { DataSection } from "./DataSection";
import { OfflineSection } from "./OfflineSection";
import { AboutSection } from "./AboutSection";

const SECTIONS = [
  { id: "profile", label: "Profile", Panel: ProfileSection },
  { id: "appearance", label: "Appearance", Panel: AppearanceSection },
  { id: "team", label: "Team", Panel: TeamSection, adminOnly: true },
  { id: "offline", label: "Offline", Panel: OfflineSection },
  { id: "data", label: "Data", Panel: DataSection },
  { id: "about", label: "About", Panel: AboutSection },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/**
 * The one settings page, as tabs: pick one and only that section shows. Team
 * is only for admins (and the platform owner); everything else is per person.
 *
 * The hash is the tab's address, so a reload, a link someone sends, or the old
 * /admin redirect (`/settings#team`) opens the right one. Anything else,
 * including #team for someone who cannot see Team, opens Profile.
 */
export function SettingsPage() {
  const { user, activeOrg } = useAuth();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === "owner" || activeOrg?.role === "admin";
  const sections = SECTIONS.filter((section) => !("adminOnly" in section && section.adminOnly) || isAdmin);
  const selected = sections.find((section) => `#${section.id}` === hash) ?? sections[0];
  const tabs = useRef(new Map<SectionId, HTMLButtonElement>());

  // Replace, not push: flicking through tabs should not fill the back button.
  const select = (id: SectionId) => navigate({ hash: `#${id}` }, { replace: true });

  // Arrow keys move along the tabs, as a screen reader user expects of a tablist.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = sections.findIndex((section) => section.id === selected.id);
    const last = sections.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : -1;
    if (next < 0) return;
    event.preventDefault();
    select(sections[next].id);
    tabs.current.get(sections[next].id)?.focus();
  };

  const { Panel } = selected;

  return (
    <div className="space-y-6 px-3 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-brand text-[hsl(var(--foreground))]">Settings</h1>
        <div role="tablist" aria-label="Settings sections" className="mt-3 flex flex-wrap gap-2" onKeyDown={onKeyDown}>
          {sections.map((section) => {
            const active = section.id === selected.id;
            return (
              <button
                key={section.id}
                ref={(node) => {
                  if (node) tabs.current.set(section.id, node);
                  else tabs.current.delete(section.id);
                }}
                type="button"
                role="tab"
                id={`settings-tab-${section.id}`}
                aria-selected={active}
                // Only the open tab has a panel in the page to point at.
                aria-controls={active ? `settings-panel-${section.id}` : undefined}
                tabIndex={active ? 0 : -1}
                onClick={() => select(section.id)}
                className={`btn-sm ${active ? "btn-primary" : "btn-outline"}`}
              >
                {section.label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" id={`settings-panel-${selected.id}`} aria-labelledby={`settings-tab-${selected.id}`}>
        <Panel />
      </div>
    </div>
  );
}
