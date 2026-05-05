import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { openOAuthPopup, type OAuthResult } from "@/lib/oauth-popup";

describe("openOAuthPopup", () => {
  let originalOpen: typeof window.open;
  let mockPopup: { closed: boolean; close: () => void };
  const expectedAuthPath = import.meta.env.VITE_API_URL ? "/auth/google" : "/api/auth/google";

  beforeEach(() => {
    vi.clearAllMocks();
    originalOpen = window.open;
    mockPopup = { closed: false, close: vi.fn() };
    // Default: popup opens successfully
    window.open = vi.fn().mockReturnValue(mockPopup);
  });

  afterEach(() => {
    window.open = originalOpen;
  });

  // ===================== POPUP OPENING =====================

  describe("popup opening", () => {
    it("opens a popup window with correct URL", () => {
      openOAuthPopup("google");
      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining(expectedAuthPath),
        expect.stringContaining("vpc-oauth-google"),
        expect.any(String),
      );
    });

    it("centers the popup on screen", () => {
      openOAuthPopup("google");
      const features = (window.open as ReturnType<typeof vi.fn>).mock.calls[0][2];
      expect(features).toContain("width=500");
      expect(features).toContain("height=600");
    });

    it("disables toolbar and menubar", () => {
      openOAuthPopup("google");
      const features = (window.open as ReturnType<typeof vi.fn>).mock.calls[0][2];
      expect(features).toContain("toolbar=no");
      expect(features).toContain("menubar=no");
    });

    it("rejects when popup is blocked", async () => {
      window.open = vi.fn().mockReturnValue(null);
      await expect(openOAuthPopup("google")).rejects.toThrow(
        "Popup blocked",
      );
    });
  });

  // ===================== MESSAGE HANDLING =====================

  describe("postMessage handling", () => {
    it("resolves on VPC_OAUTH_CALLBACK message from same origin", async () => {
      const promise = openOAuthPopup("google");

      // Simulate postMessage from same origin
      const event = new MessageEvent("message", {
        origin: window.location.origin,
        data: { type: "VPC_OAUTH_CALLBACK", success: true, token: "jwt-token", user: { id: "u-1" } },
      });
      window.dispatchEvent(event);

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.token).toBe("jwt-token");
    });

    it("ignores messages from untrusted origins", async () => {
      vi.useFakeTimers();

      const promise = openOAuthPopup("google");

      // Send message from untrusted origin
      const untrustedEvent = new MessageEvent("message", {
        origin: "https://evil.com",
        data: { type: "VPC_OAUTH_CALLBACK", success: true },
      });
      window.dispatchEvent(untrustedEvent);

      // The promise should still be pending — close the popup to resolve
      mockPopup.closed = true;
      // Advance timer to trigger the close check
      vi.advanceTimersByTime(600);

      const result = await promise;
      expect(result.success).toBe(false);

      vi.useRealTimers();
    });

    it("ignores messages with wrong type", async () => {
      vi.useFakeTimers();

      const promise = openOAuthPopup("google");

      const wrongType = new MessageEvent("message", {
        origin: window.location.origin,
        data: { type: "OTHER_EVENT", success: true },
      });
      window.dispatchEvent(wrongType);

      // Still pending — close popup
      mockPopup.closed = true;
      vi.advanceTimersByTime(600);

      const result = await promise;
      expect(result.success).toBe(false);

      vi.useRealTimers();
    });
  });

  // ===================== POPUP CLOSE =====================

  describe("popup close detection", () => {
    it("resolves with success=false when popup is closed without callback", async () => {
      vi.useFakeTimers();

      const promise = openOAuthPopup("google");

      // Simulate user closing popup
      mockPopup.closed = true;
      vi.advanceTimersByTime(600);

      const result = await promise;
      expect(result.success).toBe(false);

      vi.useRealTimers();
    });
  });

  // ===================== CLEANUP =====================

  describe("cleanup", () => {
    it("removes message event listener after resolve", async () => {
      const addSpy = vi.spyOn(window, "addEventListener");
      const removeSpy = vi.spyOn(window, "removeEventListener");

      const promise = openOAuthPopup("google");

      const event = new MessageEvent("message", {
        origin: window.location.origin,
        data: { type: "VPC_OAUTH_CALLBACK", success: true },
      });
      window.dispatchEvent(event);

      await promise;

      expect(removeSpy).toHaveBeenCalledWith("message", expect.any(Function));

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });
});
