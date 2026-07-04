"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, Music2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { OrgSwitcher } from "./org-switcher"
import { ThemeToggle } from "./theme-toggle"
import { UserMenu } from "./user-menu"
import { useAppShell } from "@/lib/app-shell-context"
import { MAIN_LINKS, LIBRARY_LINKS, TOOLS_LINKS } from "./top-nav"

export function MobileMenu() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { user } = useAppShell()

  // Close on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  return (
    <div className="md:hidden">
      {/* Mobile top bar */}
      <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between gap-4 px-4 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          aria-label="VPC Music — go to dashboard"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sidebar-primary">
            <Music2 className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">VPC Music</span>
        </Link>

        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md",
            "text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav-drawer"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
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
        className={cn(
          "fixed top-14 left-0 bottom-0 z-50 w-72 flex flex-col",
          "bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
          "transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        {/* Org switcher */}
        <div className="px-4 py-3 border-b border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/50 mb-1.5 font-medium uppercase tracking-wide">Organization</p>
          <OrgSwitcher />
        </div>

        {/* Nav links with sections */}
        <nav className="flex-1 flex flex-col gap-4 px-3 py-4 overflow-y-auto">
          {/* Main navigation */}
          <div className="flex flex-col gap-0.5">
            {MAIN_LINKS.map((link) => {
              const Icon = link.icon
              const isActive = pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-[#C09060]/20 text-[#C09060]"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {link.label}
                </Link>
              )
            })}
          </div>

          {/* Library section */}
          <div className="flex flex-col gap-2">
            <p className="px-3 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">Library</p>
            <div className="flex flex-col gap-0.5">
              {LIBRARY_LINKS.map((link) => {
                const Icon = link.icon
                const isActive = pathname.startsWith(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "bg-[#C09060]/20 text-[#C09060]"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {link.label}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Tools section */}
          <div className="flex flex-col gap-2">
            <p className="px-3 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">Tools</p>
            <div className="flex flex-col gap-0.5">
              {TOOLS_LINKS.map((link) => {
                const Icon = link.icon
                const isActive = pathname.startsWith(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "bg-[#C09060]/20 text-[#C09060]"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {link.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </nav>

        {/* Bottom controls */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-sidebar-border">
          <UserMenu />
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
