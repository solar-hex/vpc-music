"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { AppShell } from "@/components/app-shell"
import { RolesPermissionsManager } from "@/components/roles-permissions-manager"
import { 
  Users, 
  Database, 
  Monitor, 
  ArrowUpRight, 
  CheckCircle2,
  Settings,
  Lock,
  LogOut,
  Shield,
  UserCheck,
  Users2,
} from "lucide-react"
import { fadeInUp, staggerContainer, staggerItem } from "@/lib/animations"
import { cn } from "@/lib/utils"

interface AdminCard {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  stat: string
  statLabel: string
  section: string
}

interface AdminSection {
  id: string
  title: string
  icon: React.ReactNode
  description: string
}

const ADMIN_SECTIONS: AdminSection[] = [
  {
    id: "users",
    title: "Users",
    icon: <Users className="h-5 w-5" />,
    description: "Manage user accounts and profiles",
  },
  {
    id: "roles-permissions",
    title: "Roles & Permissions",
    icon: <Shield className="h-5 w-5" />,
    description: "Configure user roles and access levels",
  },
  {
    id: "access-logs",
    title: "Access Logs",
    icon: <LogOut className="h-5 w-5" />,
    description: "View system access and audit trails",
  },
  {
    id: "team-management",
    title: "Team Management",
    icon: <Users2 className="h-5 w-5" />,
    description: "Manage team members and organization",
  },
]

const ADMIN_CARDS: AdminCard[] = [
  {
    id: "team-access",
    icon: <Users className="h-8 w-8" />,
    title: "TEAM ACCESS CONTROL",
    description: "Manage member roles, permissions, and invite fresh talent to the workstation.",
    stat: "12",
    statLabel: "MEMBERS ACTIVE",
    section: "team-management",
  },
  {
    id: "library-maintenance",
    icon: <Database className="h-8 w-8" />,
    title: "LIBRARY MAINTENANCE",
    description: "Run automated audit scans to clean up duplicate charts and broken metadata links.",
    stat: "104",
    statLabel: "SONGS INDEXED",
    section: "general",
  },
  {
    id: "display-sync",
    icon: <Monitor className="h-8 w-8" />,
    title: "DISPLAY & STAGE SYNC",
    description: "Configure remote stage displays, prompts, and real time lyric transmission modes.",
    stat: "2",
    statLabel: "DISPLAYS ONLINE",
    section: "general",
  },
]

const STATUS_ITEMS = [
  { label: "LIBRARY ENGINE: ACTIVE", active: true },
  { label: "STAGE MODES: STABLE", active: true },
]

function AdminCard({ card }: { card: AdminCard }) {
  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -4, boxShadow: "0 20px 40px rgba(249, 115, 22, 0.1)" }}
      className="group relative overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800/60 to-slate-900/40 p-6 transition-all hover:border-[#C09060]/50 hover:bg-slate-800/80"
    >
      {/* Background glow effect */}
      <motion.div
        className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#C09060]/10 blur-3xl"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 4, repeat: Infinity }}
      />

      {/* Icon */}
      <motion.div
        className="relative mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#C09060]/20 text-[#C09060]"
        whileHover={{ scale: 1.15, rotate: 5 }}
        whileTap={{ scale: 0.95 }}
      >
        {card.icon}
      </motion.div>

      {/* Title */}
      <h3 className="relative mb-3 text-base font-bold uppercase tracking-wide text-white">
        {card.title}
      </h3>

      {/* Description */}
      <p className="relative mb-6 text-sm text-slate-400 leading-relaxed">
        {card.description}
      </p>

      {/* Divider */}
      <div className="relative mb-4 h-px bg-gradient-to-r from-slate-700 to-transparent" />

      {/* Stat Row */}
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-[#C09060]">{card.stat}</p>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {card.statLabel}
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.1, rotate: 45 }}
          whileTap={{ scale: 0.95 }}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C09060]/10 text-[#C09060] transition-colors hover:bg-[#C09060]/20"
          aria-label={`View ${card.title}`}
        >
          <ArrowUpRight className="h-4 w-4" />
        </motion.button>
      </div>
    </motion.div>
  )
}

