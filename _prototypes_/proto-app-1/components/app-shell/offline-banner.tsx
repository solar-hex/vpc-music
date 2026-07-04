"use client"

import { motion } from "framer-motion"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { WifiOff, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { slideInDown } from "@/lib/animations"

interface OfflineBannerProps {
  pendingCount?: number
}

export function OfflineBanner({ pendingCount = 0 }: OfflineBannerProps) {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <motion.div
      variants={slideInDown}
      initial="initial"
      animate="animate"
      exit="exit"
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2 text-sm",
        "bg-warning text-warning-foreground"
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <motion.div
          animate={{ rotate: [0, -5, 5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <WifiOff className="h-4 w-4 shrink-0" />
        </motion.div>
        <span className="font-medium">
          {pendingCount > 0
            ? `You&apos;re offline — ${pendingCount} edit${pendingCount > 1 ? "s" : ""} pending sync`
            : "You&apos;re offline — changes will sync when you reconnect"}
        </span>
      </div>
      <motion.button
        onClick={() => window.location.reload()}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium",
          "bg-warning-foreground/10 hover:bg-warning-foreground/20 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-foreground"
        )}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </motion.div>
        Refresh
      </motion.button>
    </motion.div>
  )
}
