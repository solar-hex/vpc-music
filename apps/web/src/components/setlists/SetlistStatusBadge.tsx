import { CheckCircle2 } from "lucide-react";
import { StatusBadge, type StatusVariant } from "@/components/shared/StatusBadge";

/** Setlist approval/lifecycle status → pill. Unknown statuses read as Draft. */
export const SETLIST_STATUS: Record<string, StatusVariant> = {
  complete: { label: "Complete", className: "badge-success", icon: CheckCircle2 },
  approved: { label: "Approved", className: "badge-success", icon: CheckCircle2 },
  in_review: { label: "In review", className: "badge-warning" },
  draft: { label: "Draft", className: "badge-muted" },
};

export function SetlistStatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const variant = (status && SETLIST_STATUS[status]) || SETLIST_STATUS.draft;
  return <StatusBadge variant={variant} className={className} />;
}
