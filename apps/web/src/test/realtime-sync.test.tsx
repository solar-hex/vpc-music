import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SetlistViewPage } from "@/pages/setlists/SetlistViewPage";
import * as fs from "fs";
import * as path from "path";

// ---------- Mock state ----------
let mockConductorState = {
  connected: false,
  roomState: {
    conductor: null as { userId: string; displayName: string } | null,
    members: [] as { userId: string; displayName: string }[],
    currentSong: 0,
    currentSection: null as string | null,
  },
  currentSong: 0,
  currentSection: null as string | null,
  scrollTop: 0,
  isConductor: false,
};
const mockGoToSong = vi.fn();
const mockBroadcastScroll = vi.fn();
const mockLeave = vi.fn();

vi.mock("@/hooks/useConductor", () => ({
  useConductor: () => ({
    ...mockConductorState,
    goToSong: mockGoToSong,
    broadcastScroll: mockBroadcastScroll,
    leave: mockLeave,
  }),
}));

const mockGetSetlist = vi.fn();
const mockDeleteSetlist = vi.fn();
const mockAddSong = vi.fn();
const mockRemoveSong = vi.fn();
const mockReorderSongs = vi.fn();
const mockSongsList = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/lib/api-client", () => ({
  eventsApi: { list: vi.fn().mockResolvedValue({ events: [] }) },
  setlistsApi: {
    get: (...args: any[]) => mockGetSetlist(...args),
    delete: (...args: any[]) => mockDeleteSetlist(...args),
    addSong: (...args: any[]) => mockAddSong(...args),
    removeSong: (...args: any[]) => mockRemoveSong(...args),
    reorderSongs: (...args: any[]) => mockReorderSongs(...args),
    markComplete: vi.fn(),
    reopen: vi.fn(),
  },
  songsApi: {
    list: (...args: any[]) => mockSongsList(...args),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@vpc-music/shared", () => ({
  transposeKeyName: (key: string) => key,
  analyze: () => ({ curve: [], keys: [], transitions: [], timing: { musicSeconds: 0, gapSeconds: 0, totalSeconds: 0, targetSeconds: null, overBySeconds: null, underBySeconds: null }, signals: [] }),
  keyPrefersFlats: () => false,
  parseBarLine: () => ({ measures: [] }),
  ALL_KEYS: ["C", "D", "E", "F", "G", "A", "B"],
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "test@test.com", displayName: "Test", role: "owner" },
    activeOrg: { id: "org1", name: "Test Church", role: "admin" },
  }),
}));

// ---------- Setup ----------
const mockSetlist = { id: "sl-1", name: "Sunday Service", status: "draft", category: "worship", notes: "" };
const mockSongs = [
  { id: "item-1", songId: "s1", position: 0, songTitle: "Amazing Grace", songKey: "G", songArtist: "Hymn", songTempo: 80, key: null, notes: null },
  { id: "item-2", songId: "s2", position: 1, songTitle: "How Great", songKey: "C", songArtist: "Tomlin", songTempo: 128, key: null, notes: null },
  { id: "item-3", songId: "s3", position: 2, songTitle: "Reckless Love", songKey: "Bb", songArtist: "Asbury", songTempo: 76, key: null, notes: null },
];

