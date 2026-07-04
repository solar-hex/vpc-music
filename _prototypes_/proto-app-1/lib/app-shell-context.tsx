"use client"

import React, { createContext, useContext, useState } from "react"

export type UserRole = "owner" | "admin" | "musician" | "observer"

export interface Org {
  id: string
  name: string
}

export interface User {
  id: string
  displayName: string
  email: string
  role: UserRole
  avatarInitials: string
}

interface AppShellContextValue {
  user: User
  orgs: Org[]
  currentOrg: Org
  setCurrentOrg: (org: Org) => void
}

const AppShellContext = createContext<AppShellContextValue | null>(null)

// Demo data — replace with real auth/API calls
const DEMO_USER: User = {
  id: "u1",
  displayName: "Jordan Lee",
  email: "jordan@vpc.church",
  role: "admin",
  avatarInitials: "JL",
}

const DEMO_ORGS: Org[] = [
  { id: "org1", name: "VPC Worship" },
  { id: "org2", name: "Youth Band" },
]

export function AppShellProvider({ children }: { children: React.ReactNode }) {
  const [currentOrg, setCurrentOrg] = useState<Org>(DEMO_ORGS[0])

  return (
    <AppShellContext.Provider
      value={{
        user: DEMO_USER,
        orgs: DEMO_ORGS,
        currentOrg,
        setCurrentOrg,
      }}
    >
      {children}
    </AppShellContext.Provider>
  )
}

export function useAppShell() {
  const ctx = useContext(AppShellContext)
  if (!ctx) throw new Error("useAppShell must be used inside AppShellProvider")
  return ctx
}

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Platform Owner",
  admin: "Worship Leader",
  musician: "Musician",
  observer: "Observer",
}
