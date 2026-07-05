import { useState, useRef, useEffect } from "react";
import { Building2, ChevronDown, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function OrgSwitcher({ onRequestCreate }: { onRequestCreate: () => void }) {
  const { user, activeOrg, switchOrg } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const orgs = user?.organizations ?? [];
  const canCreate = user?.role === "owner" || activeOrg?.role === "admin";

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (orgs.length <= 1 && !canCreate) {
    // Single org, can't create — show name only
    return activeOrg ? (
      <span className="text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1.5 px-2 py-1">
        <Building2 className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{activeOrg.name}</span>
      </span>
    ) : null;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors rounded-md px-2 py-1.5 bg-[hsl(var(--muted))]"
      >
        <Building2 className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 truncate text-left">{activeOrg?.name ?? "Select org"}</span>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[220px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg py-1">
          {orgs.map((org) => (
            <button
              key={org.id}
              onClick={() => { switchOrg(org.id); setOpen(false); }}
              className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-[hsl(var(--muted))] transition-colors ${
                org.id === activeOrg?.id
                  ? "text-[hsl(var(--secondary))] font-medium"
                  : "text-[hsl(var(--foreground))]"
              }`}
            >
              {org.name}
            </button>
          ))}
          {canCreate && (
            <>
              <div className="my-1 border-t border-[hsl(var(--border))]" />
              <button
                onClick={() => {
                  setOpen(false);
                  onRequestCreate();
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> New organization
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
