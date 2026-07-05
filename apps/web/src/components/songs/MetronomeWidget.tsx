import { useEffect, useRef, useState } from "react";
import { Play, Square, Minus, Plus } from "lucide-react";

/**
 * WebAudio click-track metronome. Seeds from the song tempo but is freely
 * adjustable; accents beat one of each bar.
 */
export function MetronomeWidget({ tempo, beatsPerBar = 4 }: { tempo?: number | null; beatsPerBar?: number }) {
  const [bpm, setBpm] = useState(() => Math.min(240, Math.max(30, tempo || 90)));
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(0);
  const audioRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beatRef = useRef(0);

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRunning(false);
    setBeat(0);
    beatRef.current = 0;
  };

  useEffect(() => stop, []);

  // Restart the interval when BPM changes mid-run
  useEffect(() => {
    if (!running) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(tick, 60_000 / bpm);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, running]);

  const tick = () => {
    const ctx = audioRef.current;
    if (!ctx) return;
    const isDownbeat = beatRef.current % beatsPerBar === 0;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = isDownbeat ? 1200 : 800;
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
    beatRef.current = (beatRef.current + 1) % beatsPerBar;
    setBeat(beatRef.current);
  };

  const start = () => {
    if (!audioRef.current) {
      const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctor) return;
      audioRef.current = new Ctor();
    }
    audioRef.current.resume?.();
    beatRef.current = 0;
    setRunning(true);
  };

  return (
    <div className="card card-body inline-flex items-center gap-3" data-testid="metronome">
      <button
        onClick={running ? stop : start}
        className={running ? "btn-destructive btn-sm" : "btn-primary btn-sm"}
        aria-label={running ? "Stop metronome" : "Start metronome"}
      >
        {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="flex items-center gap-1.5">
        <button onClick={() => setBpm((b) => Math.max(30, b - 5))} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))]" aria-label="Slower">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="text-sm font-medium tabular-nums w-16 text-center">{bpm} BPM</span>
        <button onClick={() => setBpm((b) => Math.min(240, b + 5))} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))]" aria-label="Faster">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1" aria-hidden="true">
        {Array.from({ length: beatsPerBar }, (_, i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full transition-colors ${
              running && beat === (i + 1) % beatsPerBar
                ? i === beatsPerBar - 1
                  ? "bg-[hsl(var(--secondary))]"
                  : "bg-[hsl(var(--foreground))]"
                : "bg-[hsl(var(--muted))]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
