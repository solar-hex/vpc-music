import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SongViewPage } from "@/pages/songs/SongViewPage";
import * as fs from "fs";
import * as path from "path";

// ---------- Mocks ----------
const mockGetSong = vi.fn();
const mockExportChordPro = vi.fn();
const mockExportOnSong = vi.fn();
const mockExportText = vi.fn();
const mockDeleteSong = vi.fn();
const mockNavigate = vi.fn();
const mockLogUsage = vi.fn();
const mockListUsage = vi.fn();

let mockAuthValue: any = {
  user: { id: "u1", email: "admin@test.com", displayName: "Admin", role: "owner" },
  activeOrg: { id: "org1", name: "Test Church", role: "admin" },
};

vi.mock("@/lib/api-client", () => ({
  songsApi: {
    get: (...args: any[]) => mockGetSong(...args),
    delete: (...args: any[]) => mockDeleteSong(...args),
    exportChordPro: (...args: any[]) => mockExportChordPro(...args),
    exportOnSong: (...args: any[]) => mockExportOnSong(...args),
    exportText: (...args: any[]) => mockExportText(...args),
    exportPdf: (id: string) => `/api/songs/${id}/export/pdf`,
  },
  shareApi: {
    create: vi.fn(),
    list: vi.fn(),
    revoke: vi.fn(),
    update: vi.fn(),
    listDirect: vi.fn().mockResolvedValue({ directShares: [] }),
    createDirect: vi.fn(),
    removeDirect: vi.fn(),
  },
  songUsageApi: {
    list: (...args: any[]) => mockListUsage(...args),
    log: (...args: any[]) => mockLogUsage(...args),
    remove: vi.fn(),
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
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

vi.mock("@vpc-music/shared", () => ({
  transposeKeyName: (key: string) => key,
  keyPrefersFlats: () => false,
  parseBarLine: () => ({ measures: [] }),
  ALL_KEYS: ["C", "D", "E", "F", "G", "A", "B"],
  parseChordPro: (input: string) => ({
    directives: {},
    sections: [{ name: "", lines: [{ chords: [], lyrics: input }] }],
  }),
  chordToNashville: () => "1",
}));

const mockSong = {
  id: "song-1",
  title: "Amazing Grace",
  key: "G",
  tempo: 80,
  artist: "John Newton",
  content: "[G]Amazing [C]grace\nHow sweet the [G]sound",
};

const mockVariation = {
  id: "v1",
  songId: "song-1",
  name: "Acoustic",
  key: "C",
  content: "[C]Amazing [F]grace",
};

function renderPage(id = "song-1", variationId?: string) {
  return render(
    <MemoryRouter initialEntries={[variationId ? `/songs/${id}?variation=${variationId}` : `/songs/${id}`]}>
      <Routes>
        <Route path="/songs/:id" element={<SongViewPage />} />
        <Route path="/songs/:id/edit" element={<div>Edit Page</div>} />
        <Route path="/songs" element={<div>Songs List</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Export formats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSong.mockResolvedValue({ song: mockSong, variations: [] });
    mockListUsage.mockResolvedValue({ usages: [] });
  });

  // ===================== RENDERING =====================
  describe("rendering", () => {
    it("renders export dropdown button", async () => {
      renderPage();
      await waitFor(() => {
        const exportBtn = screen.getByText("Export", { exact: false });
        expect(exportBtn).toBeInTheDocument();
      });
    });

    it("export dropdown is closed by default", async () => {
      renderPage();
      await waitFor(() => screen.getByText("Amazing Grace"));
      expect(screen.queryByText("ChordPro (.cho)")).not.toBeInTheDocument();
    });

    it("clicking Export reveals four format options", async () => {
      renderPage();
      await waitFor(() => screen.getByText("Amazing Grace"));
      const exportBtn = screen.getByText("Export", { exact: false });
      fireEvent.click(exportBtn);
      expect(screen.getByText("ChordPro (.cho)")).toBeInTheDocument();
      expect(screen.getByText("OnSong (.onsong)")).toBeInTheDocument();
      expect(screen.getByText("Plain Text (.txt)")).toBeInTheDocument();
      expect(screen.getByText("PDF (print)")).toBeInTheDocument();
    });

    it("dropdown contains ChordPro option", async () => {
      renderPage();
      await waitFor(() => screen.getByText("Amazing Grace"));
      fireEvent.click(screen.getByText("Export", { exact: false }));
      expect(screen.getByText("ChordPro (.cho)")).toBeInTheDocument();
    });

    it("dropdown contains OnSong option", async () => {
      renderPage();
      await waitFor(() => screen.getByText("Amazing Grace"));
      fireEvent.click(screen.getByText("Export", { exact: false }));
      expect(screen.getByText("OnSong (.onsong)")).toBeInTheDocument();
    });

    it("dropdown contains PDF option", async () => {
      renderPage();
      await waitFor(() => screen.getByText("Amazing Grace"));
      fireEvent.click(screen.getByText("Export", { exact: false }));
      expect(screen.getByText("PDF (print)")).toBeInTheDocument();
    });

    it("dropdown contains plain text option", async () => {
      renderPage();
      await waitFor(() => screen.getByText("Amazing Grace"));
      fireEvent.click(screen.getByText("Export", { exact: false }));
      expect(screen.getByText("Plain Text (.txt)")).toBeInTheDocument();
    });
  });

  // ===================== INTERACTIONS =====================
  describe("interactions", () => {
    it("clicking ChordPro calls exportChordPro", async () => {
      const mockBlob = new Blob(["test"], { type: "text/plain" });
      mockExportChordPro.mockResolvedValue({ blob: () => Promise.resolve(mockBlob) });
      renderPage();
      await waitFor(() => screen.getByText("Amazing Grace"));

      fireEvent.click(screen.getByText("Export", { exact: false }));
      fireEvent.click(screen.getByText("ChordPro (.cho)"));

      await waitFor(() => {
        expect(mockExportChordPro).toHaveBeenCalledWith("song-1", undefined);
      });
    });

    it("clicking OnSong calls exportOnSong", async () => {
      const mockBlob = new Blob(["test"], { type: "text/plain" });
      mockExportOnSong.mockResolvedValue({ blob: () => Promise.resolve(mockBlob) });
      renderPage();
      await waitFor(() => screen.getByText("Amazing Grace"));

      fireEvent.click(screen.getByText("Export", { exact: false }));
      fireEvent.click(screen.getByText("OnSong (.onsong)"));

      await waitFor(() => {
        expect(mockExportOnSong).toHaveBeenCalledWith("song-1", undefined);
      });
    });

    it("clicking PDF opens a new window with the PDF URL", async () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      renderPage();
      await waitFor(() => screen.getByText("Amazing Grace"));

      fireEvent.click(screen.getByText("Export", { exact: false }));
      fireEvent.click(screen.getByText("PDF (print)"));

      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/songs/song-1/export/pdf"),
        "_blank",
      );
      openSpy.mockRestore();
    });

    it("clicking Plain Text calls exportText", async () => {
      const mockBlob = new Blob(["test"], { type: "text/plain" });
      mockExportText.mockResolvedValue({ blob: () => Promise.resolve(mockBlob) });
      renderPage();
      await waitFor(() => screen.getByText("Amazing Grace"));

      fireEvent.click(screen.getByText("Export", { exact: false }));
      fireEvent.click(screen.getByText("Plain Text (.txt)"));

      await waitFor(() => {
        expect(mockExportText).toHaveBeenCalledWith("song-1", undefined);
      });
    });

    it("exports the active variation when one is selected", async () => {
      const mockBlob = new Blob(["test"], { type: "text/plain" });
      mockGetSong.mockResolvedValue({ song: mockSong, variations: [mockVariation] });
      mockExportChordPro.mockResolvedValue({ blob: () => Promise.resolve(mockBlob) });
      renderPage("song-1", "v1");
      await waitFor(() => screen.getByText("Amazing Grace"));

      fireEvent.click(screen.getByText("Export", { exact: false }));
      fireEvent.click(screen.getByText("ChordPro (.cho)"));

      await waitFor(() => {
        expect(mockExportChordPro).toHaveBeenCalledWith("song-1", "v1");
      });
    });

    it("export menu closes after ChordPro export", async () => {
      const mockBlob = new Blob(["test"], { type: "text/plain" });
      mockExportChordPro.mockResolvedValue({ blob: () => Promise.resolve(mockBlob) });
      renderPage();
      await waitFor(() => screen.getByText("Amazing Grace"));

      fireEvent.click(screen.getByText("Export", { exact: false }));
      expect(screen.getByText("ChordPro (.cho)")).toBeInTheDocument();

      fireEvent.click(screen.getByText("ChordPro (.cho)"));
      await waitFor(() => {
        expect(screen.queryByText("OnSong (.onsong)")).not.toBeInTheDocument();
      });
    });

    it("export menu closes after PDF export", async () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      renderPage();
      await waitFor(() => screen.getByText("Amazing Grace"));

      fireEvent.click(screen.getByText("Export", { exact: false }));
      fireEvent.click(screen.getByText("PDF (print)"));

      expect(screen.queryByText("OnSong (.onsong)")).not.toBeInTheDocument();
      openSpy.mockRestore();
    });

    it("shows error toast when ChordPro export fails", async () => {
      const { toast } = await import("sonner");
      mockExportChordPro.mockRejectedValue(new Error("Network error"));
      renderPage();
      await waitFor(() => screen.getByText("Amazing Grace"));

      fireEvent.click(screen.getByText("Export", { exact: false }));
      fireEvent.click(screen.getByText("ChordPro (.cho)"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Export failed");
      });
    });

    it("shows error toast when OnSong export fails", async () => {
      const { toast } = await import("sonner");
      mockExportOnSong.mockRejectedValue(new Error("Network error"));
      renderPage();
      await waitFor(() => screen.getByText("Amazing Grace"));

      fireEvent.click(screen.getByText("Export", { exact: false }));
      fireEvent.click(screen.getByText("OnSong (.onsong)"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Export failed");
      });
    });

    it("shows error toast when plain text export fails", async () => {
      const { toast } = await import("sonner");
      mockExportText.mockRejectedValue(new Error("Network error"));
      renderPage();
      await waitFor(() => screen.getByText("Amazing Grace"));

      fireEvent.click(screen.getByText("Export", { exact: false }));
      fireEvent.click(screen.getByText("Plain Text (.txt)"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Export failed");
      });
    });

    it("toggling export menu open/closed works", async () => {
      renderPage();
      await waitFor(() => screen.getByText("Amazing Grace"));

      const exportBtn = screen.getByText("Export", { exact: false });
      fireEvent.click(exportBtn); // open
      expect(screen.getByText("ChordPro (.cho)")).toBeInTheDocument();

      fireEvent.click(exportBtn); // close
      expect(screen.queryByText("ChordPro (.cho)")).not.toBeInTheDocument();
    });
  });

  // ===================== SOURCE-LEVEL =====================
  describe("source-level", () => {
    const pageSrc = fs.readFileSync(
      path.resolve(__dirname, "../pages/songs/SongViewPage.tsx"),
      "utf-8",
    );
    const apiSrc = fs.readFileSync(
      path.resolve(__dirname, "../lib/api-client.ts"),
      "utf-8",
    );
    const routesSrc = fs.readFileSync(
      path.resolve(__dirname, "../../../api/src/features/songs/routes.js"),
      "utf-8",
    );

    it("SongViewPage has ChevronDown import for dropdown", () => {
      expect(pageSrc).toContain("ChevronDown");
    });

    it("api-client has exportOnSong method", () => {
      expect(apiSrc).toContain("exportOnSong");
    });

    it("api-client has exportPdf method", () => {
      expect(apiSrc).toContain("exportPdf");
    });

    it("API routes import chordProToOnSong", () => {
      expect(routesSrc).toContain("chordProToOnSong");
    });

    it("API routes no longer have 501 for OnSong export", () => {
      expect(routesSrc).not.toContain("OnSong export not yet implemented");
    });

    it("API routes no longer have 501 for PDF export", () => {
      expect(routesSrc).not.toContain("PDF export not yet implemented");
    });
  });
});
