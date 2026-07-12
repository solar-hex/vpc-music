import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatusVariant {
  label: string;
  /** The `.badge*` class string for this variant (e.g. "badge-success"). */
  className: string;
  icon?: LucideIcon;
}

/**
 * A status pill built on the shared `.badge*` classes. Domains supply a
 * `Record<status, StatusVariant>` config and pass the resolved variant — one
 * render path instead of a per-domain ternary/switch. (SongStatusBadge keeps
 * its own richer bordered style; availability is a grid cell, not a pill.)
 */
export function StatusBadge({ variant, className }: { variant?: StatusVariant | null; className?: string }) {
  if (!variant) return null;
  const Icon = variant.icon;
  return (
    <span className={cn(variant.className, className)}>
      {Icon ? (
        <>
          <Icon className="h-3 w-3" /> {variant.label}
        </>
      ) : (
        variant.label
      )}
    </span>
  );
}
