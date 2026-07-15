import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SongViewPage } from "@/pages/songs/SongViewPage";

// ---------- Mocks ----------
const mockGetSong = vi.fn();
const mockListNotes = vi.fn();
const mockCreateNote = vi.fn();
const mockUpdateNote = vi.fn();
const mockDeleteNote = vi.fn();

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
    list: vi.fn().mockResolvedValue({ history: [] }),
  },
  variationsApi: {
    create: vi.fn(),
    update: vi.fn(),
    setDefault: vi.fn(),
    delete: vi.fn(),
  },
  stickyNotesApi: {
    list: (...args: any[]) => mockListNotes(...args),
    create: (...args: any[]) => mockCreateNote(...args),
    update: (...args: any[]) => mockUpdateNote(...args),
    delete: (...args: any[]) => mockDeleteNote(...args),
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
  parseChordPro: () => ({ directives: {}, sections: [], chordDefinitions: {} }),
  transposeKeyName: (key: string) => key,
  normalizeEnharmonicKey: (key: string | null | undefined) => key,
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

describe("Sticky Notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  // ===================== POSITIVE =====================

  describe("positive", () => {
    it("renders Notes heading even when empty", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListNotes.mockResolvedValue({ notes: [] });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Notes")).toBeInTheDocument();
      });
    });

    it("shows empty state message when no notes", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListNotes.mockResolvedValue({ notes: [] });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/No notes yet/)).toBeInTheDocument();
      });
    });

    it("renders existing sticky notes", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListNotes.mockResolvedValue({
        notes: [
          { id: "n1", songId: "song-1", userId: "u1", content: "Remember the key change!", color: "yellow", createdAt: "2025-06-01T00:00:00Z" },
          { id: "n2", songId: "song-1", userId: "u1", content: "Slow down on bridge", color: "blue", createdAt: "2025-06-02T00:00:00Z" },
        ],
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Remember the key change!")).toBeInTheDocument();
        expect(screen.getByText("Slow down on bridge")).toBeInTheDocument();
      });
    });

    it("shows note count badge", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListNotes.mockResolvedValue({
        notes: [
          { id: "n1", songId: "song-1", userId: "u1", content: "Note 1", color: "yellow" },
          { id: "n2", songId: "song-1", userId: "u1", content: "Note 2", color: "blue" },
        ],
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("(2)")).toBeInTheDocument();
      });
    });

    it("opens new note form on Add Note click", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListNotes.mockResolvedValue({ notes: [] });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Add Note")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Add Note"));

      await waitFor(() => {
        expect(screen.getByText("New Note")).toBeInTheDocument();
        expect(screen.getByTestId("note-content-input")).toBeInTheDocument();
      });
    });

    it("creates a new note via the form", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListNotes.mockResolvedValue({ notes: [] });
      mockCreateNote.mockResolvedValue({
        note: { id: "n1", songId: "song-1", userId: "u1", content: "New reminder", color: "yellow" },
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Add Note")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Add Note"));

      await waitFor(() => {
        expect(screen.getByTestId("note-content-input")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId("note-content-input"), {
        target: { value: "New reminder" },
      });

      fireEvent.click(screen.getByText("Add Note", { selector: "button.w-full" }));

      await waitFor(() => {
        expect(mockCreateNote).toHaveBeenCalledWith("song-1", {
          content: "New reminder",
          color: "yellow",
        });
      });
    });

    it("renders color picker buttons in form", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListNotes.mockResolvedValue({ notes: [] });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Add Note")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Add Note"));

      await waitFor(() => {
        expect(screen.getByTestId("note-color-yellow")).toBeInTheDocument();
        expect(screen.getByTestId("note-color-blue")).toBeInTheDocument();
        expect(screen.getByTestId("note-color-green")).toBeInTheDocument();
        expect(screen.getByTestId("note-color-pink")).toBeInTheDocument();
        expect(screen.getByTestId("note-color-purple")).toBeInTheDocument();
      });
    });

    it("selects a color when color button is clicked", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListNotes.mockResolvedValue({ notes: [] });
      mockCreateNote.mockResolvedValue({
        note: { id: "n1", songId: "song-1", userId: "u1", content: "Blue note", color: "blue" },
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Add Note")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Add Note"));

      await waitFor(() => {
        expect(screen.getByTestId("note-color-blue")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("note-color-blue"));

      fireEvent.change(screen.getByTestId("note-content-input"), {
        target: { value: "Blue note" },
      });

      fireEvent.click(screen.getByText("Add Note", { selector: "button.w-full" }));

      await waitFor(() => {
        expect(mockCreateNote).toHaveBeenCalledWith("song-1", {
          content: "Blue note",
          color: "blue",
        });
      });
    });

    it("deletes a note when confirmed", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListNotes.mockResolvedValue({
        notes: [
          { id: "n1", songId: "song-1", userId: "u1", content: "To be deleted", color: "yellow" },
        ],
      });
      mockDeleteNote.mockResolvedValue({ message: "ok" });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("To be deleted")).toBeInTheDocument();
      });

      // The delete button is hidden by default (group-hover), find it by title
      const deleteBtn = screen.getByTitle("Delete note");
      fireEvent.click(deleteBtn);

      // Confirm the dialog
      await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
      fireEvent.click(within(screen.getByRole("dialog")).getByText("Delete note"));

      await waitFor(() => {
        expect(mockDeleteNote).toHaveBeenCalledWith("song-1", "n1");
      });
    });

    it("shows sticky note cards with data-testid", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListNotes.mockResolvedValue({
        notes: [
          { id: "n1", songId: "song-1", userId: "u1", content: "Test card", color: "green" },
        ],
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId("sticky-note")).toBeInTheDocument();
      });
    });
  });

  // ===================== NEGATIVE =====================

  describe("negative", () => {
    it("handles note list API failure gracefully", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListNotes.mockRejectedValue(new Error("Network error"));
      renderPage();

      // Should still render the page without crashing
      await waitFor(() => {
        expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
        expect(screen.getByText("Notes")).toBeInTheDocument();
      });
    });

    it("shows error toast on create failure", async () => {
      const { toast } = await import("sonner");
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListNotes.mockResolvedValue({ notes: [] });
      mockCreateNote.mockRejectedValue(new Error("Server error"));
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Add Note")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Add Note"));

      await waitFor(() => {
        expect(screen.getByTestId("note-content-input")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId("note-content-input"), {
        target: { value: "Failing note" },
      });

      fireEvent.click(screen.getByText("Add Note", { selector: "button.w-full" }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Server error");
      });
    });

    it("shows error toast on delete failure", async () => {
      const { toast } = await import("sonner");
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListNotes.mockResolvedValue({
        notes: [
          { id: "n1", songId: "song-1", userId: "u1", content: "Undeletable", color: "yellow" },
        ],
      });
      mockDeleteNote.mockRejectedValue(new Error("Forbidden"));
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Undeletable")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Delete note"));

      await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
      fireEvent.click(within(screen.getByRole("dialog")).getByText("Delete note"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Forbidden");
      });
    });

    it("disables Add Note button when content is empty", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListNotes.mockResolvedValue({ notes: [] });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Add Note")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Add Note"));

      await waitFor(() => {
        const submitBtn = screen.getByText("Add Note", { selector: "button.w-full" });
        expect(submitBtn).toBeDisabled();
      });
    });

    it("closes note form on X button click", async () => {
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
      mockListNotes.mockResolvedValue({ notes: [] });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Add Note")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Add Note"));

      await waitFor(() => {
        expect(screen.getByText("New Note")).toBeInTheDocument();
      });

      // The X close button is the one inside the modal header
      const modalHeader = screen.getByText("New Note").parentElement!;
      const closeBtn = modalHeader.querySelector("button")!;
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByText("New Note")).not.toBeInTheDocument();
      });
    });
  });
});
