import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Lucide icon component naming the empty space. */
  icon: LucideIcon;
  /** One line explaining the space (string or node for conditional copy). */
  message: ReactNode;
  /** Optional single call-to-action (button or upload label). No margin needed. */
  action?: ReactNode;
  className?: string;
}

/**
 * The shared empty-state card: dashed panel, centered icon, a muted one-liner,
 * and an optional call-to-action. Per the DoD, empty states name the space and
 * offer one verb — keeping that shape here makes it consistent everywhere.
 */
export function EmptyState({ icon: Icon, message, action, className }: EmptyStateProps) {
  return (
    <div className={cn("card-empty", className)}>
      <Icon className="mx-auto h-12 w-12 text-[hsl(var(--muted-foreground))]" />
      <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
