"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import {
  Music2,
  LayoutDashboard,
  Music,
  ListMusic,
  Settings,
  ShieldCheck,
  Layers,
  Search,
  Bell,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { listStagger, menuItemStagger } from "@/lib/animations"
import { OrgSwitcher } from "./org-switcher"
import { UserMenu } from "./user-menu"
import { ThemeToggle } from "./theme-toggle"
import { OfflineIndicator } from "./offline-indicator"
import { NotificationPanel } from "./notification-panel"
import { useAppShell } from "@/lib/app-shell-context"

const MAIN_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin", label: "Admin", icon: ShieldCheck },
] as const

const LIBRARY_LINKS = [
  { href: "/songs", label: "Songs", icon: Music },
  { href: "/setlist-hub", label: "Set Lists", icon: Layers },
  { href: "/artists", label: "Artists", icon: Search },
] as const

const TOOLS_LINKS = [
  { href: "/settings", label: "Settings", icon: Settings },
] as const

type NavLink = (typeof MAIN_LINKS)[number] | (typeof LIBRARY_LINKS)[number] | (typeof TOOLS_LINKS)[number]

function NavSection({ title, links, pathname }: { title: string; links: typeof MAIN_LINKS | typeof LIBRARY_LINKS | typeof TOOLS_LINKS; pathname: string }) {
  return (
    <motion.div 
      className="flex flex-col gap-2"
      variants={listStagger.container}
      initial="initial"
      animate="animate"
    >
      <motion.p 
        className="px-3 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider"
        variants={listStagger.item}
      >
        {title}
      </motion.p>
      <motion.div 
        className="flex flex-col gap-0.5"
        variants={{
          animate: {
            transition: { staggerChildren: 0.05, delayChildren: 0.1 },
          },
        }}
      >
        {links.map((link, idx) => {
          const isActive = pathname.startsWith(link.href)
          const Icon = link.icon
          return (
            <motion.div
              key={link.href}
              variants={{
                initial: { opacity: 0, x: -10 },
                animate: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
              }}
            >
              <Link
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-[#C09060]/20 text-[#C09060]"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <motion.div
                  whileHover={{ scale: 1.2, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                </motion.div>
                {link.label}
              </Link>
            </motion.div>
          )
        })}
      </motion.div>
    </motion.div>
  )
}

export function TopNav() {
  const pathname = usePathname()
  const { user } = useAppShell()
  const showAdmin = user.role === "admin" || user.role === "owner"

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col w-60 shrink-0",
        "border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        "min-h-screen sticky top-0 h-screen"
      )}
      aria-label="Main navigation"
    >
      {/* Logo + org */}
      <div className="flex flex-col gap-1 px-4 pt-5 pb-4 border-b border-sidebar-border">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 mb-3 hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          aria-label="VPC Music — go to dashboard"
        >
          <Image
            src="/vpc-music-logo.png"
            alt="VPC Music"
            width={32}
            height={32}
            className="h-8 w-8"
            priority
          />
          <span className="font-semibold text-base tracking-tight">VPC Music</span>
        </Link>
        <OrgSwitcher />
      </div>

      {/* Nav links with sections */}
      <nav className="flex-1 flex flex-col gap-6 px-3 py-4 overflow-y-auto">
        {/* Main navigation */}
        <NavSection title="" links={MAIN_LINKS} pathname={pathname} />

        {/* Library section */}
        <NavSection title="LIBRARY" links={LIBRARY_LINKS} pathname={pathname} />

        {/* Tools section */}
        <NavSection title="TOOLS" links={TOOLS_LINKS} pathname={pathname} />
      </nav>

      {/* User profile at bottom */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
            <Image
              src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=48&h=48&fit=crop"
              alt="Sam Carter"
              width={48}
              height={48}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">SAM CARTER</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">Worship Leader</p>
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-sidebar-border">
        <UserMenu />
        <div className="flex items-center gap-1">
          <NotificationPanel />
          <OfflineIndicator />
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}

// Re-export nav links for use in MobileMenu
export { MAIN_LINKS, LIBRARY_LINKS, TOOLS_LINKS }
export type { NavLink }
