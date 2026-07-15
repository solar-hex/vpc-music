import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  icon?: ReactNode;
  /** Small count/badge text shown after the title, e.g. "(3)". */
  count?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Uniform collapsed-by-default section for secondary panels below the chart.
 * Keeps long pages short on phones — the header is a full-width 44px target.
 */
export function CollapsibleSection({ title, icon, count, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-2 print-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="section-title w-full text-left"
        aria-expanded={open}
      >
        {icon}
        {title}
        {count != null && (
          <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">{count}</span>
        )}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && children}
    </div>
  );
}
