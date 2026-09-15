import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Hash, Lightbulb, Minus, MessageSquare, Moon, MoreHorizontal, Plus, Search, Sun, Type } from "lucide-react";
import { ActionMenu, type ActionMenuEntry } from "@/components/ui/ActionMenu";

export interface ChartToolbarProps {
  /** The song list, with the current key carried. Absent for a share link, which has no library behind it. */
  searchHref?: string | null;
  /** The key being displayed, or null for a chart without a key. */
  displayKey: string | null;
  onOpenKeyPicker: () => void;
  onTransposeUp: () => void;
  onTransposeDown: () => void;
  nashville: boolean;
  /** Nashville numbers need a key. */
  nashvilleDisabled: boolean;
  onToggleNashville: () => void;
  showComments: boolean;
  onToggleComments: () => void;
  fontSize: number;
  onCycleFontSize: () => void;
  keepAwake: boolean;
  keepAwakeSupported: boolean;
  onToggleKeepAwake: () => void;
  resolvedTheme: "light" | "dark";
  onToggleTheme: () => void;
  /** Host-specific entries for the More menu (print, downloads, edit, ...). */
  menuItems: ActionMenuEntry[];
}

const NARROW_QUERY = "(max-width: 639px)";

function useIsNarrow() {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && Boolean(window.matchMedia?.(NARROW_QUERY).matches));
  useEffect(() => {
    const query = window.matchMedia?.(NARROW_QUERY);
    if (!query) return;
    const onChange = () => setNarrow(query.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);
  return narrow;
}

const ICON_BUTTON = "btn-icon btn-ghost h-12 w-12 shrink-0";

/**
 * The old site's ten-icon bar, mapped onto V2. Seven controls are always
 * visible (they fit a 360px phone); text size, keep-awake and theme move into
 * the More menu below 640px.
 */
export function ChartToolbar({
  searchHref,
  displayKey,
  onOpenKeyPicker,
  onTransposeUp,
  onTransposeDown,
  nashville,
  nashvilleDisabled,
  onToggleNashville,
  showComments,
  onToggleComments,
  fontSize,
  onCycleFontSize,
  keepAwake,
  keepAwakeSupported,
  onToggleKeepAwake,
  resolvedTheme,
  onToggleTheme,
  menuItems,
}: ChartToolbarProps) {
  const narrow = useIsNarrow();
  const themeLabel = resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  const keepAwakeLabel = keepAwake ? "Let the screen sleep" : "Keep the screen awake";

  const overflowItems: ActionMenuEntry[] = narrow
    ? [
        { label: `Text size (${fontSize}px)`, icon: <Type />, onSelect: onCycleFontSize },
        ...(keepAwakeSupported ? [{ label: keepAwakeLabel, icon: <Lightbulb />, onSelect: onToggleKeepAwake }] : []),
        { label: themeLabel, icon: resolvedTheme === "dark" ? <Sun /> : <Moon />, onSelect: onToggleTheme },
        "separator",
        ...menuItems,
      ]
    : menuItems;

  return (
    <div
      role="toolbar"
      aria-label="Chart controls"
      className="print-hidden flex shrink-0 items-center gap-0.5 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 px-1 py-1 backdrop-blur sm:gap-1 sm:px-2"
    >
      {searchHref && (
        <Link to={searchHref} className={ICON_BUTTON} title="Search songs" aria-label="Search songs">
          <Search className="h-5 w-5" />
        </Link>
      )}

      <button
        type="button"
        onClick={onOpenKeyPicker}
        disabled={!displayKey}
        className="btn-ghost h-12 min-w-12 shrink-0 px-2 text-base font-semibold disabled:opacity-60"
        title="Change key"
        aria-label={displayKey ? `Change key (currently ${displayKey})` : "This chart has no key"}
      >
        {displayKey ?? "–"}
      </button>

      <button type="button" onClick={onTransposeDown} className={ICON_BUTTON} title="Transpose down" aria-label="Transpose down">
        <Minus className="h-5 w-5" />
      </button>
      <button type="button" onClick={onTransposeUp} className={ICON_BUTTON} title="Transpose up" aria-label="Transpose up">
        <Plus className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={onToggleNashville}
        disabled={nashvilleDisabled}
        aria-pressed={nashville}
        className={`${ICON_BUTTON} ${nashville ? "bg-[hsl(var(--muted))]" : ""} disabled:opacity-40`}
        title={nashville ? "Show chord names" : "Show Nashville numbers"}
        aria-label="Nashville numbers"
      >
        <Hash className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={onToggleComments}
        aria-pressed={showComments}
        className={`${ICON_BUTTON} ${showComments ? "" : "opacity-50"}`}
        title={showComments ? "Hide comments" : "Show comments"}
        aria-label="Comments"
      >
        <MessageSquare className="h-5 w-5" />
      </button>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onCycleFontSize}
        className={`${ICON_BUTTON} hidden sm:inline-flex`}
        title={`Text size (${fontSize}px)`}
        aria-label={`Text size, currently ${fontSize} pixels`}
      >
        <Type className="h-5 w-5" />
      </button>

      {keepAwakeSupported && (
        <button
          type="button"
          onClick={onToggleKeepAwake}
          aria-pressed={keepAwake}
          className={`${ICON_BUTTON} hidden sm:inline-flex ${keepAwake ? "bg-[hsl(var(--muted))] text-[hsl(var(--secondary))]" : ""}`}
          title={keepAwakeLabel}
          aria-label="Keep screen awake"
        >
          <Lightbulb className="h-5 w-5" />
        </button>
      )}

      <button type="button" onClick={onToggleTheme} className={`${ICON_BUTTON} hidden sm:inline-flex`} title={themeLabel} aria-label="Toggle theme">
        {resolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <ActionMenu
        trigger={<MoreHorizontal className="h-5 w-5" />}
        triggerClassName={ICON_BUTTON}
        triggerTitle="More"
        label="More actions"
        items={overflowItems}
      />
    </div>
  );
}
