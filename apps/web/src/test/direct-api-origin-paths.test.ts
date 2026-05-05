import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  };
}

describe("direct API origin paths", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_API_URL", "http://localhost:3001");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("strips the /api prefix for direct auth requests", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(jsonResponse({ user: { id: "u1" }, token: "jwt-token" }));

    const { authApi } = await import("@/lib/api-client");
    await authApi.login("test@example.com", "password");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/auth/login",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("strips the /api prefix for direct song requests", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(jsonResponse({ songs: [], total: 0 }));

    const { songsApi } = await import("@/lib/api-client");
    await songsApi.list();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/songs",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("opens the OAuth popup on the direct auth route", async () => {
    vi.useFakeTimers();

    const popup = { closed: false, close: vi.fn() };
    const originalOpen = window.open;
    window.open = vi.fn().mockReturnValue(popup as never);

    const { openOAuthPopup } = await import("@/lib/oauth-popup");
    const promise = openOAuthPopup("google");

    expect(window.open).toHaveBeenCalledWith(
      "http://localhost:3001/auth/google",
      expect.stringContaining("vpc-oauth-google"),
      expect.any(String),
    );

    popup.closed = true;
    vi.advanceTimersByTime(600);
    await promise;

    window.open = originalOpen;
    vi.useRealTimers();
  });
});