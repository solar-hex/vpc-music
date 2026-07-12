import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The standard responsive card grid (1 / 2 / 3 columns). Used by every
 * card-list section so the grid shell lives in one place.
 */
export function CardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>{children}</div>;
}
