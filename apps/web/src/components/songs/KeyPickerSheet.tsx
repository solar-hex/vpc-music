import { ResponsiveModal } from "@/components/ui/ResponsiveModal";
import { CHROMATIC_FLAT, CHROMATIC_SHARP, normalizeEnharmonicKey, parseKeyRoot } from "@vpc-music/shared";

interface KeyPickerSheetProps {
  open: boolean;
  onClose: () => void;
  /** The key currently displayed (after transposition). */
  currentKey: string | null;
  /** The key the chart is stored in. */
  originalKey: string | null;
  /** Spelling preference for the 12 labels. */
  notation?: "sharps" | "flats";
  onPick: (key: string) => void;
}

/**
 * The old site's "Change Key" popup: a grid of the 12 keys. Minor songs get
 * minor labels so the picked key always names what the musician will hear.
 */
export function KeyPickerSheet({ open, onClose, currentKey, originalKey, notation = "flats", onPick }: KeyPickerSheetProps) {
  const isMinor = Boolean(parseKeyRoot(originalKey)?.isMinor);
  const roots = notation === "sharps" ? CHROMATIC_SHARP : CHROMATIC_FLAT;
  const keys = roots.map((root) => (isMinor ? `${root}m` : root));
  const current = currentKey ? normalizeEnharmonicKey(currentKey) : null;
  const original = originalKey ? normalizeEnharmonicKey(originalKey) : null;

  return (
    <ResponsiveModal open={open} onClose={onClose} title="Change key" maxWidthClass="max-w-md">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="group" aria-label="Keys">
        {keys.map((key) => {
          const normalized = normalizeEnharmonicKey(key);
          const isCurrent = normalized === current;
          const isOriginal = normalized === original;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                onPick(key);
                onClose();
              }}
              aria-pressed={isCurrent}
              className={`h-14 rounded-md border text-lg font-semibold transition-colors ${
                isCurrent
                  ? "border-[hsl(var(--secondary))] bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"
                  : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]"
              }`}
              title={isOriginal ? `${key} (original key)` : key}
            >
              {key}
              {isOriginal && <span className="sr-only"> (original key)</span>}
            </button>
          );
        })}
      </div>
      {original && (
        <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">Original key: {originalKey}</p>
      )}
    </ResponsiveModal>
  );
}
