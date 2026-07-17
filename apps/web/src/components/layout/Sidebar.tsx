import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { LayoutDashboard, Layers, Mic2, Music, MicVocal, Disc3, FolderOpen, ShieldCheck, Settings, Sun, Moon, type LucideIcon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { ThemedLogo } from "@/components/ui/ThemedLogo";
import { OrgSwitcher } from "./OrgSwitcher";
import { listStagger, prefersReducedMotion } from "@/lib/motion";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "",
    items: [
      { to: "/admin", label: "Administration", icon: ShieldCheck, adminOnly: true },
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Planning",
    items: [
      { to: "/setlists", label: "Set Lists", icon: Layers },
      { to: "/rehearsals", label: "Rehearsals", icon: Mic2 },
    ],
  },
  {
    title: "Library",
    items: [
      { to: "/songs", label: "Songs", icon: Music },
      { to: "/artists", label: "Artists", icon: MicVocal },
      { to: "/albums", label: "Albums", icon: Disc3 },
      { to: "/media", label: "Media Library", icon: FolderOpen },
    ],
  },
  {
    title: "",
    items: [{ to: "/settings", label: "Settings", icon: Settings }],
  },
];

export function visibleNavSections(isAdmin: boolean): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.adminOnly || isAdmin),
  })).filter((section) => section.items.length > 0);
}

export const sidebarNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-[hsl(var(--secondary))]/15 text-[hsl(var(--secondary))]"
      : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
  }`;

function SidebarNavSection({ section }: { section: NavSection }) {
  const animate = !prefersReducedMotion();
  return (
    <motion.div
      className="flex flex-col gap-2"
      variants={listStagger.container}
      initial={animate ? "initial" : false}
      animate="animate"
    >
      {section.title && (
        <p className="px-3 text-xs font-semibold uppercase text-[hsl(var(--muted-foreground))]/70 tracking-wider">
          {section.title}
        </p>
      )}
      <div className="flex flex-col gap-0.5">
        {section.items.map((item) => {
          const Icon = item.icon;
          return (
            <motion.div key={item.to} variants={listStagger.item}>
              <NavLink to={item.to} className={sidebarNavLinkClass}>
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </NavLink>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

export function Sidebar({
  onRequestCreateOrg,
  bottomExtras,
}: {
  onRequestCreateOrg: () => void;
  /** Extra controls in the bottom bar (e.g. notification bell). */
  bottomExtras?: React.ReactNode;
}) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { user, activeOrg } = useAuth();
  const isAdmin = activeOrg?.role === "admin" || user?.role === "owner";

  return (
    <aside
      className="hidden md:flex flex-col w-60 shrink-0 border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] sticky top-0 h-screen"
      aria-label="Main navigation"
    >
      {/* Logo + org */}
      <div className="flex flex-col gap-1 px-4 pt-5 pb-4 border-b border-[hsl(var(--border))]">
        <NavLink
          to="/dashboard"
          className="flex items-center gap-2.5 mb-3 hover:opacity-80 transition-opacity rounded-sm"
          aria-label="VPC Music — go to dashboard"
        >
          <ThemedLogo className="h-8 w-8 rounded-md" alt="" />
          <span className="font-brand text-xl text-[hsl(var(--secondary))]">VPC Music</span>
        </NavLink>
        <OrgSwitcher onRequestCreate={onRequestCreateOrg} />
      </div>

      {/* Nav sections */}
      <nav className="flex-1 flex flex-col gap-6 px-3 py-4 overflow-y-auto">
        {visibleNavSections(isAdmin).map((section, i) => (
          <SidebarNavSection key={section.title || i} section={section} />
        ))}
      </nav>

      {/* Bottom controls */}
      <div className="flex items-center justify-end gap-1 px-4 py-3 border-t border-[hsl(var(--border))]">
        {bottomExtras}
        <button
          onClick={toggleTheme}
          className="btn-icon rounded-md bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          aria-label="Toggle theme"
        >
          {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
