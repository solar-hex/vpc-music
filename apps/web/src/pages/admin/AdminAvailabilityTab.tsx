import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { availabilityApi, orgsApi, type AvailabilityEntry, type AvailabilityStatus, type OrgMember } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarCheck2, ChevronLeft, ChevronRight } from "lucide-react";
import { toDateKey } from "@/lib/format";

const DAYS_SHOWN = 14;

const STATUS_CYCLE: (AvailabilityStatus | null)[] = ["available", "tentative", "unavailable", null];

const STATUS_STYLES: Record<AvailabilityStatus, string> = {
  available: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  tentative: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  unavailable: "bg-red-500/20 text-red-600 dark:text-red-400",
};

const STATUS_SHORT: Record<AvailabilityStatus, string> = {
  available: "✓",
  tentative: "?",
  unavailable: "✕",
};

/**
 * Admin → Availability: members down the side, dates across the top.
 * Everyone edits their own row; team managers edit any row.
 */
export function AdminAvailabilityTab() {
  const { user, activeOrg } = useAuth();
  const isAdmin = activeOrg?.role === "admin" || user?.role === "owner";
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [entries, setEntries] = useState<AvailabilityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [startOffset, setStartOffset] = useState(0); // days from today

  const dates = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() + startOffset);
    return Array.from({ length: DAYS_SHOWN }, (_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      return day;
    });
  }, [startOffset]);

  const from = toDateKey(dates[0]);
  const to = toDateKey(dates[dates.length - 1]);

  useEffect(() => {
    Promise.all([
      orgsApi.members().then((res) => setMembers(res.members)),
      availabilityApi.list({ from, to }).then((res) => setEntries(res.entries)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [from, to]);

  const entryMap = useMemo(() => {
    const map = new Map<string, AvailabilityStatus>();
    for (const entry of entries) map.set(`${entry.userId}|${entry.date}`, entry.status);
    return map;
  }, [entries]);

  const handleCellClick = async (memberId: string, dateKey: string) => {
    const editable = isAdmin || memberId === user?.id;
    if (!editable) return;

    const current = entryMap.get(`${memberId}|${dateKey}`) ?? null;
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];

    try {
      if (next === null) {
        await availabilityApi.clear({ userId: memberId, date: dateKey });
        setEntries((prev) => prev.filter((entry) => !(entry.userId === memberId && entry.date === dateKey)));
      } else {
        await availabilityApi.set({ userId: memberId, date: dateKey, status: next });
        setEntries((prev) => {
          const rest = prev.filter((entry) => !(entry.userId === memberId && entry.date === dateKey));
          return [...rest, { userId: memberId, date: dateKey, status: next }];
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update availability");
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="spinner" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h3 className="section-title">
          <CalendarCheck2 className="section-title-icon" /> Availability
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setStartOffset((prev) => prev - DAYS_SHOWN)} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))]" aria-label="Earlier dates">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-[hsl(var(--muted-foreground))] min-w-[150px] text-center">
            {dates[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} –{" "}
            {dates[dates.length - 1].toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
          <button onClick={() => setStartOffset((prev) => prev + DAYS_SHOWN)} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))]" aria-label="Later dates">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Click a cell to cycle: <span className="text-emerald-600 dark:text-emerald-400">✓ available</span> →{" "}
        <span className="text-amber-600 dark:text-amber-400">? tentative</span> →{" "}
        <span className="text-red-600 dark:text-red-400">✕ unavailable</span> → clear.
        {isAdmin ? " You can edit anyone's row." : " You can edit your own row."}
      </p>

      <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[hsl(var(--border))]">
              <th className="sticky left-0 bg-[hsl(var(--card))] px-3 py-2 text-left text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Member
              </th>
              {dates.map((date) => (
                <th key={toDateKey(date)} className="px-1 py-2 text-center text-[10px] uppercase text-[hsl(var(--muted-foreground))] min-w-[42px]">
                  <div>{date.toLocaleDateString(undefined, { weekday: "short" })}</div>
                  <div className="font-bold">{date.getDate()}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const editable = isAdmin || member.userId === user?.id;
              return (
                <tr key={member.userId} className="border-b border-[hsl(var(--border))]/50 last:border-b-0">
                  <td className={`sticky left-0 bg-[hsl(var(--card))] px-3 py-1.5 text-sm font-medium whitespace-nowrap ${member.userId === user?.id ? "text-[hsl(var(--secondary))]" : ""}`}>
                    {member.displayName || "Member"}
                    {member.userId === user?.id && <span className="text-xs text-[hsl(var(--muted-foreground))]"> (you)</span>}
                  </td>
                  {dates.map((date) => {
                    const dateKey = toDateKey(date);
                    const status = entryMap.get(`${member.userId}|${dateKey}`);
                    return (
                      <td key={dateKey} className="p-0.5 text-center">
                        <button
                          onClick={() => void handleCellClick(member.userId, dateKey)}
                          disabled={!editable}
                          className={`h-8 w-full min-w-[38px] rounded text-xs font-bold transition-colors ${
                            status ? STATUS_STYLES[status] : "bg-[hsl(var(--muted))]/40 text-transparent"
                          } ${editable ? "cursor-pointer hover:ring-1 hover:ring-[hsl(var(--secondary))]" : "cursor-default"}`}
                          aria-label={`${member.displayName || "Member"} on ${dateKey}: ${status ?? "unset"}`}
                        >
                          {status ? STATUS_SHORT[status] : "·"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
