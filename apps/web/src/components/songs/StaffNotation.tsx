import { useEffect, useRef, useState } from "react";

/**
 * Renders ABC notation as staff music via abcjs (dynamically imported so the
 * library stays out of the main bundle).
 */
export function StaffNotation({ abc, className }: { abc: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!abc.trim() || !containerRef.current) return;

    import("abcjs")
      .then((abcjs) => {
        if (cancelled || !containerRef.current) return;
        try {
          abcjs.renderAbc(containerRef.current, abc, { responsive: "resize" });
          setError(null);
        } catch {
          setError("Could not render staff notation.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load the notation renderer.");
      });

    return () => {
      cancelled = true;
    };
  }, [abc]);

  if (!abc.trim()) return null;

  return (
    <div className={className}>
      {error ? (
        <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
      ) : (
        <div ref={containerRef} className="overflow-x-auto rounded-md bg-white p-2 text-black" data-testid="staff-notation" />
      )}
    </div>
  );
}

const ABC_TEMPLATE = `X:1
T:Title
M:4/4
L:1/8
K:C
C D E F | G A B c |`;

/** ABC source editor with a live staff preview. */
export function StaffNotationEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[hsl(var(--foreground))]">Staff notation (ABC)</span>
        {!value.trim() && (
          <button type="button" className="link-accent text-xs" onClick={() => onChange(ABC_TEMPLATE)} disabled={disabled}>
            Insert template
          </button>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={"X:1\nT:Title\nM:4/4\nK:C\nC D E F | G A B c |"}
        className="input w-full min-h-[100px] font-mono text-xs"
        disabled={disabled}
        aria-label="ABC notation source"
      />
      <StaffNotation abc={value} />
    </div>
  );
}
