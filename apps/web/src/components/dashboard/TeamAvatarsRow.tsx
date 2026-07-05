import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { orgsApi, type OrgMember } from "@/lib/api-client";
import { roleLabel } from "@vpc-music/shared";

function memberInitials(name: string | null): string {
  return (name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("");
}

/** Compact row of team member avatars for the dashboard. */
export function TeamAvatarsRow() {
  const [members, setMembers] = useState<OrgMember[]>([]);

  useEffect(() => {
    orgsApi
      .members()
      .then((res) => setMembers(res.members))
      .catch(() => setMembers([]));
  }, []);

  if (members.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="section-header">
        <h3 className="section-title">
          <Users className="section-title-icon" />
          Team
        </h3>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {members.map((m) => (
          <div key={m.userId} className="flex items-center gap-2" title={`${m.displayName || "Member"} · ${roleLabel(m.role)}`}>
            <div className="flex items-center justify-center h-9 w-9 rounded-full bg-[hsl(var(--secondary))]/20 text-[hsl(var(--secondary))] text-xs font-bold">
              {memberInitials(m.displayName)}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-medium leading-tight">{m.displayName || "Member"}</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{roleLabel(m.role)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
