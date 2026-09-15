import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Pause, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { SongAudioTrack } from "@/lib/song-media";

interface SongAudioBarProps {
  /** Where a part plays from: the member media route, or a share link's. */
  mediaHref: (directive: string) => string;
  tracks: SongAudioTrack[];
}

type PlayState = "idle" | "loading" | "playing" | "paused";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * A song's practice audio, docked above the section jump bar.
 *
 * Docked rather than placed under the title: a singer starts a part and then
 * reads the chart, and if the pause button had scrolled off screen they would
 * have to scroll back to stop the audio, which is no good on a music stand.
 *
 * The scrub bar is its OWN full-width row under the part buttons, shown only
 * while a part is loaded. It is not inside the button row, because that row
 * scrolls sideways and a drag target inside it would fight the swipe. On its
 * own row it gets the whole width of the phone and nothing to fight.
 *
 * Deliberately NO keyboard shortcut. Space and PageDown already scroll the
 * chart as Bluetooth foot-pedal support (see hooks/useKeyboardShortcuts), and
 * binding Space to play/pause would break page turns mid-song.
 */
export function SongAudioBar({ mediaHref, tracks }: SongAudioBarProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const [state, setStateValue] = useState<PlayState>("idle");
  // Mirrors `state` so media event handlers read the current value without
  // running side effects inside a state updater.
  const stateRef = useRef<PlayState>("idle");
  const setState = (next: PlayState) => {
    stateRef.current = next;
    setStateValue(next);
  };
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const [announcement, setAnnouncement] = useState("");
  // Each tap bumps this, so a late event from the previous track's source
  // cannot light up the chip that was just tapped.
  const generation = useRef(0);

  // Stop on the way out, or navigating away leaves audio playing with no
  // visible control.
  useEffect(() => {
    const el = audioRef.current;
    return () => {
      if (!el) return;
      el.pause();
      el.removeAttribute("src");
      el.load();
    };
  }, []);

  if (tracks.length === 0) return null;

  const labelOf = (directive: string | null) => tracks.find((t) => t.directive === directive)?.label ?? "";

  const markFailed = (directive: string) => {
    setFailed((prev) => new Set(prev).add(directive));
    setState("idle");
    setAnnouncement(`${labelOf(directive)} is unavailable`);
    toast.error("That recording could not be loaded");
  };

  const play = (track: SongAudioTrack) => {
    const el = audioRef.current;
    if (!el || failed.has(track.directive)) return;

    if (active === track.directive) {
      // Tapping the playing part toggles it. State is set here rather than
      // left to the pause event, which arrives later and is ignored while
      // loading (see onPause).
      if (state === "playing" || state === "loading") {
        el.pause();
        setState("paused");
        setAnnouncement(`${track.label} paused`);
      } else {
        // `play()` returns undefined in older Safari and in jsdom, so wrap it.
        void Promise.resolve(el.play()).catch(() => markFailed(track.directive));
      }
      return;
    }

    // A different part: stop, swap, start from the top. These are separate
    // recordings of different lengths, so carrying the position over would
    // land somewhere meaningless.
    //
    // Keep this synchronous. iOS grants autoplay to the tap itself, and any
    // await before play() loses the grant, so the first tap would silently do
    // nothing on an iPhone.
    generation.current += 1;
    el.pause();
    el.src = mediaHref(track.directive);
    setActive(track.directive);
    setState("loading");
    setElapsed(0);
    setDuration(0);
    setAnnouncement(`Loading ${track.label}`);
    const mine = generation.current;
    void Promise.resolve(el.play()).catch(() => {
      if (generation.current === mine) markFailed(track.directive);
    });
  };

  const replay = () => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    setElapsed(0);
    if (state !== "playing") void Promise.resolve(el.play()).catch(() => active && markFailed(active));
  };


  /** Jump to a point in the current part, clamped to the track. */
  const seek = (seconds: number) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(seconds)) return;
    const target = Math.max(0, duration > 0 ? Math.min(seconds, duration) : seconds);
    el.currentTime = target;
    setElapsed(target);
  };

  const showScrubber = active !== null && (state === "playing" || state === "paused" || state === "loading");

  return (
    <div
      className="print-hidden shrink-0 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 backdrop-blur"
      data-testid="song-audio-bar"
    >
      <div role="group" aria-label="Practice audio" className="flex items-center gap-2 overflow-x-auto px-3 py-2">
        {tracks.map((track) => {
          const isActive = active === track.directive;
          const isFailed = failed.has(track.directive);
          const isPlaying = isActive && state === "playing";
          const isLoading = isActive && state === "loading";

          if (isFailed) {
            return (
              <button
                key={track.directive}
                type="button"
                disabled
                className="btn-outline btn-sm shrink-0 whitespace-nowrap opacity-60"
                title="This recording could not be loaded"
              >
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                {track.label} unavailable
              </button>
            );
          }

          return (
            <div key={track.directive} className="relative flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => play(track)}
                aria-pressed={isPlaying}
                aria-busy={isLoading || undefined}
                aria-label={`${isPlaying ? "Pause" : "Play"} ${track.label}`}
                className={`btn-sm shrink-0 whitespace-nowrap ${isActive ? "btn-primary" : "btn-outline"}`}
              >
                {isLoading ? (
                  <span className="spinner h-3.5 w-3.5" aria-hidden="true" />
                ) : isPlaying ? (
                  <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {track.label}
              </button>
              {isActive && (state === "playing" || state === "paused") && (
                <button
                  type="button"
                  onClick={replay}
                  aria-label={`Replay ${track.label} from the start`}
                  className="btn-icon btn-ghost ml-1 h-8 w-8 shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}

            </div>
          );
        })}
      </div>

      {showScrubber && (
        <div className="flex items-center gap-3 px-3 pb-2" data-testid="audio-scrubber">
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
            {formatTime(elapsed)}
          </span>
          <input
            type="range"
            min={0}
            max={duration > 0 ? duration : 0}
            step={0.1}
            value={Math.min(elapsed, duration > 0 ? duration : 0)}
            disabled={duration <= 0}
            onChange={(event) => seek(Number(event.target.value))}
            aria-label={`Position in ${labelOf(active)}`}
            aria-valuetext={`${formatTime(elapsed)} of ${formatTime(duration)}`}
            className="h-6 min-w-0 flex-1 cursor-pointer accent-[hsl(var(--secondary))] disabled:cursor-default disabled:opacity-50"
          />
          <span className="w-10 shrink-0 text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
            {duration > 0 ? formatTime(duration) : "--:--"}
          </span>
        </div>
      )}

      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>

      <audio
        ref={audioRef}
        preload="none"
        onPlaying={() => {
          setState("playing");
          setAnnouncement(`Playing ${labelOf(active)}`);
        }}
        onWaiting={() => setState("loading")}
        // Media events are queued, not synchronous. Swapping parts calls
        // pause() on the old source and then marks the new one "loading", so
        // that pause event arrives AFTER the new state and would wrongly flip
        // it to "paused". Only a pause while genuinely playing is honoured,
        // which still catches the lock screen, a headphone unplug, or a call.
        onPause={() => {
          if (stateRef.current !== "playing") return;
          setState("paused");
          setAnnouncement(`${labelOf(active)} paused`);
        }}
        onEnded={() => {
          setState("idle");
          setElapsed(0);
          setAnnouncement(`${labelOf(active)} finished`);
        }}
        onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onError={() => {
          if (active) markFailed(active);
        }}
      />
    </div>
  );
}
