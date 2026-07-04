"use client"

import { useOnlineStatus } from "@/hooks/use-online-status"
import { WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"

interface OfflineIndicatorProps {
  /** Number of pending local edits queued for sync */
  pendingCount?: number
}

export function OfflineIndicator({ pendingCount = 0 }: OfflineIndicatorProps) {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div
      className={cn(
        "relative flex h-8 w-8 items-center justify-center rounded-md",
        "text-warning-foreground bg-warning/20 hover:bg-warning/30 transition-colors",
        "cursor-default"
      )}
      title={
        pendingCount > 0
          ? `Offline — ${pendingCount} pending edit${pendingCount > 1 ? "s" : ""}`
          : "Offline"
      }
      role="status"
      aria-label={`Offline${pendingCount > 0 ? `, ${pendingCount} pending edits` : ""}`}
    >
      <WifiOff className="h-4 w-4" />
      {pendingCount > 0 && (
        <span
          className={cn(
            "absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center",
            "rounded-full bg-warning text-[10px] font-semibold text-warning-foreground px-0.5"
          )}
          aria-hidden="true"
        >
          {pendingCount > 9 ? "9+" : pendingCount}
        </span>
      )}
    </div>
  )
}
