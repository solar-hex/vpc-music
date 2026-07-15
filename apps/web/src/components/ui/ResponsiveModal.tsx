import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface ResponsiveModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Tailwind max-width utility for the panel, e.g. "max-w-md" (default) */
  maxWidthClass?: string;
  /** Show an ✕ button in the header (default true) */
  showCloseButton?: boolean;
  children?: ReactNode;
}

/**
 * Shared modal shell. Renders as a bottom sheet on phones and a centered
 * dialog from `sm:` up (via the global .modal-backdrop/.modal-content CSS).
 * Adds the behaviors the hand-rolled modals lacked: Escape to close,
 * backdrop click to close, focus moved in on open and restored on close,
 * and Tab cycling kept inside the panel.
 */
export function ResponsiveModal({
  open,
  onClose,
  title,
  description,
  maxWidthClass = "max-w-md",
  showCloseButton = true,
  children,
}: ResponsiveModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Focus management: move focus into the panel on open, restore on close.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    // Focus the first focusable control, falling back to the panel itself.
    requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (first ?? panel).focus();
    });
    return () => {
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  // Escape closes; Tab cycles within the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute("disabled"));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop print-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onMouseDown={(e) => {
        // Backdrop click closes; clicks inside the panel don't bubble here
        // because we check the event target is the backdrop itself.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={panelRef} tabIndex={-1} className={`modal-content ${maxWidthClass} outline-none`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 id={titleId} className="text-lg font-brand text-[hsl(var(--foreground))]">
              {title}
            </h3>
            {description && (
              <p id={descriptionId} className="text-sm text-[hsl(var(--muted-foreground))]">
                {description}
              </p>
            )}
          </div>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
