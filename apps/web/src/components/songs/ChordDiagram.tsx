export interface ChordShape {
  name: string;
  baseFret: number;
  frets: number[]; // low E → high E; -1 muted, 0 open
  fingers?: number[] | null;
}

/**
 * Pure-SVG guitar fretboard diagram. Six strings, four fret rows, finger
 * dots, open (○) and muted (✕) markers, and a base-fret label when the
 * shape sits up the neck. Themed via CSS tokens for light/dark.
 */
export function ChordDiagram({ shape, size = 160 }: { shape: ChordShape; size?: number }) {
  const strings = 6;
  const fretRows = 4;
  const pad = 22;
  const width = size;
  const height = size * 1.15;
  const gridW = width - pad * 2;
  const gridH = height - pad * 2.2;
  const stringGap = gridW / (strings - 1);
  const fretGap = gridH / fretRows;
  const topY = pad * 1.6;

  const ink = "hsl(var(--foreground))";
  const muted = "hsl(var(--muted-foreground))";
  const accent = "hsl(var(--secondary))";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: size, height: height }}
      role="img"
      aria-label={`${shape.name} chord diagram`}
    >
      {/* Chord name */}
      <text x={width / 2} y={pad * 0.75} textAnchor="middle" fontSize={14} fontWeight={700} fill={ink}>
        {shape.name}
      </text>

      {/* Nut (thick) when at the first position, else base-fret label */}
      {shape.baseFret <= 1 ? (
        <rect x={pad} y={topY - 3} width={gridW} height={3} fill={ink} />
      ) : (
        <text x={pad - 8} y={topY + fretGap * 0.65} textAnchor="end" fontSize={11} fill={muted}>
          {shape.baseFret}
        </text>
      )}

      {/* Frets */}
      {Array.from({ length: fretRows + 1 }, (_, i) => (
        <line
          key={`f-${i}`}
          x1={pad}
          y1={topY + i * fretGap}
          x2={pad + gridW}
          y2={topY + i * fretGap}
          stroke={muted}
          strokeWidth={1}
        />
      ))}

      {/* Strings */}
      {Array.from({ length: strings }, (_, i) => (
        <line
          key={`s-${i}`}
          x1={pad + i * stringGap}
          y1={topY}
          x2={pad + i * stringGap}
          y2={topY + gridH}
          stroke={muted}
          strokeWidth={1}
        />
      ))}

      {/* Markers per string */}
      {shape.frets.map((fret, i) => {
        const x = pad + i * stringGap;
        if (fret === -1) {
          return (
            <text key={`m-${i}`} x={x} y={topY - 7} textAnchor="middle" fontSize={11} fill={muted}>
              ✕
            </text>
          );
        }
        if (fret === 0) {
          return (
            <circle key={`m-${i}`} cx={x} cy={topY - 10} r={4} fill="none" stroke={muted} strokeWidth={1.5} />
          );
        }
        const y = topY + (fret - 0.5) * fretGap;
        const finger = shape.fingers?.[i];
        return (
          <g key={`m-${i}`}>
            <circle cx={x} cy={y} r={stringGap * 0.36} fill={accent} />
            {finger != null && finger > 0 && (
              <text x={x} y={y + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="hsl(var(--secondary-foreground))">
                {finger}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
