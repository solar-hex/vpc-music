"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAppShell } from "@/lib/app-shell-context"
import { ChevronDown, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

export function OrgSwitcher() {
  const { orgs, currentOrg, setCurrentOrg, user } = useAppShell()
  const canCreateOrg = user.role === "owner" || user.role === "admin"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium",
            "text-nav-foreground hover:bg-accent hover:text-accent-foreground",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "max-w-[200px]"
          )}
          aria-label="Switch organization"
        >
          <span className="truncate">{currentOrg.name}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Organizations
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => setCurrentOrg(org)}
            className="flex items-center justify-between"
          >
            <span className="truncate">{org.name}</span>
            {org.id === currentOrg.id && (
              <span className="ml-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
        {canCreateOrg && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-muted-foreground">
              <Plus className="mr-2 h-4 w-4" />
              Create organization
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
