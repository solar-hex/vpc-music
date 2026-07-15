import { useEffect, useRef, useState, type ReactNode } from "react";

export interface ActionMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

/** Visual separator between logical groups. */
export type ActionMenuEntry = ActionMenuItem | "separator";

interface ActionMenuProps {
  /** Trigger content (text and/or icon). */
  trigger: ReactNode;
  triggerClassName?: string;
  triggerTitle?: string;
  items: ActionMenuEntry[];
  /** Accessible name for the menu. */
  label: string;
}

/**
 * Lightweight action menu: an anchored dropdown on desktop and a fixed
 * bottom sheet on phones (the proven pattern from ChordProEditor's mobile
 * menus). Closes on outside click and Escape. All items are 44px touch
 * targets via the global coarse-pointer rule.
 */
export function ActionMenu({ trigger, triggerClassName = "btn-outline btn-sm", triggerTitle, items, label }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={triggerClassName}
        title={triggerTitle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
      >
        {trigger}
      </button>
      {open && (
        <>
          {/* Mobile scrim so the sheet reads as an overlay */}
          <div className="fixed inset-0 z-40 bg-black/30 sm:hidden" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            role="menu"
            aria-label={label}
            className="fixed inset-x-4 bottom-4 z-50 overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-1 sm:w-56 sm:rounded-md"
          >
            {items.map((item, idx) =>
              item === "separator" ? (
                <div key={`sep-${idx}`} className="my-1 border-t border-[hsl(var(--border))]" role="separator" />
              ) : (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-[hsl(var(--muted))] disabled:opacity-50 ${
                    item.destructive
                      ? "text-[hsl(var(--destructive))]"
                      : "text-[hsl(var(--foreground))]"
                  }`}
                >
                  {item.icon && <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>}
                  {item.label}
                </button>
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}
