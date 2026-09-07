import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useWakeLock } from "@/hooks/useWakeLock";

describe("useWakeLock", () => {
  const release = vi.fn().mockResolvedValue(undefined);
  const request = vi.fn();

  beforeEach(() => {
    request.mockReset();
    release.mockClear();
    request.mockResolvedValue({ release, addEventListener: vi.fn() });
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  afterEach(() => {
    // @ts-expect-error test cleanup
    delete navigator.wakeLock;
  });

  it("reports support and does nothing while disabled", () => {
    const { result } = renderHook(() => useWakeLock(false));
    expect(result.current.supported).toBe(true);
    expect(result.current.active).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it("requests a screen lock when enabled and releases it when disabled", async () => {
    const { result, rerender } = renderHook(({ enabled }) => useWakeLock(enabled), { initialProps: { enabled: true } });
    await waitFor(() => expect(result.current.active).toBe(true));
    expect(request).toHaveBeenCalledWith("screen");
    rerender({ enabled: false });
    expect(release).toHaveBeenCalled();
    expect(result.current.active).toBe(false);
  });

  it("re-acquires the lock when the tab becomes visible again", async () => {
    const { result } = renderHook(() => useWakeLock(true));
    await waitFor(() => expect(result.current.active).toBe(true));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });

  it("stays inactive when the request is rejected", async () => {
    request.mockRejectedValue(new Error("denied"));
    const { result } = renderHook(() => useWakeLock(true));
    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(result.current.active).toBe(false);
  });

  it("reports no support without the API", () => {
    // @ts-expect-error test setup
    delete navigator.wakeLock;
    const { result } = renderHook(() => useWakeLock(true));
    expect(result.current.supported).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
});
