import { CheckCircle, AlertCircle, Pencil, RefreshCw, Music, Archive, type LucideIcon } from "lucide-react";
import type { SongStatus } from "@/lib/api-client";

interface StatusConfig {
  label: string;
  icon: LucideIcon;
  className: string;
  description: string;
}

export const SONG_STATUS_CONFIGS: Record<SongStatus, StatusConfig> = {
  ready: {
    label: "Ready",
    icon: CheckCircle,
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    description: "Fully prepared and ready for performance",
  },
  needs_review: {
    label: "Needs Review",
    icon: AlertCircle,
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    description: "Requires review before performance",
  },
  in_rehearsal: {
    label: "In Rehearsal",
    icon: Pencil,
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    description: "Currently being rehearsed",
  },
  updated: {
    label: "Updated",
    icon: RefreshCw,
    className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    description: "Has recent updates",
  },
  missing_chords: {
    label: "Missing Chords",
    icon: Music,
    className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
    description: "Missing chord chart or chord data",
  },
};

const ARCHIVED_CONFIG: StatusConfig = {
  label: "Archived",
  icon: Archive,
  className: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/30",
  description: "Song has been archived",
};

/** Rehearsal-readiness badge for a song; renders nothing when no status is set. */
export function SongStatusBadge({
  status,
  isArchived,
  size = "sm",
}: {
  status?: SongStatus | null;
  isArchived?: boolean;
  size?: "sm" | "md";
}) {
  const config = isArchived ? ARCHIVED_CONFIG : status ? SONG_STATUS_CONFIGS[status] : null;
  if (!config) return null;

  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${config.className} ${
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      }`}
      title={config.description}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {config.label}
    </span>
  );
}
