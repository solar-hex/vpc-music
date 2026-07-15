import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import fs from "node:fs";
import path from "node:path";

// ---------- Mocks ----------

// songsApi
const mockGet = vi.fn();
vi.mock("@/lib/api-client", () => ({
  annotationsApi: {
    get: vi.fn().mockResolvedValue({ annotation: null }),
    save: vi.fn().mockResolvedValue({ annotation: { id: "a1", data: [] } }),
  },
  songsApi: {
    get: (...args: any[]) => mockGet(...args),
    delete: vi.fn(),
    exportChordPro: vi.fn(),
  },
  shareApi: {
    create: vi.fn(),
    list: vi.fn().mockResolvedValue({ shares: [] }),
    revoke: vi.fn(),
    update: vi.fn().mockResolvedValue({ shareToken: {} }),
    listDirect: vi.fn().mockResolvedValue({ directShares: [] }),
    createDirect: vi.fn(),
    removeDirect: vi.fn(),
    getShared: vi.fn().mockResolvedValue({
      song: {
        id: "s1",
        title: "Amazing Grace",
        artist: "John Newton",
        key: "G",
        tempo: 80,
        tags: "hymn",
        content: "[G]Amazing grace, [C]how sweet [G]the sound",
      },
    }),
  },
  songUsageApi: {
    list: vi.fn().mockResolvedValue({ usages: [] }),
    log: vi.fn(),
    remove: vi.fn(),
  },
  songHistoryApi: {
    list: vi.fn().mockResolvedValue({ history: [] }),
  },
  variationsApi: {
    create: vi.fn(),
    update: vi.fn(),
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

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: "u1", email: "test@test.com", role: "owner", displayName: "Test" },
    activeOrg: { orgId: "org1", orgName: "Test Church", role: "admin" },
  }),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ resolvedTheme: "dark", toggleTheme: vi.fn() }),
}));

// Minimal mock for ChordProRenderer
vi.mock("@/components/songs/ChordProRenderer", () => ({
  ChordProRenderer: ({ content }: { content: string }) => (
    <div data-testid="chordpro-renderer">{content}</div>
  ),
  AutoScroll: () => <div data-testid="auto-scroll">AutoScroll</div>,
}));

const mockSong = {
  id: "s1",
  title: "Amazing Grace",
  artist: "John Newton",
  key: "G",
  tempo: 80,
  tags: "hymn",
  content: "[G]Amazing grace, [C]how sweet [G]the sound",
};

// ---------- Imports ----------

import { SongViewPage } from "@/pages/songs/SongViewPage";
import { SharedSongPage } from "@/pages/SharedSongPage";

// ---------- Helpers ----------

function renderSongView() {
  return render(
    <MemoryRouter initialEntries={["/songs/s1"]}>
      <Routes>
        <Route path="/songs/:id" element={<SongViewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderSharedSong() {
  return render(
    <MemoryRouter initialEntries={["/shared/tok123"]}>
      <Routes>
        <Route path="/shared/:token" element={<SharedSongPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ---------- Tests ----------

describe("Print stylesheet feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ song: mockSong, variations: [] });
  });

  // ===================== SongViewPage =====================

  describe("SongViewPage — print action", () => {
    it("offers Print inside the More actions menu", async () => {
      renderSongView();
      const user = userEvent.setup();
      await waitFor(() => screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("button", { name: /more actions/i }));
      expect(screen.getByRole("menuitem", { name: "Print" })).toBeInTheDocument();
    });

    it("calls window.print when Print is selected", async () => {
      const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
      renderSongView();
      const user = userEvent.setup();
      await waitFor(() => screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("menuitem", { name: "Print" }));
      expect(printSpy).toHaveBeenCalledOnce();
      printSpy.mockRestore();
    });

    it("toolbar has print-hidden class for print media", async () => {
      renderSongView();
      const user = userEvent.setup();
      await waitFor(() => screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("button", { name: /more actions/i }));
      const toolbar = screen.getByRole("menuitem", { name: "Print" }).closest("div.print-hidden");
      expect(toolbar).toBeInTheDocument();
    });

    it("song content area has print-sheet class", async () => {
      renderSongView();
      await waitFor(() => screen.getByTestId("chordpro-renderer"));
      const sheet = screen.getByTestId("chordpro-renderer").closest(".print-sheet");
      expect(sheet).toBeInTheDocument();
    });

    it("song metadata has print-meta class", async () => {
      renderSongView();
      await waitFor(() => screen.getByText("Amazing Grace"));
      const meta = screen.getByText("Amazing Grace").closest(".print-meta");
      expect(meta).toBeInTheDocument();
    });
  });

  // ===================== SharedSongPage =====================

  describe("SharedSongPage — print button", () => {
    it("renders a Print button", async () => {
      renderSharedSong();
      await waitFor(() => {
        expect(screen.getByText("Print")).toBeInTheDocument();
      });
    });

    it("calls window.print when clicked", async () => {
      const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
      renderSharedSong();
      const user = userEvent.setup();
      await waitFor(() => screen.getByText("Print"));
      await user.click(screen.getByText("Print"));
      expect(printSpy).toHaveBeenCalledOnce();
      printSpy.mockRestore();
    });

    it("toolbar has print-hidden class", async () => {
      renderSharedSong();
      await waitFor(() => screen.getByText("Print"));
      const toolbar = screen.getByText("Print").closest(".print-hidden");
      expect(toolbar).toBeInTheDocument();
    });

    it("song content area has print-sheet class", async () => {
      renderSharedSong();
      await waitFor(() => screen.getByTestId("chordpro-renderer"));
      const sheet = screen.getByTestId("chordpro-renderer").closest(".print-sheet");
      expect(sheet).toBeInTheDocument();
    });

    it("metadata area has print-meta class", async () => {
      renderSharedSong();
      await waitFor(() => screen.getByText("Amazing Grace"));
      const meta = screen.getByText("Amazing Grace").closest(".print-meta");
      expect(meta).toBeInTheDocument();
    });

    it("footer has print-hidden class", async () => {
      renderSharedSong();
      await waitFor(() => screen.getByText(/powered by/i));
      const footer = screen.getByText(/powered by/i);
      expect(footer).toHaveClass("print-hidden");
    });
  });

  // ===================== CSS source-level =====================

  describe("print CSS rules", () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, "../styles/index.css"),
      "utf-8",
    );

    it("contains @media print block", () => {
      expect(css).toContain("@media print");
    });

    it("hides .print-hidden elements in print", () => {
      expect(css).toContain(".print-hidden");
      expect(css).toContain("display: none !important");
    });

    it("removes scroll constraints on .print-sheet", () => {
      expect(css).toContain(".print-sheet");
      expect(css).toContain("max-height: none !important");
      expect(css).toContain("overflow: visible !important");
    });

    it("forces light colors for print", () => {
      expect(css).toContain("background: white !important");
      expect(css).toContain("color: black !important");
    });

    it("sets @page margins", () => {
      expect(css).toContain("@page");
      expect(css).toContain("margin: 1.5cm");
    });

    it("avoids breaking inside chord lines", () => {
      expect(css).toContain("break-inside: avoid");
    });

    it("styles .print-meta for title block", () => {
      expect(css).toContain(".print-meta");
    });
  });
});
