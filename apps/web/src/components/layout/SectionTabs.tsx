import { NavLink, Outlet } from "react-router-dom";

export interface SectionTab {
  /** Relative path within the section ("" = index tab) */
  to: string;
  label: string;
}

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `relative px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
    isActive
      ? "border-[hsl(var(--secondary))] text-[hsl(var(--secondary))]"
      : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
  }`;

/** Persistent sub-header of tabs. Tabs are nested routes, not local state. */
export function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  return (
    <nav
      className="flex items-center gap-1 border-b border-[hsl(var(--border))] overflow-x-auto print-hidden"
      aria-label="Section tabs"
    >
      {tabs.map((tab) => (
        <NavLink key={tab.to || "index"} to={tab.to} end={tab.to === ""} className={tabClass}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * Layout route for a tabbed section: tab bar + the active tab's content via
 * <Outlet/>. Deep-linkable and back-button-safe. Tab pages own their headers.
 */
export function SectionLayout({ tabs }: { tabs: SectionTab[] }) {
  return (
    <div className="space-y-4">
      <SectionTabs tabs={tabs} />
      <Outlet />
    </div>
  );
}
