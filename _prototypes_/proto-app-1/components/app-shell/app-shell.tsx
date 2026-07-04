"use client"

import { motion } from "framer-motion"
import { AppShellProvider } from "@/lib/app-shell-context"
import { TopNav } from "./top-nav"
import { MobileMenu } from "./mobile-menu"
import { OfflineBanner } from "./offline-banner"
import { AIChat } from "@/components/ai-chat"
import { pageEnter } from "@/lib/animations"

interface AppShellProps {
  children: React.ReactNode
  /** Demo prop: simulate pending offline edits */
  pendingEdits?: number
}

export function AppShell({ children, pendingEdits = 0 }: AppShellProps) {
  return (
    <AppShellProvider>
      <motion.div 
        className="flex min-h-screen bg-background"
        {...pageEnter}
      >
        {/* Desktop sidebar */}
        <TopNav />

        {/* Mobile top bar + drawer */}
        <MobileMenu />

        {/* Main content area */}
        <motion.div 
          className="flex flex-1 flex-col min-w-0"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300, delay: 0.1 }}
        >
          <OfflineBanner pendingCount={pendingEdits} />
          {/* Spacer for mobile top bar */}
          <div className="h-14 md:hidden shrink-0" aria-hidden="true" />
          <main className="flex-1" id="main-content">
            {children}
          </main>
        </motion.div>

        {/* AI Chat - Fixed position overlay */}
        <AIChat />
      </motion.div>
    </AppShellProvider>
  )
}
