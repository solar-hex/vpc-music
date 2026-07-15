import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SongHistoryTab } from "@/pages/songs/SongHistoryTab";

// ---------- Mocks ----------
const mockGetSong = vi.fn();
const mockListHistory = vi.fn();
const mockListUsage = vi.fn();
const mockListSetlists = vi.fn();
const mockSongStats = vi.fn();

vi.mock("@/lib/api-client", () => ({
  songsApi: {
    get: (...args: any[]) => mockGetSong(...args),
    listSetlists: (...args: any[]) => mockListSetlists(...args),
  },
  songUsageApi: {
    list: (...args: any[]) => mockListUsage(...args),
  },
  songHistoryApi: {
    list: (...args: any[]) => mockListHistory(...args),
  },
  statsApi: {
    song: (...args: any[]) => mockSongStats(...args),
  },
}));

function renderTab(songId = "song-1") {
  return render(
    <MemoryRouter initialEntries={[`/songs/${songId}/history`]}>
      <Routes>
        <Route path="/songs/:id/history" element={<SongHistoryTab />} />
        <Route path="/songs/:id" element={<div>Song Detail</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const mockSong = {
  id: "song-1",
  title: "Amazing Grace",
  key: "G",
  tempo: 72,
  artist: "Newton",
  tags: "hymn",
  content: "[G]Amazing grace",
};

describe("Song history tab (play log + edit history)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
    mockListUsage.mockResolvedValue({ usages: [] });
    mockListSetlists.mockResolvedValue({ setlists: [] });
    mockListHistory.mockResolvedValue({ history: [] });
    mockSongStats.mockResolvedValue({ song: { id: "song-1", title: "Amazing Grace" }, playsByMonth: [], performances: [] });
  });

  // ===================== POSITIVE =====================

  describe("positive", () => {
    it("renders the Edit history section", async () => {
      mockListHistory.mockResolvedValue({
        history: [
          { id: "e1", songId: "song-1", editedBy: "u1", field: "key", oldValue: "C", newValue: "G", createdAt: "2025-06-01T12:00:00Z" },
        ],
      });
      renderTab();

      await waitFor(() => {
        expect(screen.getByText("Edit history")).toBeInTheDocument();
      });
    });

    it("lists each edit with its field badge", async () => {
      mockListHistory.mockResolvedValue({
        history: [
          { id: "e1", songId: "song-1", editedBy: "u1", field: "key", oldValue: "C", newValue: "G", createdAt: "2025-06-01T12:00:00Z" },
          { id: "e2", songId: "song-1", editedBy: "u1", field: "tempo", oldValue: "60", newValue: "72", createdAt: "2025-06-01T12:01:00Z" },
          { id: "e3", songId: "song-1", editedBy: "u1", field: "title", oldValue: "Grace", newValue: "Amazing Grace", createdAt: "2025-06-01T12:02:00Z" },
        ],
      });
      renderTab();

      await waitFor(() => {
        expect(screen.getByText("key")).toBeInTheDocument();
        expect(screen.getByText("tempo")).toBeInTheDocument();
        expect(screen.getByText("title")).toBeInTheDocument();
      });
    });

    it("shows old → new values for field changes", async () => {
      mockListHistory.mockResolvedValue({
        history: [
          { id: "e1", songId: "song-1", editedBy: "u1", field: "tempo", oldValue: "60", newValue: "72", createdAt: "2025-06-01T12:00:00Z" },
        ],
      });
      renderTab();

      await waitFor(() => {
        expect(screen.getByText(/60\s*→\s*72/)).toBeInTheDocument();
      });
    });

    it("shows the play log and stats from usages", async () => {
      mockListUsage.mockResolvedValue({
        usages: [
          { id: "u1", songId: "song-1", usedAt: "2025-05-04", notes: "Sunday service" },
          { id: "u2", songId: "song-1", usedAt: "2025-04-20", notes: null },
        ],
      });
      renderTab();

      await waitFor(() => {
        expect(screen.getByText("Times played")).toBeInTheDocument();
        expect(screen.getByText("2")).toBeInTheDocument();
        expect(screen.getByText("Sunday service")).toBeInTheDocument();
      });
    });

    it("links to setlists the song appears in", async () => {
      mockListSetlists.mockResolvedValue({
        setlists: [{ id: "sl-1", name: "Sunday Morning", status: "approved" }],
      });
      renderTab();

      await waitFor(() => {
        expect(screen.getByText("Sunday Morning")).toHaveAttribute("href", "/setlists/sl-1");
      });
    });
  });

  // ===================== NEGATIVE =====================

  describe("negative", () => {
    it("shows an empty state when there are no edits", async () => {
      renderTab();

      await waitFor(() => {
        expect(screen.getByText("No edits recorded yet.")).toBeInTheDocument();
      });
    });

    it("handles history API failure gracefully", async () => {
      mockListHistory.mockRejectedValue(new Error("Server error"));
      renderTab();

      // Tab should still render without crashing
      await waitFor(() => {
        expect(screen.getByText("Edit history")).toBeInTheDocument();
        expect(screen.getByText("No edits recorded yet.")).toBeInTheDocument();
      });
    });

    it("shows a play-log empty state when never played", async () => {
      renderTab();

      await waitFor(() => {
        expect(screen.getByText(/Plays are logged when an event/)).toBeInTheDocument();
        expect(screen.getByText("Never")).toBeInTheDocument();
      });
    });
  });
});
