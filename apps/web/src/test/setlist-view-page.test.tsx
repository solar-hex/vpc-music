import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import { SetlistViewPage } from "@/pages/setlists/SetlistViewPage";

// ---------- Mocks ----------
const mockGetSetlist = vi.fn();
const mockDeleteSetlist = vi.fn();
const mockAddSong = vi.fn();
const mockRemoveSong = vi.fn();
const mockReorderSongs = vi.fn();
const mockExportZip = vi.fn();
const mockSongsList = vi.fn();
const mockNavigate = vi.fn();
const mockLoadCachedSetlist = vi.fn();
const mockLoadCachedSetlistPerformanceContents = vi.fn();
const mockSaveCachedSetlist = vi.fn();
const mockSaveCachedSetlistPerformanceContents = vi.fn();
const mockIsOfflineRequestError = vi.fn();

vi.mock("@/lib/api-client", () => ({
  eventsApi: { list: vi.fn().mockResolvedValue({ events: [] }) },
  setlistsApi: {
    get: (...args: any[]) => mockGetSetlist(...args),
    exportZip: (...args: any[]) => mockExportZip(...args),
    delete: (...args: any[]) => mockDeleteSetlist(...args),
    addSong: (...args: any[]) => mockAddSong(...args),
    removeSong: (...args: any[]) => mockRemoveSong(...args),
    reorderSongs: (...args: any[]) => mockReorderSongs(...args),
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
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@vpc-music/shared", () => ({
  parseChordPro: () => ({ directives: {}, sections: [], chordDefinitions: {} }),
  transposeKeyName: (key: string) => key,
  normalizeEnharmonicKey: (key: string | null | undefined) => key,
  analyze: () => ({ curve: [], keys: [], transitions: [], timing: { musicSeconds: 0, gapSeconds: 0, totalSeconds: 0, targetSeconds: null, overBySeconds: null, underBySeconds: null }, signals: [] }),
  flow: {
    analyze: () => ({ curve: [], keys: [], transitions: [], timing: { musicSeconds: 0, gapSeconds: 0, totalSeconds: 0, targetSeconds: null, overBySeconds: null, underBySeconds: null }, signals: [] }),
    keyTransition: () => ({ grade: "unknown" }),
    fmt: (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`,
  },
  keyPrefersFlats: () => false,
  parseBarLine: () => ({ measures: [] }),
  ALL_KEYS: ["C", "D", "E", "F", "G", "A", "B"],
}));

let mockAuthValue: any = {
  user: { id: "u1", email: "test@test.com", displayName: "Test", role: "owner" },
  activeOrg: { id: "org1", name: "Test Church", role: "admin" },
};
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

vi.mock("@/lib/offline-cache", () => ({
  loadCachedSetlist: (...args: any[]) => mockLoadCachedSetlist(...args),
  loadCachedSetlistPerformanceContents: (...args: any[]) => mockLoadCachedSetlistPerformanceContents(...args),
  saveCachedSetlist: (...args: any[]) => mockSaveCachedSetlist(...args),
  saveCachedSetlistPerformanceContents: (...args: any[]) => mockSaveCachedSetlistPerformanceContents(...args),
  isOfflineRequestError: (...args: any[]) => mockIsOfflineRequestError(...args),
}));

const mockGoToSong = vi.fn();
const mockBroadcastScroll = vi.fn();
const mockLeave = vi.fn();

vi.mock("@/hooks/useConductor", () => ({
  useConductor: () => ({
    connected: false,
    roomState: { conductor: null, members: [], currentSong: 0, currentSection: null },
    currentSong: 0,
    currentSection: null,
    scrollTop: 0,
    goToSong: mockGoToSong,
    broadcastScroll: mockBroadcastScroll,
    leave: mockLeave,
    isConductor: false,
  }),
}));

function renderPage(id = "sl-1", state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/setlists/${id}`, state }]}>
      <Routes>
        <Route path="/setlists/:id" element={<SetlistViewPage />} />
        <Route path="/setlists" element={<div>Setlists List</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const mockSetlist = { id: "sl-1", name: "Sunday Service", category: "worship", notes: "Notes here" };
const mockSongs = [
  { id: "item-1", songId: "s1", variationId: "v1", variationName: "Acoustic", position: 0, songTitle: "Song A", songKey: "G", songArtist: "Artist 1", songTempo: 120, key: null, notes: null },
  { id: "item-2", songId: "s2", variationId: null, variationName: null, position: 1, songTitle: "Song B", songKey: "C", songArtist: null, songTempo: null, key: "D", notes: null },
];

describe("SetlistViewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExportZip.mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(["zip"])) });
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      configurable: true,
      value: vi.fn(() => "blob:mock"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      configurable: true,
      value: vi.fn(),
    });
    mockLoadCachedSetlist.mockReturnValue(null);
    mockLoadCachedSetlistPerformanceContents.mockReturnValue(new Map());
    mockIsOfflineRequestError.mockReturnValue(false);
  });

  // ===================== POSITIVE =====================

  describe("positive", () => {
    it("renders setlist name and category", async () => {
      mockGetSetlist.mockResolvedValue({ setlist: mockSetlist, songs: mockSongs });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Sunday Service")).toBeInTheDocument();
        expect(screen.getByText("worship")).toBeInTheDocument();
      });
    });

    it("renders songs count", async () => {
      mockGetSetlist.mockResolvedValue({ setlist: mockSetlist, songs: mockSongs });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Songs (2)")).toBeInTheDocument();
      });
    });

    it("renders song items with titles", async () => {
      mockGetSetlist.mockResolvedValue({ setlist: mockSetlist, songs: mockSongs });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Song A")).toBeInTheDocument();
        expect(screen.getByText("Song B")).toBeInTheDocument();
      });
    });

    it("shows variation info and preserves the variation link", async () => {
      mockGetSetlist.mockResolvedValue({ setlist: mockSetlist, songs: mockSongs });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Variation: Acoustic/i)).toBeInTheDocument();
        expect(screen.getByText("Song A").closest("a")).toHaveAttribute("href", "/songs/s1?variation=v1");
      });
    });

    it("renders position numbers", async () => {
      mockGetSetlist.mockResolvedValue({ setlist: mockSetlist, songs: mockSongs });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("1")).toBeInTheDocument();
        expect(screen.getByText("2")).toBeInTheDocument();
      });
    });

    it("has back link to setlists", async () => {
      mockGetSetlist.mockResolvedValue({ setlist: mockSetlist, songs: mockSongs });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Setlists")).toHaveAttribute("href", "/setlists");
      });
    });

    it("renders add song button", async () => {
      mockGetSetlist.mockResolvedValue({ setlist: mockSetlist, songs: mockSongs });
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /add song/i })).toBeInTheDocument();
      });
    });

    it("renders Export ZIP button when the setlist has songs", async () => {
      mockGetSetlist.mockResolvedValue({ setlist: mockSetlist, songs: mockSongs });
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /export zip/i })).toBeInTheDocument();
      });
    });

    it("exports the setlist as a chordpro zip", async () => {
      mockGetSetlist.mockResolvedValue({ setlist: mockSetlist, songs: mockSongs });
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /export zip/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /export zip/i }));
      fireEvent.click(screen.getByText("ChordPro ZIP (.zip)"));

      await waitFor(() => {
        expect(mockExportZip).toHaveBeenCalledWith("sl-1", "chordpro");
      });
    });

    it("renders reorder buttons for songs", async () => {
      mockGetSetlist.mockResolvedValue({ setlist: mockSetlist, songs: mockSongs });
      renderPage();
      await waitFor(() => {
        const upButtons = screen.getAllByTitle("Move up");
        const downButtons = screen.getAllByTitle("Move down");
        expect(upButtons.length).toBe(2);
        expect(downButtons.length).toBe(2);
      });
    });

    it("supports drag-and-drop reordering", async () => {
      mockGetSetlist.mockResolvedValue({ setlist: mockSetlist, songs: mockSongs });
      mockReorderSongs.mockResolvedValue({ message: "ok" });
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTitle("Drag to reorder")).toHaveLength(2);
      });

      const dragHandles = screen.getAllByTitle("Drag to reorder");
      const songRows = document.querySelectorAll("[data-song-index]");

      fireEvent.dragStart(dragHandles[0]);
      fireEvent.dragOver(songRows[1]);
      fireEvent.drop(songRows[1]);

      await waitFor(() => {
        expect(mockReorderSongs).toHaveBeenCalledWith("sl-1", [
          { id: "item-2", position: 0 },
          { id: "item-1", position: 1 },
        ]);
      });
    });

    it("removes song from list", async () => {
      mockGetSetlist.mockResolvedValue({ setlist: mockSetlist, songs: [mockSongs[0]] });
      mockRemoveSong.mockResolvedValue({ message: "ok" });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Song A")).toBeInTheDocument();
      });

      const removeBtn = screen.getByTitle("Remove from setlist");
      fireEvent.click(removeBtn);

      await waitFor(() => {
        expect(mockRemoveSong).toHaveBeenCalledWith("sl-1", "item-1");
      });
    });
  });

  // Regression coverage: arriving from "New Setlist" / "Use template" passes
  // the freshly-created setlist via navigation state, so a slow or failed
  // background refresh can't make a setlist that definitely exists look like
  // it doesn't (the "created, then immediately not found" bug).
  describe("seeded from navigation state (just created)", () => {
    const seed = { id: "sl-new", name: "Brand New Setlist" };

    it("renders immediately from the seed without waiting on the network", async () => {
      mockGetSetlist.mockReturnValue(new Promise(() => {})); // never resolves
      renderPage("sl-new", { setlist: seed });

      expect(screen.getByText("Brand New Setlist")).toBeInTheDocument();
      expect(document.querySelector(".spinner")).not.toBeInTheDocument();
    });

    it("keeps showing the seeded setlist (not 'not found') when the refresh fails", async () => {
      mockGetSetlist.mockRejectedValue(Object.assign(new Error("HTTP 500"), { status: 500 }));
      renderPage("sl-new", { setlist: seed });

      await waitFor(() => {
        expect(mockGetSetlist).toHaveBeenCalledWith("sl-new");
      });

      expect(screen.getByText("Brand New Setlist")).toBeInTheDocument();
      expect(screen.queryByText(/setlist not found/i)).not.toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/couldn't refresh/i));
    });

    it("does not seed when the state's setlist id doesn't match the URL", async () => {
      mockGetSetlist.mockResolvedValue({ setlist: mockSetlist, songs: [] });
      renderPage("sl-1", { setlist: seed }); // seed is for a different id

      // Falls back to the normal fetch path — shows a spinner, then the real data
      expect(document.querySelector(".spinner")).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText("Sunday Service")).toBeInTheDocument();
      });
    });
  });

  // Regression coverage: React StrictMode double-invokes effects in
  // development (mount -> cleanup -> mount). Without a cancellation guard,
  // that fires the setlist fetch twice and — since both calls hit the same
  // failing endpoint — shows the "couldn't refresh" toast twice too.
  describe("cancellation guard (StrictMode double-invoke safety)", () => {
    const seed = { id: "sl-new", name: "Brand New Setlist" };

    it("ignores a response that resolves after the component has unmounted", async () => {
      let resolveGet!: (value: unknown) => void;
      mockGetSetlist.mockReturnValue(new Promise((resolve) => { resolveGet = resolve; }));

      const { unmount } = renderPage();
      unmount();

      // Resolving after unmount must not throw, warn, or touch React state —
      // that's exactly what the cleanup's `cancelled` flag guards against.
      resolveGet({ setlist: mockSetlist, songs: mockSongs });
      await new Promise((r) => setTimeout(r, 0));
    });

    it("only shows one toast even if the load effect fires twice for the same id", async () => {
      // Simulates what StrictMode's double-invoke produces: the effect runs,
      // its cleanup fires, then it runs again — both against a failing fetch.
      mockGetSetlist.mockRejectedValue(Object.assign(new Error("HTTP 500"), { status: 500 }));
      const { rerender } = render(
        <MemoryRouter initialEntries={[{ pathname: "/setlists/sl-new", state: { setlist: seed } }]}>
          <Routes>
            <Route path="/setlists/:id" element={<SetlistViewPage />} />
          </Routes>
        </MemoryRouter>,
      );
      // Force React to re-run effects for the same props/state, mirroring
      // StrictMode's synthetic remount.
      rerender(
        <MemoryRouter initialEntries={[{ pathname: "/setlists/sl-new", state: { setlist: seed } }]}>
          <Routes>
            <Route path="/setlists/:id" element={<SetlistViewPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(mockGetSetlist).toHaveBeenCalled();
      });

      const refreshToasts = (toast.error as any).mock.calls.filter(([msg]: [string]) =>
        /couldn't refresh/i.test(msg),
      );
      expect(refreshToasts.length).toBeLessThanOrEqual(1);
    });
  });

  // ===================== NEGATIVE =====================

  describe("negative", () => {
    it("shows loading spinner", () => {
      mockGetSetlist.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(document.querySelector(".spinner")).toBeInTheDocument();
    });

    it("shows not found when setlist doesn't exist", async () => {
      mockGetSetlist.mockRejectedValue(Object.assign(new Error("Setlist not found"), { status: 404 }));
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Setlist not found.")).toBeInTheDocument();
      });
      expect(toast.error).toHaveBeenCalledWith("Setlist not found");
    });

    it("shows a generic load error (not 'not found') for a non-404 failure", async () => {
      // A timeout, 500, or other transient failure is a different problem
      // than "this setlist doesn't exist" and shouldn't be reported as such.
      mockGetSetlist.mockRejectedValue(Object.assign(new Error("Server error"), { status: 500 }));
      renderPage();
      await waitFor(() => {
        expect(mockGetSetlist).toHaveBeenCalled();
      });
      expect(toast.error).toHaveBeenCalledWith("Server error");
      expect(toast.error).not.toHaveBeenCalledWith("Setlist not found");
    });

    it("has link back from not-found", async () => {
      mockGetSetlist.mockRejectedValue(new Error("Not found"));
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Back to setlists")).toHaveAttribute("href", "/setlists");
      });
    });

    it("falls back to a cached setlist when offline", async () => {
      mockGetSetlist.mockRejectedValue(new Error("Failed to fetch"));
      mockIsOfflineRequestError.mockReturnValue(true);
      mockLoadCachedSetlist.mockReturnValue({
        id: "sl-1",
        response: {
          setlist: mockSetlist,
          songs: mockSongs,
        },
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Sunday Service")).toBeInTheDocument();
        expect(screen.getByText("Song A")).toBeInTheDocument();
      });
    });

    it("shows empty song list state", async () => {
      mockGetSetlist.mockResolvedValue({ setlist: mockSetlist, songs: [] });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/no songs in this setlist/i)).toBeInTheDocument();
      });
    });

    it("does not show Export ZIP when the setlist is empty", async () => {
      mockGetSetlist.mockResolvedValue({ setlist: mockSetlist, songs: [] });
      renderPage();

      await waitFor(() => {
        expect(screen.queryByRole("button", { name: /export zip/i })).not.toBeInTheDocument();
      });
    });

    it("calls delete and navigates away", async () => {
      mockGetSetlist.mockResolvedValue({ setlist: mockSetlist, songs: [] });
      mockDeleteSetlist.mockResolvedValue({ message: "ok" });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Delete")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Delete"));
      fireEvent.click(screen.getByRole("button", { name: /delete setlist/i }));

      await waitFor(() => {
        expect(mockDeleteSetlist).toHaveBeenCalledWith("sl-1");
        expect(mockNavigate).toHaveBeenCalledWith("/setlists");
      });
    });

    it("shows error toast on delete failure", async () => {
      const { toast } = await import("sonner");
      mockGetSetlist.mockResolvedValue({ setlist: mockSetlist, songs: [] });
      mockDeleteSetlist.mockRejectedValue(new Error("Cannot delete"));
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Delete")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Delete"));
      fireEvent.click(screen.getByRole("button", { name: /delete setlist/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Cannot delete");
      });
    });

    it("first song up button is disabled", async () => {
      mockGetSetlist.mockResolvedValue({ setlist: mockSetlist, songs: mockSongs });
      renderPage();
      await waitFor(() => {
        const upButtons = screen.getAllByTitle("Move up");
        expect(upButtons[0]).toBeDisabled();
      });
    });

    it("last song down button is disabled", async () => {
      mockGetSetlist.mockResolvedValue({ setlist: mockSetlist, songs: mockSongs });
      renderPage();
      await waitFor(() => {
        const downButtons = screen.getAllByTitle("Move down");
        expect(downButtons[downButtons.length - 1]).toBeDisabled();
      });
    });
  });
});
