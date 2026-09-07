import { useEffect, useState } from "react";

type WakeLockSentinelLike = {
  release?: () => Promise<void>;
  addEventListener?: (type: "release", listener: () => void) => void;
};

/**
 * Keep the screen on while `enabled` is true (the old site's "Sleep" button,
 * built on the Screen Wake Lock API). The lock is released when the tab is
 * hidden and re-acquired when it becomes visible again. `supported` lets the
 * toolbar hide the control on browsers without the API.
 */
export function useWakeLock(enabled: boolean) {
  const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!enabled || !supported) {
      setActive(false);
      return;
    }

    const api = (navigator as Navigator & { wakeLock: { request: (type: "screen") => Promise<WakeLockSentinelLike> } }).wakeLock;
    let lock: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const sentinel = await api.request("screen");
        if (cancelled) {
          sentinel.release?.().catch(() => {});
          return;
        }
        lock = sentinel;
        setActive(true);
        sentinel.addEventListener?.("release", () => setActive(false));
      } catch {
        setActive(false);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      lock?.release?.().catch(() => {});
      setActive(false);
    };
  }, [enabled, supported]);

  return { supported, active };
}
