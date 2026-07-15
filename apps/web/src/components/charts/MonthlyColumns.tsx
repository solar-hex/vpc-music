interface MonthPoint {
  month: string; // "YYYY-MM"
  plays: number;
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString(undefined, { month: "short" });
}

/**
 * Single-series month-by-month column chart (magnitude → one hue).
 * Pure SVG: thin rounded columns, 2px gaps, recessive baseline, per-column
 * native tooltips. Fills use the theme's accent token so light/dark just work.
 */
export function MonthlyColumns({
  data,
  height = 96,
  ariaLabel = "Plays per month",
}: {
  data: MonthPoint[];
  height?: number;
  ariaLabel?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-[hsl(var(--muted-foreground))]">No plays recorded yet.</p>;
  }

  const max = Math.max(1, ...data.map((d) => d.plays));
  const colWidth = 100 / data.length;
  const labelBand = 16;
  const plotHeight = height - labelBand;

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    >
      {/* Recessive baseline */}
      <line x1="0" y1={plotHeight} x2="100" y2={plotHeight} stroke="hsl(var(--border))" strokeWidth="0.5" />
      {data.map((d, i) => {
        const h = d.plays === 0 ? 0 : Math.max(2, (d.plays / max) * (plotHeight - 6));
        const x = i * colWidth + 1;
        const w = Math.max(1, colWidth - 2);
        return (
          <g key={d.month}>
            <rect
              x={x}
              y={plotHeight - h}
              width={w}
              height={h}
              rx="1"
              fill="hsl(var(--secondary))"
              opacity={d.plays === 0 ? 0.15 : 0.9}
            >
              <title>{`${monthLabel(d.month)} ${d.month.slice(0, 4)}: ${d.plays} play${d.plays === 1 ? "" : "s"}`}</title>
            </rect>
            {/* First/last month labels only — keep the axis quiet */}
            {(i === 0 || i === data.length - 1) && (
              <text
                x={x + w / 2}
                y={height - 4}
                textAnchor="middle"
                fontSize="5"
                fill="hsl(var(--muted-foreground))"
              >
                {monthLabel(d.month)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
