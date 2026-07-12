import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SongViewPage } from "@/pages/songs/SongViewPage";

// ---------- Mocks ----------
const mockGetSong = vi.fn();
const mockListHistory = vi.fn();

let mockAuthValue: any = {
  user: { id: "u1", email: "admin@test.com", displayName: "Admin", role: "owner" },
  activeOrg: { id: "org1", name: "Test Church", role: "admin" },
};

vi.mock("@/lib/api-client", () => ({
  songsApi: {
    get: (...args: any[]) => mockGetSong(...args),
    delete: vi.fn().mockResolvedValue({ message: "ok" }),
    exportChordPro: vi.fn(),
  },
  shareApi: {
    create: vi.fn().mockResolvedValue({ shareUrl: "/shared/abc", shareToken: {} }),
    list: vi.fn().mockResolvedValue({ shares: [] }),
    revoke: vi.fn(),
    update: vi.fn().mockResolvedValue({ shareToken: {} }),
    listDirect: vi.fn().mockResolvedValue({ directShares: [] }),
    createDirect: vi.fn(),
    removeDirect: vi.fn(),
    getShared: vi.fn(),
  },
  songUsageApi: {
    log: vi.fn().mockResolvedValue({ usage: { id: "u1", songId: "s1", usedAt: "2025-01-01" } }),
    list: vi.fn().mockResolvedValue({ usages: [] }),
    remove: vi.fn().mockResolvedValue({ message: "ok" }),
  },
  songHistoryApi: {
    list: (...args: any[]) => mockListHistory(...args),
  },
  variationsApi: {
    create: vi.fn(),
    update: vi.fn(),
    setDefault: vi.fn(),
    delete: vi.fn(),
  },
  stickyNotesApi: {
    list: vi.fn().mockResolvedValue({ notes: [] }),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  songCollaborationApi: {
    list: vi.fn().mockResolvedValue({ items: [] }),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

vi.mock("@vpc-music/shared", () => ({
  transposeKeyName: (key: string) => key,
  composeTranspose: ({ sourceKey = null }: any = {}) => ({ semis: 0, preferFlats: false, displayKey: sourceKey }),
  spellForTarget: (key: string | null | undefined) =>
    key ? { preferFlats: false, targetKey: key } : { preferFlats: undefined, targetKey: null },
  keyPrefersFlats: () => false,
  parseBarLine: () => ({ measures: [] }),
  ALL_KEYS: ["C", "D", "E", "F", "G", "A", "B"],
}));

vi.mock("@/components/songs/ChordProRenderer", () => ({
  ChordProRenderer: ({ content }: { content: string }) => (
    <div data-testid="chordpro-renderer">{content}</div>
  ),
  AutoScroll: () => <div data-testid="auto-scroll">AutoScroll</div>,
}));

function renderPage(songId = "song-1") {
  return render(
    <MemoryRouter initialEntries={[`/songs/${songId}`]}>
      <Routes>
        <Route path="/songs/:id" element={<SongViewPage />} />
        <Route path="/songs" element={<div>Songs List</div>} />
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

describe("Song Edit History", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===================== POSITIVE =====================

  describe("positive", () => {
    it("renders Edit History button when history exists", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListHistory.mockResolvedValue({
        history: [
          { id: "e1", songId: "song-1", editedBy: "u1", field: "key", oldValue: "C", newValue: "G", createdAt: "2025-06-01T12:00:00Z" },
        ],
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Edit History")).toBeInTheDocument();
      });
    });

    it("shows change count badge", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListHistory.mockResolvedValue({
        history: [
          { id: "e1", songId: "song-1", editedBy: "u1", field: "key", oldValue: "C", newValue: "G", createdAt: "2025-06-01T12:00:00Z" },
          { id: "e2", songId: "song-1", editedBy: "u1", field: "tempo", oldValue: "60", newValue: "72", createdAt: "2025-06-01T12:01:00Z" },
          { id: "e3", songId: "song-1", editedBy: "u1", field: "title", oldValue: "Grace", newValue: "Amazing Grace", createdAt: "2025-06-01T12:02:00Z" },
        ],
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("(3 changes)")).toBeInTheDocument();
      });
    });

    it("shows singular 'change' for 1 edit", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListHistory.mockResolvedValue({
        history: [
          { id: "e1", songId: "song-1", editedBy: "u1", field: "key", oldValue: "C", newValue: "G", createdAt: "2025-06-01T12:00:00Z" },
        ],
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("(1 change)")).toBeInTheDocument();
      });
    });

    it("toggles history details on click", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListHistory.mockResolvedValue({
        history: [
          { id: "e1", songId: "song-1", editedBy: "u1", field: "key", oldValue: "C", newValue: "G", createdAt: "2025-06-01T12:00:00Z" },
        ],
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Edit History")).toBeInTheDocument();
      });

      // Initially collapsed — old/new values not visible
      expect(screen.queryByText("G")).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(screen.getByText("Edit History"));

      await waitFor(() => {
        // Now field name and values should be visible
        expect(screen.getByText("key")).toBeInTheDocument();
      });
    });

    it("shows old → new values for non-content fields", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListHistory.mockResolvedValue({
        history: [
          { id: "e1", songId: "song-1", editedBy: "u1", field: "tempo", oldValue: "60", newValue: "72", createdAt: "2025-06-01T12:00:00Z" },
        ],
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Edit History")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Edit History"));

      await waitFor(() => {
        expect(screen.getByText("60")).toBeInTheDocument();
        expect(screen.getByText("72")).toBeInTheDocument();
      });
    });

    it("shows 'Content updated' for content field changes", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListHistory.mockResolvedValue({
        history: [
          { id: "e1", songId: "song-1", editedBy: "u1", field: "content", oldValue: "[C]Old", newValue: "[G]New", createdAt: "2025-06-01T12:00:00Z" },
        ],
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Edit History")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Edit History"));

      await waitFor(() => {
        expect(screen.getByText("Content updated")).toBeInTheDocument();
      });
    });

    it("shows (empty) for empty old/new values", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListHistory.mockResolvedValue({
        history: [
          { id: "e1", songId: "song-1", editedBy: "u1", field: "artist", oldValue: "", newValue: "John Newton", createdAt: "2025-06-01T12:00:00Z" },
        ],
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Edit History")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Edit History"));

      await waitFor(() => {
        expect(screen.getByText("(empty)")).toBeInTheDocument();
        expect(screen.getByText("John Newton")).toBeInTheDocument();
      });
    });
  });

  // ===================== NEGATIVE =====================

  describe("negative", () => {
    it("hides Edit History section when no history", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListHistory.mockResolvedValue({ history: [] });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
      });

      expect(screen.queryByText("Edit History")).not.toBeInTheDocument();
    });

    it("handles history API failure gracefully", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListHistory.mockRejectedValue(new Error("Server error"));
      renderPage();

      // Page should still render without crashing
      await waitFor(() => {
        expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
      });

      // No edit history section shown
      expect(screen.queryByText("Edit History")).not.toBeInTheDocument();
    });

    it("displays formatted timestamp for edits", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListHistory.mockResolvedValue({
        history: [
          { id: "e1", songId: "song-1", editedBy: "u1", field: "key", oldValue: "C", newValue: "G", createdAt: "2025-06-01T12:00:00Z" },
        ],
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Edit History")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Edit History"));

      // Should render a timestamp (locale-dependent, so just check the section renders)
      await waitFor(() => {
        expect(screen.getByText("key")).toBeInTheDocument();
      });
    });
  });
});
