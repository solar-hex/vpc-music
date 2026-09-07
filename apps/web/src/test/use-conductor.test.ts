import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useConductor } from "@/hooks/useConductor";

// ---------- Mocks ----------
const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// Socket mock
const mockEmit = vi.fn();
const mockOn = vi.fn();
const mockDisconnect = vi.fn();

const mockSocket = {
  on: mockOn,
  emit: mockEmit,
  disconnect: mockDisconnect,
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

const fakeUser = {
  id: "u-1",
  email: "test@example.com",
  displayName: "Test User",
  role: "owner",
};

describe("useConductor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: fakeUser });
    // Reset the on handler store
    mockOn.mockImplementation(() => mockSocket);
  });

  // Helper to capture the event handlers registered via socket.on
  function captureHandlers() {
    const handlers: Record<string, (...args: any[]) => void> = {};
    mockOn.mockImplementation((event: string, handler: (...args: any[]) => void) => {
      handlers[event] = handler;
      return mockSocket;
    });
    return handlers;
  }

  // ===================== INITIAL STATE =====================

  describe("initial state", () => {
    it("returns connected=false initially", () => {
      captureHandlers();
      const { result } = renderHook(() =>
        useConductor({ setlistId: "sl-1", mode: "conductor" }),
      );
      expect(result.current.connected).toBe(false);
    });

    it("returns currentSong=0 initially", () => {
      captureHandlers();
      const { result } = renderHook(() =>
        useConductor({ setlistId: "sl-1", mode: "conductor" }),
      );
      expect(result.current.currentSong).toBe(0);
    });

    it("returns currentSection=null initially", () => {
      captureHandlers();
      const { result } = renderHook(() =>
        useConductor({ setlistId: "sl-1", mode: "conductor" }),
      );
      expect(result.current.currentSection).toBeNull();
    });

    it("returns initial roomState", () => {
      captureHandlers();
      const { result } = renderHook(() =>
        useConductor({ setlistId: "sl-1", mode: "conductor" }),
      );
      expect(result.current.roomState).toEqual({
        conductor: null,
        members: [],
        currentSong: 0,
        currentSection: null,
      });
    });

    it("sets isConductor=true in conductor mode", () => {
      captureHandlers();
      const { result } = renderHook(() =>
        useConductor({ setlistId: "sl-1", mode: "conductor" }),
      );
      expect(result.current.isConductor).toBe(true);
    });

    it("sets isConductor=false in member mode", () => {
      captureHandlers();
      const { result } = renderHook(() =>
        useConductor({ setlistId: "sl-1", mode: "member" }),
      );
      expect(result.current.isConductor).toBe(false);
    });
  });

  // ===================== CONNECTION =====================

  describe("connection events", () => {
    it("registers core socket event listeners", () => {
      captureHandlers();
      renderHook(() =>
        useConductor({ setlistId: "sl-1", mode: "conductor" }),
      );
      const registeredEvents = mockOn.mock.calls.map((c: any[]) => c[0]);
      expect(registeredEvents).toContain("connect");
      expect(registeredEvents).toContain("disconnect");
      expect(registeredEvents).toContain("room:state");
      expect(registeredEvents).toContain("song:changed");
      expect(registeredEvents).toContain("scroll:sync");
      expect(registeredEvents).toContain("member:joined");
      expect(registeredEvents).toContain("member:left");
      expect(registeredEvents).toContain("conductor:left");
    });

    it("emits conductor:join on connect in conductor mode", () => {
      const handlers = captureHandlers();
      renderHook(() =>
        useConductor({ setlistId: "sl-1", mode: "conductor" }),
      );
      // Simulate connect
      act(() => handlers["connect"]());
      expect(mockEmit).toHaveBeenCalledWith("conductor:join", {
        setlistId: "sl-1",
        userId: "u-1",
        displayName: "Test User",
      });
    });

    it("emits member:join on connect in member mode", () => {
      const handlers = captureHandlers();
      renderHook(() =>
        useConductor({ setlistId: "sl-1", mode: "member" }),
      );
      act(() => handlers["connect"]());
      expect(mockEmit).toHaveBeenCalledWith("member:join", {
        setlistId: "sl-1",
        userId: "u-1",
        displayName: "Test User",
      });
    });

    it("does not connect when user is null", () => {
      mockUseAuth.mockReturnValue({ user: null });
      captureHandlers();
      renderHook(() =>
        useConductor({ setlistId: "sl-1", mode: "conductor" }),
      );
      // When user is null, the effect bails early — no socket events registered
      expect(mockOn).not.toHaveBeenCalled();
    });

    it("does not connect when setlistId is empty", () => {
      captureHandlers();
      renderHook(() =>
        useConductor({ setlistId: "", mode: "conductor" }),
      );
      // When setlistId is empty, the effect bails early
      expect(mockOn).not.toHaveBeenCalled();
    });
  });

  // ===================== ROOM STATE UPDATES =====================

  describe("room state updates", () => {
    it("updates roomState on room:state event", () => {
      const handlers = captureHandlers();
      const { result } = renderHook(() =>
        useConductor({ setlistId: "sl-1", mode: "conductor" }),
      );

      const newState = {
        conductor: { userId: "u-1", displayName: "Test User" },
        members: [{ userId: "u-2", displayName: "Member" }],
        currentSong: 2,
        currentSection: "Chorus",
      };

      act(() => handlers["room:state"](newState));
      expect(result.current.roomState).toEqual(newState);
      expect(result.current.currentSong).toBe(2);
      expect(result.current.currentSection).toBe("Chorus");
    });

    it("updates currentSong on song:changed event", () => {
      const handlers = captureHandlers();
      const { result } = renderHook(() =>
        useConductor({ setlistId: "sl-1", mode: "member" }),
      );

      act(() => handlers["song:changed"]({ songIndex: 3, section: "Bridge" }));
      expect(result.current.currentSong).toBe(3);
      expect(result.current.currentSection).toBe("Bridge");
    });

    it("updates scrollTop on scroll:sync event", () => {
      const handlers = captureHandlers();
      const { result } = renderHook(() =>
        useConductor({ setlistId: "sl-1", mode: "member" }),
      );

      act(() => handlers["scroll:sync"]({ scrollTop: 150 }));
      expect(result.current.scrollTop).toBe(150);
    });

    it("adds member on member:joined event", () => {
      const handlers = captureHandlers();
      const { result } = renderHook(() =>
        useConductor({ setlistId: "sl-1", mode: "conductor" }),
      );

      act(() =>
        handlers["member:joined"]({ userId: "u-3", displayName: "New Member" }),
      );
      expect(result.current.roomState.members).toContainEqual({
        userId: "u-3",
        displayName: "New Member",
      });
    });

    it("removes member on member:left event", () => {
      const handlers = captureHandlers();
      const { result } = renderHook(() =>
        useConductor({ setlistId: "sl-1", mode: "conductor" }),
      );

      act(() =>
        handlers["member:joined"]({ userId: "u-3", displayName: "Leaving" }),
      );
      act(() => handlers["member:left"]({ userId: "u-3" }));
      expect(
        result.current.roomState.members.find((m) => m.userId === "u-3"),
      ).toBeUndefined();
    });

    it("clears conductor on conductor:left event", () => {
      const handlers = captureHandlers();
      const { result } = renderHook(() =>
        useConductor({ setlistId: "sl-1", mode: "member" }),
      );

      // First set a conductor via room:state
      act(() =>
        handlers["room:state"]({
          conductor: { userId: "u-1", displayName: "Leader" },
          members: [],
          currentSong: 0,
          currentSection: null,
        }),
      );
      expect(result.current.roomState.conductor).toBeTruthy();

      act(() => handlers["conductor:left"]());
      expect(result.current.roomState.conductor).toBeNull();
    });
  });

  // ===================== CONDUCTOR CONTROLS =====================

  describe("conductor controls", () => {
    it("goToSong emits conductor:goto in conductor mode", () => {
      const handlers = captureHandlers();
      const { result } = renderHook(() =>
        useConductor({ setlistId: "sl-1", mode: "conductor" }),
      );
      // Need to connect first so socketRef is set
      act(() => handlers["connect"]());

      act(() => result.current.goToSong(2, "Verse"));
      expect(mockEmit).toHaveBeenCalledWith("conductor:goto", {
        songIndex: 2,
        section: "Verse",
      });
    });

    it("goToSong is a no-op in member mode", () => {
      const handlers = captureHandlers();
      const { result } = renderHook(() =>
        useConductor({ setlistId: "sl-1", mode: "member" }),
      );
      act(() => handlers["connect"]());

      act(() => result.current.goToSong(2));
      expect(mockEmit).not.toHaveBeenCalledWith(
        "conductor:goto",
        expect.anything(),
      );
    });

    it("broadcastScroll emits conductor:scroll in conductor mode", () => {
      const handlers = captureHandlers();
      const { result } = renderHook(() =>
        useConductor({ setlistId: "sl-1", mode: "conductor" }),
      );
      act(() => handlers["connect"]());

      act(() => result.current.broadcastScroll(200));
      expect(mockEmit).toHaveBeenCalledWith("conductor:scroll", {
        scrollTop: 200,
      });
    });

    it("broadcastScroll is a no-op in member mode", () => {
      const handlers = captureHandlers();
      const { result } = renderHook(() =>
        useConductor({ setlistId: "sl-1", mode: "member" }),
      );
      act(() => handlers["connect"]());

      act(() => result.current.broadcastScroll(200));
      expect(mockEmit).not.toHaveBeenCalledWith(
        "conductor:scroll",
        expect.anything(),
      );
    });

    it("leave emits leave and disconnects", () => {
      const handlers = captureHandlers();
      const { result } = renderHook(() =>
        useConductor({ setlistId: "sl-1", mode: "conductor" }),
      );
      act(() => handlers["connect"]());

      act(() => result.current.leave());
      expect(mockEmit).toHaveBeenCalledWith("leave");
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  // ===================== CLEANUP =====================

  describe("cleanup on unmount", () => {
    it("emits leave and disconnects on unmount", () => {
      captureHandlers();
      const { unmount } = renderHook(() =>
        useConductor({ setlistId: "sl-1", mode: "conductor" }),
      );
      unmount();
      expect(mockEmit).toHaveBeenCalledWith("leave");
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });
});