function renderPage(id = "sl-1") {
  return render(
    <MemoryRouter initialEntries={[`/setlists/${id}`]}>
      <Routes>
        <Route path="/setlists/:id" element={<SetlistViewPage />} />
        <Route path="/setlists" element={<div>Setlists List</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Real-time Sync UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConductorState = {
      connected: false,
      roomState: { conductor: null, members: [], currentSong: 0, currentSection: null },
      currentSong: 0,
      currentSection: null,
      scrollTop: 0,
      isConductor: false,
    };
    mockGetSetlist.mockResolvedValue({ setlist: mockSetlist, songs: mockSongs });
  });

  // ===================== RENDERING =====================
  describe("rendering", () => {
    it("shows Live Mode panel with Lead and Join buttons", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Live Mode")).toBeInTheDocument();
        expect(screen.getByTestId("start-conductor")).toBeInTheDocument();
        expect(screen.getByTestId("join-member")).toBeInTheDocument();
      });
    });

    it("Lead Session button has correct text", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId("start-conductor")).toHaveTextContent("Lead Session");
      });
    });

    it("Join Session button has correct text", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId("join-member")).toHaveTextContent("Join Session");
      });
    });

    it("shows connection status after entering live mode", async () => {
      renderPage();
      await waitFor(() => screen.getByText("Live Mode"));
      fireEvent.click(screen.getByTestId("start-conductor"));
      expect(screen.getByTestId("connection-status")).toBeInTheDocument();
    });

    it("shows Disconnected when not connected", async () => {
      mockConductorState.connected = false;
      renderPage();
      await waitFor(() => screen.getByText("Live Mode"));
      fireEvent.click(screen.getByTestId("start-conductor"));
      expect(screen.getByTestId("connection-status")).toHaveTextContent("Disconnected");
    });

    it("shows Connected when connected", async () => {
      mockConductorState.connected = true;
      renderPage();
      await waitFor(() => screen.getByText("Live Mode"));
      fireEvent.click(screen.getByTestId("start-conductor"));
      expect(screen.getByTestId("connection-status")).toHaveTextContent("Connected");
    });

    it("shows members count", async () => {
      mockConductorState.roomState.members = [
        { userId: "u1", displayName: "Alice" },
        { userId: "u2", displayName: "Bob" },
      ];
      renderPage();
      await waitFor(() => screen.getByText("Live Mode"));
      fireEvent.click(screen.getByTestId("start-conductor"));
      expect(screen.getByTestId("members-count")).toHaveTextContent("2 members");
    });

    it("shows singular 'member' for count of 1", async () => {
      mockConductorState.roomState.members = [
        { userId: "u1", displayName: "Alice" },
      ];
      renderPage();
      await waitFor(() => screen.getByText("Live Mode"));
      fireEvent.click(screen.getByTestId("join-member"));
      expect(screen.getByTestId("members-count")).toHaveTextContent("1 member");
    });

    it("shows conductor name when a conductor is present", async () => {
      mockConductorState.roomState.conductor = { userId: "u1", displayName: "Worship Leader" };
      renderPage();
      await waitFor(() => screen.getByText("Live Mode"));
      fireEvent.click(screen.getByTestId("join-member"));
      expect(screen.getByText("Worship Leader")).toBeInTheDocument();
    });

    it("shows Now playing banner with current song", async () => {
      mockConductorState.currentSong = 1;
      renderPage();
      await waitFor(() => screen.getByText("Live Mode"));
      fireEvent.click(screen.getByTestId("start-conductor"));
      expect(screen.getByTestId("now-playing")).toHaveTextContent("How Great");
    });

    it("displays Leading Session text in conductor mode", async () => {
      renderPage();
      await waitFor(() => screen.getByText("Live Mode"));
      fireEvent.click(screen.getByTestId("start-conductor"));
      expect(screen.getByText("Leading Session")).toBeInTheDocument();
    });

    it("displays Following Session text in member mode", async () => {
      renderPage();
      await waitFor(() => screen.getByText("Live Mode"));
      fireEvent.click(screen.getByTestId("join-member"));
      expect(screen.getByText("Following Session")).toBeInTheDocument();
    });

    it("shows Leave button in live mode", async () => {
      renderPage();
      await waitFor(() => screen.getByText("Live Mode"));
      fireEvent.click(screen.getByTestId("start-conductor"));
      expect(screen.getByTestId("leave-session")).toBeInTheDocument();
    });
  });

  // ===================== CONDUCTOR MODE =====================
  describe("conductor mode", () => {
    it("shows Go button on non-current songs", async () => {
      mockConductorState.currentSong = 0;
      renderPage();
      await waitFor(() => screen.getByText("Amazing Grace"));
      fireEvent.click(screen.getByTestId("start-conductor"));
      // The first song is current, so it should not have Go, but the second and third should
      const goButtons = screen.getAllByTitle("Navigate to this song");
      expect(goButtons.length).toBe(2); // song indices 1 and 2
    });

    it("shows Live indicator on current song", async () => {
      mockConductorState.currentSong = 0;
      renderPage();
      await waitFor(() => screen.getByText("Amazing Grace"));
      fireEvent.click(screen.getByTestId("start-conductor"));
      const liveSpans = screen.getAllByText("Live");
      expect(liveSpans.length).toBeGreaterThanOrEqual(1);
    });

    it("hides Go button and shows Live on current song row", async () => {
      mockConductorState.currentSong = 1;
      renderPage();
      await waitFor(() => screen.getByText("Amazing Grace"));
      fireEvent.click(screen.getByTestId("start-conductor"));
      // Should have Go buttons for songs 0 and 2 (not 1)
      const goButtons = screen.getAllByTitle("Navigate to this song");
      expect(goButtons.length).toBe(2);
    });
  });

  // ===================== MEMBER MODE =====================
  describe("member mode", () => {
    it("does not show Go buttons for members", async () => {
      renderPage();
      await waitFor(() => screen.getByText("Amazing Grace"));
      fireEvent.click(screen.getByTestId("join-member"));
      expect(screen.queryAllByTitle("Navigate to this song").length).toBe(0);
    });

    it("shows conductor left warning when conductor is null", async () => {
      mockConductorState.roomState.conductor = null;
      renderPage();
      await waitFor(() => screen.getByText("Live Mode"));
      fireEvent.click(screen.getByTestId("join-member"));
      expect(screen.getByTestId("conductor-left-warning")).toBeInTheDocument();
      expect(screen.getByTestId("conductor-left-warning")).toHaveTextContent(/conductor has left/i);
    });

    it("does not show conductor left warning when conductor is present", async () => {
      mockConductorState.roomState.conductor = { userId: "u1", displayName: "Leader" };
      renderPage();
      await waitFor(() => screen.getByText("Live Mode"));
      fireEvent.click(screen.getByTestId("join-member"));
      expect(screen.queryByTestId("conductor-left-warning")).not.toBeInTheDocument();
    });
  });

  // ===================== INTERACTIONS =====================
  describe("interactions", () => {
    it("clicking Leave calls leave() and returns to off mode", async () => {
      renderPage();
      await waitFor(() => screen.getByText("Live Mode"));
      fireEvent.click(screen.getByTestId("start-conductor"));
      expect(screen.getByText("Leading Session")).toBeInTheDocument();

      fireEvent.click(screen.getByTestId("leave-session"));
      expect(mockLeave).toHaveBeenCalled();
      // Should be back to off mode — Lead/Join buttons visible
      expect(screen.getByTestId("start-conductor")).toBeInTheDocument();
    });

    it("entering conductor mode hides Lead/Join buttons", async () => {
      renderPage();
      await waitFor(() => screen.getByTestId("start-conductor"));
      fireEvent.click(screen.getByTestId("start-conductor"));
      expect(screen.queryByTestId("start-conductor")).not.toBeInTheDocument();
      expect(screen.queryByTestId("join-member")).not.toBeInTheDocument();
    });

    it("entering member mode hides Lead/Join buttons", async () => {
      renderPage();
      await waitFor(() => screen.getByTestId("join-member"));
      fireEvent.click(screen.getByTestId("join-member"));
      expect(screen.queryByTestId("start-conductor")).not.toBeInTheDocument();
      expect(screen.queryByTestId("join-member")).not.toBeInTheDocument();
    });

    it("highlights current song row in live mode", async () => {
      mockConductorState.currentSong = 1;
      renderPage();
      await waitFor(() => screen.getByText("Amazing Grace"));
      fireEvent.click(screen.getByTestId("start-conductor"));
      const songItems = document.querySelectorAll("[data-song-index]");
      // Second song (index 1) should have highlight class
      expect(songItems[1].className).toContain("bg-[hsl(var(--secondary))]/10");
    });

    it("does not highlight songs in off mode", async () => {
      mockConductorState.currentSong = 0;
      renderPage();
      await waitFor(() => screen.getByText("Amazing Grace"));
      const songItems = document.querySelectorAll("[data-song-index]");
      expect(songItems[0].className).not.toContain("bg-[hsl(var(--secondary))]/10");
    });
  });

  // ===================== SOURCE-LEVEL =====================
  describe("source-level", () => {
    const pageSrc = fs.readFileSync(
      path.resolve(__dirname, "../pages/setlists/SetlistViewPage.tsx"),
      "utf-8",
    );
    const hookSrc = fs.readFileSync(
      path.resolve(__dirname, "../hooks/useConductor.ts"),
      "utf-8",
    );

    it("SetlistViewPage imports useConductor", () => {
      expect(pageSrc).toContain("useConductor");
    });

    it("SetlistViewPage has data-testid for connection-status", () => {
      expect(pageSrc).toContain('data-testid="connection-status"');
    });

    it("SetlistViewPage has data-testid for now-playing", () => {
      expect(pageSrc).toContain('data-testid="now-playing"');
    });

    it("useConductor exports goToSong and broadcastScroll", () => {
      expect(hookSrc).toContain("goToSong");
      expect(hookSrc).toContain("broadcastScroll");
    });

    it("useConductor handles disconnect event", () => {
      expect(hookSrc).toContain("disconnect");
    });
  });
});
