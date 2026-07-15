import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SongViewPage } from "@/pages/songs/SongViewPage";

vi.mock("@/components/songs/SongCollaborationPanel", () => ({
  SongCollaborationPanel: () => <div data-testid="song-collaboration-panel" />,
}));

// ---------- Mocks ----------
const mockGet = vi.fn();
const mockDelete = vi.fn();
const mockExportChordPro = vi.fn();
const mockListSetlists = vi.fn();
const mockAddToSetlist = vi.fn();
const mockSetDefaultVariation = vi.fn();
const mockNavigate = vi.fn();
const mockLoadCachedSong = vi.fn();
const mockSaveCachedSong = vi.fn();
const mockIsOfflineRequestError = vi.fn();

let mockAuthValue: any = {
  user: { id: "u1", email: "admin@test.com", displayName: "Admin", role: "owner" },
  activeOrg: { id: "org1", name: "Test Church", role: "admin" },
};

vi.mock("@/lib/api-client", () => ({
  annotationsApi: {
    get: vi.fn().mockResolvedValue({ annotation: null }),
    save: vi.fn().mockResolvedValue({ annotation: { id: "a1", data: [] } }),
  },
  songsApi: {
    get: (...args: any[]) => mockGet(...args),
    delete: (...args: any[]) => mockDelete(...args),
    exportChordPro: (...args: any[]) => mockExportChordPro(...args),
  },
  setlistsApi: {
    list: (...args: any[]) => mockListSetlists(...args),
    addSong: (...args: any[]) => mockAddToSetlist(...args),
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
    log: vi.fn().mockResolvedValue({ usage: { id: "u1", songId: "song-1", usedAt: "2025-01-01" } }),
    list: vi.fn().mockResolvedValue({ usages: [] }),
    remove: vi.fn().mockResolvedValue({ message: "ok" }),
  },
  songHistoryApi: {
    list: vi.fn().mockResolvedValue({ history: [] }),
  },
  variationsApi: {
    create: vi.fn().mockResolvedValue({ variation: { id: "v1", songId: "song-1", name: "Acoustic", content: "[C]New", key: "C" } }),
    update: vi.fn().mockResolvedValue({ variation: { id: "v1", songId: "song-1", name: "Updated", content: "[D]Updated", key: "D" } }),
    setDefault: (...args: any[]) => mockSetDefaultVariation(...args),
    delete: vi.fn().mockResolvedValue({ message: "ok" }),
  },
  stickyNotesApi: {
    list: vi.fn().mockResolvedValue({ notes: [] }),
    create: vi.fn().mockResolvedValue({ note: { id: "n1", songId: "song-1", content: "Test", color: "yellow" } }),
    update: vi.fn().mockResolvedValue({ note: { id: "n1", songId: "song-1", content: "Updated", color: "blue" } }),
    delete: vi.fn().mockResolvedValue({ message: "ok" }),
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
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

vi.mock("@/lib/offline-cache", () => ({
  loadCachedSong: (...args: any[]) => mockLoadCachedSong(...args),
  saveCachedSong: (...args: any[]) => mockSaveCachedSong(...args),
  isOfflineRequestError: (...args: any[]) => mockIsOfflineRequestError(...args),
}));

// Minimal mock for ChordProRenderer
vi.mock("@/components/songs/ChordProRenderer", () => ({
  ChordProRenderer: ({ content, songKey, baseTranspose }: { content: string; songKey?: string | null; baseTranspose?: number }) => (
    <div
      data-testid="chordpro-renderer"
      data-song-key={songKey ?? ""}
      data-base-transpose={String(baseTranspose ?? 0)}
    >
      {content}
    </div>
  ),
  AutoScroll: () => <div data-testid="auto-scroll">AutoScroll</div>,
}));

function renderPage(songId = "song-1", search = "") {
  return render(
    <MemoryRouter initialEntries={[`/songs/${songId}${search}`]}>
      <Routes>
        <Route path="/songs/:id" element={<SongViewPage />} />
        <Route path="/songs" element={<div>Songs List</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SongViewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthValue = {
      user: { id: "u1", email: "admin@test.com", displayName: "Admin", role: "owner" },
      activeOrg: { id: "org1", name: "Test Church", role: "admin" },
    };
    mockSetDefaultVariation.mockResolvedValue({
      song: {
        id: "song-1",
        title: "Amazing Grace",
        key: "G",
        tempo: 72,
        artist: "Newton",
        tags: "hymn",
        content: "[G]Amazing grace",
        defaultVariationId: "v1",
      },
    });
    mockListSetlists.mockResolvedValue({ setlists: [{ id: "sl-1", name: "Sunday Service", category: "worship", songCount: 4 }] });
    mockAddToSetlist.mockResolvedValue({ item: { id: "item-1", songId: "song-1", position: 0 } });
    mockLoadCachedSong.mockReturnValue(null);
    mockIsOfflineRequestError.mockReturnValue(false);
  });

  // ===================== POSITIVE =====================

  describe("positive", () => {
    const mockSong = {
      id: "song-1",
      title: "Amazing Grace",
      aka: "Grace Song, Old Hymn",
      category: "Church",
      key: "G",
      tempo: 72,
      artist: "Newton",
      shout: "Choir echoes",
      tags: "hymn",
      content: "[G]Amazing grace",
    };

    it("renders song title and metadata", async () => {
      mockGet.mockResolvedValue({ song: mockSong, variations: [] });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
        expect(screen.getByText("Newton")).toBeInTheDocument();
        expect(screen.getByText("Category: Church")).toBeInTheDocument();
        expect(screen.getByText("AKA: Grace Song, Old Hymn")).toBeInTheDocument();
        expect(screen.getByText("Shout: Choir echoes")).toBeInTheDocument();
        expect(screen.getByText("Key: G")).toBeInTheDocument();
        expect(screen.getByText("72 BPM")).toBeInTheDocument();
        expect(screen.getByLabelText("Tempo 72 BPM")).toBeInTheDocument();
        expect(screen.getByText("hymn")).toBeInTheDocument();
      });
    });

    it("renders ChordPro content", async () => {
      mockGet.mockResolvedValue({ song: mockSong, variations: [] });
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId("chordpro-renderer")).toHaveTextContent("[G]Amazing grace");
      });
    });

    it("uses the carried search key as the displayed key", async () => {
      mockGet.mockResolvedValue({ song: mockSong, variations: [] });
      renderPage("song-1", "?key=A");

      await waitFor(() => {
        expect(screen.getByText("Key: A")).toBeInTheDocument();
        expect(screen.getByTestId("chordpro-renderer")).toHaveAttribute("data-song-key", "G");
        expect(screen.getByTestId("chordpro-renderer")).toHaveAttribute("data-base-transpose", "2");
      });
    });

    it("renders toolbar controls", async () => {
      mockGet.mockResolvedValue({ song: mockSong, variations: [] });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Edit")).toBeInTheDocument();
        expect(screen.getByText("Chords")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /more actions/i })).toBeInTheDocument();
      });
      // Secondary actions live inside the More overflow menu
      fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
      expect(screen.getByText("Add to Setlist")).toBeInTheDocument();
      expect(screen.getByText("Print")).toBeInTheDocument();
      expect(screen.getByText("Delete")).toBeInTheDocument();
      expect(screen.getByText("ChordPro (.cho)")).toBeInTheDocument();
    });

    it("adds the selected variation to a setlist with variation context", async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue({
        song: mockSong,
        variations: [{ id: "v1", songId: "song-1", name: "Acoustic", content: "[C]Amazing grace", key: "C" }],
      });
      renderPage();

      await user.click(await screen.findByRole("button", { name: /acoustic/i }));
      await user.click(screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /add to setlist/i }));
      await user.click(await screen.findByRole("button", { name: /sunday service/i }));

      await waitFor(() => {
        expect(mockAddToSetlist).toHaveBeenCalledWith("sl-1", {
          songId: "song-1",
          variationId: "v1",
          key: "C",
          notes: "Variation: Acoustic",
        });
      });
    });

    it("has back link to songs", async () => {
      mockGet.mockResolvedValue({ song: mockSong, variations: [] });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Songs")).toHaveAttribute("href", "/songs");
      });
    });

    it("has edit link to song edit page", async () => {
      mockGet.mockResolvedValue({ song: mockSong, variations: [] });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Edit").closest("a")).toHaveAttribute("href", "/songs/song-1/edit");
      });
    });

    it("includes the selected variation in the edit link", async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue({
        song: mockSong,
        variations: [{ id: "v1", songId: "song-1", name: "Acoustic", content: "[C]Amazing grace", key: "C" }],
      });
      renderPage();

      await user.click(await screen.findByRole("button", { name: /acoustic/i }));

      await waitFor(() => {
        expect(screen.getByText("Edit").closest("a")).toHaveAttribute("href", "/songs/song-1/edit?variation=v1");
      });
    });

    it("uses the song default variation when none is explicitly selected", async () => {
      mockGet.mockResolvedValue({
        song: { ...mockSong, defaultVariationId: "v1" },
        variations: [{ id: "v1", songId: "song-1", name: "Acoustic", content: "[C]Amazing grace", key: "C" }],
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/default view/i)).toBeInTheDocument();
        expect(screen.getByTestId("chordpro-renderer")).toHaveTextContent("[C]Amazing grace");
        expect(screen.getByText("Edit").closest("a")).toHaveAttribute("href", "/songs/song-1/edit?variation=v1");
      });
    });

    it("lets admins set the selected variation as default", async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue({
        song: mockSong,
        variations: [{ id: "v1", songId: "song-1", name: "Acoustic", content: "[C]Amazing grace", key: "C" }],
      });
      renderPage();

      await user.click(await screen.findByRole("button", { name: /acoustic/i }));
      await user.click(screen.getByRole("button", { name: /make selected variation default/i }));

      await waitFor(() => {
        expect(mockSetDefaultVariation).toHaveBeenCalledWith("song-1", "v1");
      });
    });

    it("opens the full page editor when clicking the variation pencil icon", async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue({
        song: mockSong,
        variations: [{ id: "v1", songId: "song-1", name: "Acoustic", content: "[C]Amazing grace", key: "C" }],
      });
      renderPage();

      await user.click(await screen.findByTitle("Open full variation editor"));

      expect(mockNavigate).toHaveBeenCalledWith("/songs/song-1/edit?variation=v1");
    });

    it("does not show default controls for observers", async () => {
      mockAuthValue = {
        user: { id: "u2", email: "observer@test.com", displayName: "Observer", role: "member" },
        activeOrg: { id: "org1", name: "Test Church", role: "observer" },
      };
      mockGet.mockResolvedValue({
        song: { ...mockSong, defaultVariationId: "v1" },
        variations: [{ id: "v1", songId: "song-1", name: "Acoustic", content: "[C]Amazing grace", key: "C" }],
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/default view/i)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /make selected variation default/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /use original as default/i })).not.toBeInTheDocument();
      });
    });

    it("renders font size selector", async () => {
      mockGet.mockResolvedValue({ song: mockSong, variations: [] });
      renderPage();
      await waitFor(() => {
        const select = screen.getByTitle("Font size");
        expect(select).toBeInTheDocument();
      });
    });

    it("renders auto-scroll component", async () => {
      mockGet.mockResolvedValue({ song: mockSong, variations: [] });
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId("auto-scroll")).toBeInTheDocument();
      });
    });
  });

  // ===================== NEGATIVE =====================

  describe("negative", () => {
    it("shows loading spinner initially", () => {
      mockGet.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(document.querySelector(".spinner")).toBeInTheDocument();
    });

    it("shows not found when song doesn't exist", async () => {
      mockGet.mockRejectedValue(new Error("Not found"));
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Song not found.")).toBeInTheDocument();
      });
    });

    it("has link back to songs from not-found state", async () => {
      mockGet.mockRejectedValue(new Error("Not found"));
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Back to songs")).toHaveAttribute("href", "/songs");
      });
    });

    it("falls back to a cached song when offline", async () => {
      mockGet.mockRejectedValue(new Error("Failed to fetch"));
      mockIsOfflineRequestError.mockReturnValue(true);
      mockLoadCachedSong.mockReturnValue({
        id: "song-1",
        response: {
          song: { id: "song-1", title: "Cached Song", content: "[C]Cached", key: "C", tempo: 70, artist: "Offline" },
          variations: [],
        },
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Cached Song")).toBeInTheDocument();
      });
    });

    it("calls delete API and navigates on modal confirmation", async () => {
      const mockSong = { id: "song-1", title: "X", content: "", key: null, tempo: null, artist: null, tags: null };
      mockGet.mockResolvedValue({ song: mockSong, variations: [] });
      mockDelete.mockResolvedValue({ message: "ok" });
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /more actions/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
      fireEvent.click(screen.getByRole("menuitem", { name: /delete/i }));
      fireEvent.click(screen.getByRole("button", { name: /delete song/i }));

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith("song-1");
        expect(mockNavigate).toHaveBeenCalledWith("/songs");
      });
    });

    it("shows error toast on delete failure", async () => {
      const { toast } = await import("sonner");
      const mockSong = { id: "song-1", title: "X", content: "", key: null, tempo: null, artist: null, tags: null };
      mockGet.mockResolvedValue({ song: mockSong, variations: [] });
      mockDelete.mockRejectedValue(new Error("Unauthorized"));
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /more actions/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
      fireEvent.click(screen.getByRole("menuitem", { name: /delete/i }));
      fireEvent.click(screen.getByRole("button", { name: /delete song/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Unauthorized");
      });
    });
  });
});
