import { useEffect, useRef, useState, useCallback } from "react";
import { annotationsApi, type AnnotationStroke } from "@/lib/api-client";
import { toast } from "sonner";
import { Pen, Highlighter, Eraser, Eye, EyeOff, Trash2 } from "lucide-react";

const PEN_COLORS = ["#e5484d", "#0091ff", "#12a594", "#f5a623"];
const HIGHLIGHT_COLOR = "#f5d90a";

type Tool = "pen" | "highlighter" | "eraser";

/**
 * Ink layer over a chart (story: mark cues live, like drawing on paper).
 * Strokes are stored in coordinates normalized to the host's content box, so
 * they stretch with font-size changes and different screens. One drawing per
 * user per song, saved automatically after each stroke.
 */
export function AnnotationOverlay({
  songId,
  /** The element the canvas covers; the overlay renders inside it. */
  hostRef,
}: {
  songId: string;
  hostRef: React.RefObject<HTMLElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<AnnotationStroke[]>([]);
  const [visible, setVisible] = useState(true);
  const [drawMode, setDrawMode] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(PEN_COLORS[0]);
  const drawingRef = useRef<AnnotationStroke | null>(null);
  const strokesRef = useRef<AnnotationStroke[]>([]);
  strokesRef.current = strokes;

  // Load my saved drawing
  useEffect(() => {
    annotationsApi
      .get(songId)
      .then((res) => setStrokes(res.annotation?.data ?? []))
      .catch(() => {});
  }, [songId]);

  const save = useCallback(
    (next: AnnotationStroke[]) => {
      annotationsApi.save(songId, next).catch(() => toast.error("Couldn't save your markup"));
    },
    [songId],
  );

  // Redraw whenever strokes/visibility change or the host resizes.
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const w = host.scrollWidth;
    const h = host.scrollHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    if (!visible) return;
    const paint = (stroke: AnnotationStroke) => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      if (stroke.tool === "highlighter") {
        ctx.strokeStyle = stroke.color;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 14;
      } else {
        ctx.strokeStyle = stroke.color;
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2.5;
      }
      stroke.points.forEach((p, i) => {
        const x = p.x * w;
        const y = p.y * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    strokes.forEach(paint);
    if (drawingRef.current) paint(drawingRef.current);
  }, [strokes, visible, hostRef]);

  useEffect(() => {
    redraw();
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => redraw());
    observer.observe(host);
    return () => observer.disconnect();
  }, [redraw, hostRef]);

  const pointFromEvent = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const eraseNear = (pt: { x: number; y: number }) => {
    const threshold = 0.02; // normalized distance
    const next = strokesRef.current.filter(
      (stroke) => !stroke.points.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) < threshold),
    );
    if (next.length !== strokesRef.current.length) {
      setStrokes(next);
      save(next);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!drawMode) return;
    const pt = pointFromEvent(e);
    if (!pt) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === "eraser") {
      eraseNear(pt);
      return;
    }
    drawingRef.current = {
      tool,
      color: tool === "highlighter" ? HIGHLIGHT_COLOR : color,
      points: [pt],
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawMode) return;
    const pt = pointFromEvent(e);
    if (!pt) return;
    if (tool === "eraser") {
      if (e.buttons > 0) eraseNear(pt);
      return;
    }
    if (!drawingRef.current) return;
    drawingRef.current.points.push(pt);
    redraw();
  };

  const onPointerUp = () => {
    if (!drawingRef.current) return;
    const finished = drawingRef.current;
    drawingRef.current = null;
    if (finished.points.length >= 2) {
      const next = [...strokesRef.current, finished];
      setStrokes(next);
      save(next);
    } else {
      redraw();
    }
  };

  const clearAll = () => {
    setStrokes([]);
    save([]);
  };

  return (
    <>
      {/* Toolbar row — kept above the ink canvas so it stays clickable */}
      <div className="relative z-20 mb-2 flex flex-wrap items-center gap-1.5 print-hidden">
        <button
          onClick={() => {
            setDrawMode((v) => !v);
            if (!drawMode) setVisible(true);
          }}
          className={`btn-sm ${drawMode ? "btn-primary" : "btn-outline"}`}
          title={drawMode ? "Stop drawing" : "Draw on the chart"}
        >
          <Pen className="h-3.5 w-3.5" /> {drawMode ? "Done" : "Markup"}
        </button>
        {drawMode && (
          <>
            <button
              onClick={() => setTool("pen")}
              className={`btn-icon ${tool === "pen" ? "btn-primary" : "btn-ghost"}`}
              title="Pen"
              aria-label="Pen"
            >
              <Pen className="h-4 w-4" />
            </button>
            <button
              onClick={() => setTool("highlighter")}
              className={`btn-icon ${tool === "highlighter" ? "btn-primary" : "btn-ghost"}`}
              title="Highlighter"
              aria-label="Highlighter"
            >
              <Highlighter className="h-4 w-4" />
            </button>
            <button
              onClick={() => setTool("eraser")}
              className={`btn-icon ${tool === "eraser" ? "btn-primary" : "btn-ghost"}`}
              title="Eraser (tap strokes to remove)"
              aria-label="Eraser"
            >
              <Eraser className="h-4 w-4" />
            </button>
            {tool === "pen" &&
              PEN_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full ${color === c ? "ring-2 ring-offset-1 ring-[hsl(var(--secondary))]" : ""}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Pen color ${c}`}
                />
              ))}
            {strokes.length > 0 && (
              <button onClick={clearAll} className="btn-icon btn-ghost" title="Clear all markup" aria-label="Clear all markup">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </>
        )}
        {strokes.length > 0 && !drawMode && (
          <button
            onClick={() => setVisible((v) => !v)}
            className="btn-icon btn-ghost"
            title={visible ? "Hide markup" : "Show markup"}
            aria-label={visible ? "Hide markup" : "Show markup"}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* The ink canvas — absolutely covers the host's content */}
      <canvas
        ref={canvasRef}
        data-testid="annotation-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`absolute inset-0 print-hidden ${drawMode ? "z-10 cursor-crosshair touch-none" : "pointer-events-none"}`}
        style={{ width: "100%", height: "100%" }}
        aria-hidden="true"
      />
    </>
  );
}
