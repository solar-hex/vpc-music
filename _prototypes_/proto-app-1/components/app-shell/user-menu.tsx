"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAppShell, ROLE_LABELS } from "@/lib/app-shell-context"
import { LogOut, Settings, User } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export function UserMenu() {
  const { user } = useAppShell()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
            "bg-primary text-primary-foreground",
            "hover:opacity-90 transition-opacity",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
          aria-label={`User menu for ${user.displayName}`}
        >
          {user.avatarInitials}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-sm">{user.displayName}</span>
            <span className="text-xs text-muted-foreground truncate">{user.email}</span>
            <span className="mt-1 inline-flex w-fit rounded-sm bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
