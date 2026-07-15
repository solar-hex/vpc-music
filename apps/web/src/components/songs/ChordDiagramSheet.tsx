import { useMemo } from "react";
import { resolveChordShape } from "@vpc-music/shared";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";
import { ChordDiagram, type ChordShape } from "./ChordDiagram";

/**
 * Tap-a-chord sheet: shows the fingering diagram for a chord, resolved from
 * the song's own {define:} directives first, then the built-in dictionary.
 */
export function ChordDiagramSheet({
  chord,
  definitions,
  onClose,
}: {
  chord: string | null;
  definitions?: Record<string, Omit<ChordShape, "name">>;
  onClose: () => void;
}) {
  const shape = useMemo(
    () => (chord ? (resolveChordShape(chord, definitions ?? {}) as ChordShape | null) : null),
    [chord, definitions],
  );

  return (
    <ResponsiveModal open={chord != null} onClose={onClose} title={chord ?? ""} maxWidthClass="max-w-xs">
      {shape ? (
        <div className="flex flex-col items-center gap-2">
          {shape.name !== chord && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Showing the base shape <span className="font-medium">{shape.name}</span>
            </p>
          )}
          <ChordDiagram shape={shape} size={180} />
        </div>
      ) : (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          No diagram available for this chord yet. Add one to the song with a{" "}
          <code className="font-mono text-xs">{"{define: …}"}</code> directive.
        </p>
      )}
    </ResponsiveModal>
  );
}
