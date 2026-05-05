import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SongViewPage } from "@/pages/songs/SongViewPage";

// ---------- Mocks ----------
const mockGet = vi.fn();
const mockVariationCreate = vi.fn();
const mockVariationUpdate = vi.fn();
const mockVariationDelete = vi.fn();
const mockNavigate = vi.fn();

let mockAuthValue: any = {
  user: { id: "u1", email: "admin@test.com", displayName: "Admin", role: "owner" },
  activeOrg: { id: "org1", name: "Test Church", role: "admin" },
};

vi.mock("@/lib/api-client", () => ({
  songsApi: {
    get: (...args: any[]) => mockGet(...args),
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
    create: (...args: any[]) => mockVariationCreate(...args),
    update: (...args: any[]) => mockVariationUpdate(...args),
    setDefault: vi.fn(),
    delete: (...args: any[]) => mockVariationDelete(...args),
  },
  stickyNotesApi: {
    list: vi.fn().mockResolvedValue({ notes: [] }),
    create: vi.fn().mockResolvedValue({ note: { id: "n1", content: "Test", color: "yellow" } }),
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
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

vi.mock("@vpc-music/shared", () => ({
  ALL_KEYS: ["C", "D", "E", "F", "G", "A", "B"],
}));

vi.mock("@/components/songs/ChordProRenderer", () => ({
  ChordProRenderer: ({ content }: { content: string }) => (
    <div data-testid="chordpro-renderer">{content}</div>
  ),
  AutoScroll: () => <div data-testid="auto-scroll">AutoScroll</div>,
}));

const baseSong = {
  id: "song-1",
  title: "Amazing Grace",
  key: "G",
  tempo: 72,
  artist: "Newton",
  tags: "hymn",
  content: "[G]Amazing grace",
};

const mockVariations = [
  { id: "v1", songId: "song-1", name: "Acoustic", content: "[C]Acoustic grace", key: "C", createdBy: null, createdAt: "2025-01-01", updatedAt: "2025-01-01" },
  { id: "v2", songId: "song-1", name: "Electric", content: "[D]Electric grace", key: null, createdBy: null, createdAt: "2025-01-02", updatedAt: "2025-01-02" },
];

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

describe("Song Variations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  // ===================== DISPLAY =====================

  describe("display", () => {
    it("shows variation tabs when variations exist", async () => {
      mockGet.mockResolvedValue({ song: baseSong, variations: mockVariations });
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /original/i })).toBeInTheDocument();
        expect(screen.getByText("Acoustic")).toBeInTheDocument();
        expect(screen.getByText("Electric")).toBeInTheDocument();
      });
    });

    it("shows Original tab as active by default", async () => {
      mockGet.mockResolvedValue({ song: baseSong, variations: mockVariations });
      renderPage();
      await waitFor(() => {
        const btn = screen.getByRole("button", { name: /original/i });
        expect(btn.className).toContain("btn-primary");
      });
    });

    it("renders original content by default", async () => {
      mockGet.mockResolvedValue({ song: baseSong, variations: mockVariations });
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId("chordpro-renderer")).toHaveTextContent("[G]Amazing grace");
      });
    });

    it("shows + Variation button", async () => {
      mockGet.mockResolvedValue({ song: baseSong, variations: [] });
      renderPage();
      await waitFor(() => {
        expect(screen.getByTitle("Create a new variation")).toBeInTheDocument();
      });
    });

    it("shows key in variation tab when different from song key", async () => {
      mockGet.mockResolvedValue({ song: baseSong, variations: mockVariations });
      renderPage();
      await waitFor(() => {
        // Acoustic has key C, song is G → should show (C)
        expect(screen.getByText("(C)")).toBeInTheDocument();
      });
    });
  });

  // ===================== SWITCHING =====================

  describe("switching", () => {
    it("switches to variation content when clicking a variation tab", async () => {
      mockGet.mockResolvedValue({ song: baseSong, variations: mockVariations });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Acoustic")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Acoustic"));

      await waitFor(() => {
        expect(screen.getByTestId("chordpro-renderer")).toHaveTextContent("[C]Acoustic grace");
      });
    });

    it("shows variation name in the title when active", async () => {
      mockGet.mockResolvedValue({ song: baseSong, variations: mockVariations });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Acoustic")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Acoustic"));

      await waitFor(() => {
        expect(screen.getByText("— Acoustic")).toBeInTheDocument();
      });
    });

    it("shows variation key in metadata when different from song key", async () => {
      mockGet.mockResolvedValue({ song: baseSong, variations: mockVariations });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Acoustic")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Acoustic"));

      await waitFor(() => {
        expect(screen.getByText("Key: C")).toBeInTheDocument();
      });
    });

    it("switches back to original when clicking Original tab", async () => {
      mockGet.mockResolvedValue({ song: baseSong, variations: mockVariations });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Acoustic")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Acoustic"));
      fireEvent.click(screen.getByRole("button", { name: /original/i }));

      await waitFor(() => {
        expect(screen.getByTestId("chordpro-renderer")).toHaveTextContent("[G]Amazing grace");
      });
    });
  });

  // ===================== CREATE =====================

  describe("create", () => {
    it("opens the variation form when clicking + Variation", async () => {
      mockGet.mockResolvedValue({ song: baseSong, variations: [] });
      renderPage();

      await waitFor(() => {
        expect(screen.getByTitle("Create a new variation")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Create a new variation"));

      await waitFor(() => {
        expect(screen.getByText("New Variation")).toBeInTheDocument();
        expect(screen.getByTestId("variation-name-input")).toBeInTheDocument();
        expect(screen.getByTestId("variation-content-textarea")).toBeInTheDocument();
      });
    });

    it("pre-fills content from the original song", async () => {
      mockGet.mockResolvedValue({ song: baseSong, variations: [] });
      renderPage();

      await waitFor(() => {
        expect(screen.getByTitle("Create a new variation")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Create a new variation"));

      await waitFor(() => {
        expect(screen.getByTestId("variation-content-textarea")).toHaveValue("[G]Amazing grace");
      });
    });

    it("creates a variation when form is submitted", async () => {
      mockGet.mockResolvedValue({ song: baseSong, variations: [] });
      mockVariationCreate.mockResolvedValue({
        variation: { id: "v-new", songId: "song-1", name: "My Version", content: "[A]New content", key: "A" },
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByTitle("Create a new variation")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Create a new variation"));

      await waitFor(() => {
        expect(screen.getByTestId("variation-name-input")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId("variation-name-input"), { target: { value: "My Version" } });
      fireEvent.change(screen.getByTestId("variation-content-textarea"), { target: { value: "[A]New content" } });
      fireEvent.click(screen.getByTestId("variation-save-btn"));

      await waitFor(() => {
        expect(mockVariationCreate).toHaveBeenCalledWith("song-1", expect.objectContaining({
          name: "My Version",
          content: "[A]New content",
        }));
      });
    });

    it("adds new variation to tabs after creation", async () => {
      mockGet.mockResolvedValue({ song: baseSong, variations: [] });
      mockVariationCreate.mockResolvedValue({
        variation: { id: "v-new", songId: "song-1", name: "My Version", content: "[A]New", key: "A" },
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByTitle("Create a new variation")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Create a new variation"));

      await waitFor(() => {
        expect(screen.getByTestId("variation-name-input")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId("variation-name-input"), { target: { value: "My Version" } });
      fireEvent.click(screen.getByTestId("variation-save-btn"));

      await waitFor(() => {
        expect(screen.getByText("My Version")).toBeInTheDocument();
      });
    });

    it("closes the modal on cancel", async () => {
      mockGet.mockResolvedValue({ song: baseSong, variations: [] });
      renderPage();

      await waitFor(() => {
        expect(screen.getByTitle("Create a new variation")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Create a new variation"));
      await waitFor(() => {
        expect(screen.getByText("New Variation")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Cancel"));

      await waitFor(() => {
        expect(screen.queryByText("New Variation")).not.toBeInTheDocument();
      });
    });
  });

  // ===================== DELETE =====================

  describe("delete", () => {
    it("deletes a variation and removes it from tabs", async () => {
      mockGet.mockResolvedValue({ song: baseSong, variations: [mockVariations[0]] });
      mockVariationDelete.mockResolvedValue({ message: "ok" });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Acoustic")).toBeInTheDocument();
      });

      // Hover to show delete button — just click the delete icon via title
      const deleteBtn = screen.getByTitle("Delete variation");
      fireEvent.click(deleteBtn);

      await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
      fireEvent.click(within(screen.getByRole("dialog")).getByText("Delete variation"));

      await waitFor(() => {
        expect(mockVariationDelete).toHaveBeenCalledWith("song-1", "v1");
      });
    });

    it("shows success toast after deletion", async () => {
      const { toast } = await import("sonner");
      mockGet.mockResolvedValue({ song: baseSong, variations: [mockVariations[0]] });
      mockVariationDelete.mockResolvedValue({ message: "ok" });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Acoustic")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Delete variation"));

      await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
      fireEvent.click(within(screen.getByRole("dialog")).getByText("Delete variation"));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Variation deleted");
      });
    });

    it("reverts to original when active variation is deleted", async () => {
      mockGet.mockResolvedValue({ song: baseSong, variations: [mockVariations[0]] });
      mockVariationDelete.mockResolvedValue({ message: "ok" });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Acoustic")).toBeInTheDocument();
      });

      // Activate variation first
      fireEvent.click(screen.getByText("Acoustic"));
      await waitFor(() => {
        expect(screen.getByTestId("chordpro-renderer")).toHaveTextContent("[C]Acoustic grace");
      });

      // Delete it
      fireEvent.click(screen.getByTitle("Delete variation"));

      await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
      fireEvent.click(within(screen.getByRole("dialog")).getByText("Delete variation"));

      await waitFor(() => {
        expect(screen.getByTestId("chordpro-renderer")).toHaveTextContent("[G]Amazing grace");
      });
    });
  });

  // ===================== NEGATIVE =====================

  describe("negative", () => {
    it("shows error toast on create failure", async () => {
      const { toast } = await import("sonner");
      mockGet.mockResolvedValue({ song: baseSong, variations: [] });
      mockVariationCreate.mockRejectedValue(new Error("Server error"));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTitle("Create a new variation")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Create a new variation"));

      await waitFor(() => {
        expect(screen.getByTestId("variation-name-input")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId("variation-name-input"), { target: { value: "Fail" } });
      fireEvent.click(screen.getByTestId("variation-save-btn"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Server error");
      });
    });

    it("shows error toast on delete failure", async () => {
      const { toast } = await import("sonner");
      mockGet.mockResolvedValue({ song: baseSong, variations: [mockVariations[0]] });
      mockVariationDelete.mockRejectedValue(new Error("Cannot delete"));
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Acoustic")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Delete variation"));

      await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
      fireEvent.click(within(screen.getByRole("dialog")).getByText("Delete variation"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Cannot delete");
      });
    });

    it("disables save button when name is empty", async () => {
      mockGet.mockResolvedValue({ song: baseSong, variations: [] });
      renderPage();

      await waitFor(() => {
        expect(screen.getByTitle("Create a new variation")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Create a new variation"));

      await waitFor(() => {
        const saveBtn = screen.getByTestId("variation-save-btn");
        // Name input is empty
        expect(saveBtn).toBeDisabled();
      });
    });
  });
});
