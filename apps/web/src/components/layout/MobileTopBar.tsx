import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Menu, X, Sun, Moon, Search } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { ThemedLogo } from "@/components/ui/ThemedLogo";
import { OrgSwitcher } from "./OrgSwitcher";
import { SidebarUserBlock } from "./SidebarUserBlock";
import { visibleNavSections, sidebarNavLinkClass } from "./Sidebar";

export function MobileTopBar({
  onRequestCreateOrg,
  onLogout,
  bottomExtras,
}: {
  onRequestCreateOrg: () => void;
  onLogout: () => void;
  /** Extra controls in the drawer's bottom bar (e.g. notification bell). */
  bottomExtras?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { user, activeOrg } = useAuth();
  const isAdmin = activeOrg?.role === "admin" || user?.role === "owner";

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      {/* Mobile top bar */}
      <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between gap-4 px-4 border-b border-[hsl(var(--border))] glass">
        <NavLink
          to="/dashboard"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity rounded-sm"
          aria-label="VPC Music — go to dashboard"
        >
          <ThemedLogo className="h-7 w-7 rounded-md" alt="" />
          <span className="font-brand text-lg text-[hsl(var(--secondary))]">VPC Music</span>
        </NavLink>

        <div className="flex items-center gap-1">
          <button
            onClick={() => window.dispatchEvent(new Event("vpc:open-launcher"))}
            className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            aria-label="Search songs"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            onClick={() => setOpen(!open)}
            className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav-drawer"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        id="mobile-nav-drawer"
        className={`fixed top-14 left-0 bottom-0 z-50 w-72 flex flex-col bg-[hsl(var(--card))] border-r border-[hsl(var(--border))] transition-transform duration-200 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        {/* Org switcher */}
        <div className="px-4 py-3 border-b border-[hsl(var(--border))]">
          <p className="text-xs text-[hsl(var(--muted-foreground))]/70 mb-1.5 font-medium uppercase tracking-wide">
            Organization
          </p>
          <OrgSwitcher onRequestCreate={onRequestCreateOrg} />
        </div>

        {/* Nav sections */}
        <nav className="flex-1 flex flex-col gap-4 px-3 py-4 overflow-y-auto">
          {visibleNavSections(isAdmin).map((section, i) => (
            <div key={section.title || i} className="flex flex-col gap-2">
              {section.title && (
                <p className="px-3 text-xs font-semibold uppercase text-[hsl(var(--muted-foreground))]/70 tracking-wider">
                  {section.title}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink key={item.to} to={item.to} className={sidebarNavLinkClass} onClick={() => setOpen(false)}>
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User + bottom controls */}
        <div className="border-t border-[hsl(var(--border))] px-2">
          <SidebarUserBlock onLogout={onLogout} />
        </div>
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
      </div>
    </div>
  );
}