function StatusBar() {
  return (
    <motion.div
      variants={fadeInUp}
      className="mt-8 overflow-hidden rounded-xl border border-slate-700 bg-slate-800/30 p-4"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-4">
          {STATUS_ITEMS.map((item, idx) => (
            <motion.div
              key={item.label}
              className="flex items-center gap-2"
              whileHover={{ x: 2 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.1 }}
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <CheckCircle2 className="h-4 w-4 text-green-400" />
              </motion.div>
              <span className="text-xs font-semibold uppercase text-slate-400">
                {item.label}
              </span>
            </motion.div>
          ))}
        </div>
        <motion.div
          className="text-xs font-semibold text-slate-500"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          LAST SYNC TODAY 11:23 PM
        </motion.div>
      </div>
    </motion.div>
  )
}

function SectionButton({ 
  section, 
  isActive, 
  onClick 
}: { 
  section: AdminSection
  isActive: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "w-full text-left px-4 py-3 rounded-lg transition-all border flex items-center gap-3",
        isActive
          ? "bg-[#C09060]/20 border-[#C09060] text-[#C09060]"
          : "bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700 hover:border-slate-600"
      )}
    >
      {section.icon}
      <div>
        <p className="font-semibold text-sm">{section.title}</p>
        <p className="text-xs text-slate-500">{section.description}</p>
      </div>
    </motion.button>
  )
}

function AdminContent({ activeSection }: { activeSection: string }) {
  const sectionConfig = {
    users: {
      title: "User Management",
      description: "View and manage all system users",
      stats: [
        { label: "Total Users", value: "24" },
        { label: "Active Today", value: "18" },
        { label: "New This Week", value: "3" },
      ],
    },
    "roles-permissions": {
      title: "Roles & Permissions",
      description: "Configure access control and role assignments",
      stats: [
        { label: "Active Roles", value: "4" },
        { label: "Total Permissions", value: "14" },
        { label: "Users Assigned", value: "14" },
      ],
    },
    "access-logs": {
      title: "Access Logs & Audit Trail",
      description: "Monitor system access and security events",
      stats: [
        { label: "Events This Week", value: "1,247" },
        { label: "Security Alerts", value: "2" },
        { label: "Suspicious Activities", value: "0" },
      ],
    },
    "team-management": {
      title: "Team Management",
      description: "Organize and manage team structure",
      stats: [
        { label: "Teams", value: "3" },
        { label: "Members", value: "12" },
        { label: "Pending Invites", value: "2" },
      ],
    },
  }

  const config = sectionConfig[activeSection as keyof typeof sectionConfig] || sectionConfig.users

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {config.stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="rounded-lg border border-slate-700 bg-slate-800/50 p-4"
          >
            <p className="text-sm text-slate-400 uppercase tracking-wider">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold text-[#C09060]">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Section Content */}
      {activeSection === "roles-permissions" ? (
        <RolesPermissionsManager />
      ) : (
        <motion.div
          className="rounded-lg border border-slate-700 bg-slate-800/30 p-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-700">
            <Settings className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-400">
            {config.title} Interface
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Detailed management tools and controls for {config.title.toLowerCase()} coming soon.
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState("users")

  return (
    <AppShell>
      <motion.div
        className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 px-4 py-8 md:px-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <motion.div 
            variants={fadeInUp} 
            initial="initial" 
            animate="animate"
          >
            <h1 className="text-4xl font-bold text-white">ADMINISTRATIVE HUB</h1>
            <p className="mt-2 text-slate-400">Manage ministry infrastructure, team architecture, and system access.</p>
          </motion.div>

          {/* Admin Sections and Content */}
          <div className="mt-12 grid gap-8 lg:grid-cols-4">
            {/* Sidebar Navigation */}
            <motion.div
              variants={fadeInUp}
              initial="initial"
              animate="animate"
              className="space-y-3 lg:col-span-1"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Admin Sections</p>
              {ADMIN_SECTIONS.map((section) => (
                <SectionButton
                  key={section.id}
                  section={section}
                  isActive={activeSection === section.id}
                  onClick={() => setActiveSection(section.id)}
                />
              ))}
            </motion.div>

            {/* Main Content */}
            <motion.div
              variants={fadeInUp}
              initial="initial"
              animate="animate"
              className="lg:col-span-3"
            >
              <AdminContent activeSection={activeSection} />
            </motion.div>
          </div>

          {/* Admin Cards Grid */}
          <motion.div
            className="mt-12 grid gap-6 md:grid-cols-3"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {ADMIN_CARDS.map((card) => (
              <AdminCard key={card.id} card={card} />
            ))}
          </motion.div>

          {/* Status Bar */}
          <StatusBar />
        </div>
      </motion.div>
    </AppShell>
  )
}

