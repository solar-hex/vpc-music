import { useEffect, useState } from "react";
import { activityApi, orgsApi, type ActivityEntry, type OrgMember } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollText, RefreshCw } from "lucide-react";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Admin → Activity log: who did what, to what, when. */
export function AdminActivityTab() {
  const { user, activeOrg } = useAuth();
  const isAdmin = activeOrg?.role === "admin" || user?.role === "owner";
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actorFilter, setActorFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const refresh = () => {
    setLoading(true);
    activityApi
      .list({ actorId: actorFilter || undefined, action: actionFilter || undefined })
      .then((res) => setEntries(res.entries))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isAdmin) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, actorFilter, actionFilter]);

  useEffect(() => {
    if (!isAdmin) return;
    orgsApi.members().then((res) => setMembers(res.members)).catch(() => {});
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="max-w-2xl py-8 text-center">
        <h3 className="text-lg font-brand mb-1">Access Denied</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">You need admin permissions to view the activity log.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h3 className="section-title">
          <ScrollText className="section-title-icon" /> Activity Log
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <select value={actorFilter} onChange={(e) => setActorFilter(e.target.value)} className="select w-auto" aria-label="Filter by member">
            <option value="">All members</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.displayName || "Member"}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder="Filter action, e.g. song."
            className="input w-44"
            aria-label="Filter by action"
          />
          <button onClick={refresh} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))]" aria-label="Refresh" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : entries.length === 0 ? (
        <div className="card-empty">
          <ScrollText className="mx-auto h-10 w-10 text-[hsl(var(--muted-foreground))] mb-2" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Team actions are recorded here as they happen.
          </p>
        </div>
      ) : (
        <div className="list-container">
          {entries.map((entry) => (
            <div key={entry.id} className="list-item text-sm">
              <span className="font-medium shrink-0">{entry.actorName || "Someone"}</span>
              <span className="badge badge-muted shrink-0">{entry.action}</span>
              {entry.targetLabel && <span className="min-w-0 flex-1 truncate text-[hsl(var(--muted-foreground))]">{entry.targetLabel}</span>}
              <span className="ml-auto shrink-0 text-xs text-[hsl(var(--muted-foreground))]">{timeAgo(entry.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
