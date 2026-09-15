import { useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { addTap, tempoFromTaps, TAPS_AVERAGED } from "@/lib/tap-tempo";

interface TapTempoPadProps {
  /** Called with the tempo from the second tap on. */
  onTempo: (bpm: number) => void;
}

/**
 * A pad beside the tempo field: tap it along with the song and the field fills
 * in. The first tap starts the count; each tap after that updates the tempo,
 * averaged over the last eight taps. Pausing for three seconds starts over.
 *
 * A finger or mouse taps on press, not release, because a click fires when the
 * finger lifts and that lag varies tap to tap. The keyboard and screen readers
 * tap through the button's own click, which for them carries no pointer.
 */
export function TapTempoPad({ onTempo }: TapTempoPadProps) {
  const taps = useRef<number[]>([]);
  const [count, setCount] = useState(0);
  const [bpm, setBpm] = useState<number | null>(null);

  const tap = (now: number) => {
    taps.current = addTap(taps.current, now);
    const next = tempoFromTaps(taps.current);
    setCount(taps.current.length);
    setBpm(next);
    if (next !== null) onTempo(next);
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button > 0) return; // a right or middle click is not a tap
    // Keep a tap from also selecting text or zooming on a phone.
    event.preventDefault();
    tap(event.timeStamp || performance.now());
  };

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    // detail is 0 for Enter, Space and assistive technology; a pointer already tapped on press.
    if (event.detail === 0) tap(event.timeStamp || performance.now());
  };

  const status = count === 0 ? "Tap the beat" : bpm === null ? "Keep tapping" : `${bpm} BPM · ${Math.min(count, TAPS_AVERAGED)} taps`;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onPointerDown={onPointerDown}
        onClick={onClick}
        className="btn-outline h-10 min-w-[4.5rem] touch-manipulation select-none active:bg-[hsl(var(--muted))]"
        aria-label="Tap tempo"
        aria-describedby="tap-tempo-status"
      >
        Tap
      </button>
      <span id="tap-tempo-status" className="text-xs text-[hsl(var(--muted-foreground))]" aria-live="polite">
        {status}
      </span>
    </div>
  );
}
