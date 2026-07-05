import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SetlistHubPage } from "@/pages/setlists/SetlistHubPage";

// ---------- Mocks ----------
const mockList = vi.fn();
const mockCreate = vi.fn();
const mockDeleteSetlist = vi.fn();
const mockArchive = vi.fn();
const mockUnarchive = vi.fn();
const mockRestore = vi.fn();
const mockPermanentDelete = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/lib/api-client", () => ({
  setlistsApi: {
    list: (...args: any[]) => mockList(...args),
    create: (...args: any[]) => mockCreate(...args),
    delete: (...args: any[]) => mockDeleteSetlist(...args),
    archive: (...args: any[]) => mockArchive(...args),
    unarchive: (...args: any[]) => mockUnarchive(...args),
    restore: (...args: any[]) => mockRestore(...args),
    permanentDelete: (...args: any[]) => mockPermanentDelete(...args),
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

let mockAuthValue: any = {
  user: { id: "u1", email: "test@test.com", displayName: "Test", role: "owner" },
  activeOrg: { id: "org1", name: "Test Church", role: "admin" },
};
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/setlists"]}>
      <SetlistHubPage />
    </MemoryRouter>,
  );
}

describe("SetlistHubPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockAuthValue = {
      user: { id: "u1", email: "test@test.com", displayName: "Test", role: "owner" },
      activeOrg: { id: "org1", name: "Test Church", role: "admin" },
    };
    mockList.mockResolvedValue({ setlists: [] });
  });

  // ===================== POSITIVE =====================

  describe("positive", () => {
    it("renders heading", async () => {
      renderPage();
      expect(screen.getByText("Setlists")).toBeInTheDocument();
    });

    it("fetches active setlists by default", async () => {
      renderPage();
      await waitFor(() => {
        expect(mockList).toHaveBeenCalledWith({ view: "active" });
      });
    });

    it("renders New Setlist button", async () => {
      renderPage();
      expect(screen.getByRole("button", { name: /new setlist/i })).toBeInTheDocument();
    });

    it("renders setlist cards with rich metadata", async () => {
      mockList.mockResolvedValue({
        setlists: [
          {
            id: "s1",
            name: "Sunday Worship",
            songCount: 5,
            category: "Sunday",
            totalDuration: 1800,
            averageBpm: 96,
            keys: "G,C",
            leader: "Sam",
            updatedAt: "2026-01-01T00:00:00Z",
          },
          { id: "s2", name: "Wednesday Night", songCount: 3, category: null, updatedAt: "2026-01-02T00:00:00Z" },
        ],
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Sunday Worship")).toBeInTheDocument();
        expect(screen.getByText("Wednesday Night")).toBeInTheDocument();
        expect(screen.getByText(/5 songs/)).toBeInTheDocument();
        expect(screen.getByText("30 min")).toBeInTheDocument();
        expect(screen.getByText(/~96 BPM/)).toBeInTheDocument();
        expect(screen.getByText("Sam")).toBeInTheDocument();
      });
    });

    it("filters setlists via search", async () => {
      mockList.mockResolvedValue({
        setlists: [
          { id: "s1", name: "Sunday Worship", songCount: 5, updatedAt: "2026-01-01T00:00:00Z" },
          { id: "s2", name: "Youth Night", songCount: 3, updatedAt: "2026-01-02T00:00:00Z" },
        ],
      });
      renderPage();
      await waitFor(() => screen.getByText("Sunday Worship"));

      fireEvent.change(screen.getByLabelText(/search setlists/i), { target: { value: "youth" } });

      expect(screen.getByText("Youth Night")).toBeInTheDocument();
      expect(screen.queryByText("Sunday Worship")).not.toBeInTheDocument();
    });

    it("sorts alphabetically when selected", async () => {
      mockList.mockResolvedValue({
        setlists: [
          { id: "s1", name: "Zebra Set", songCount: 1, updatedAt: "2026-01-02T00:00:00Z" },
          { id: "s2", name: "Alpha Set", songCount: 2, updatedAt: "2026-01-01T00:00:00Z" },
        ],
      });
      renderPage();
      await waitFor(() => screen.getByText("Zebra Set"));

      fireEvent.change(screen.getByLabelText(/sort setlists/i), { target: { value: "alphabetical" } });

      const names = screen.getAllByText(/Set$/).map((el) => el.textContent);
      expect(names[0]).toBe("Alpha Set");
    });

    it("archives a setlist and removes it from the grid", async () => {
      mockList.mockResolvedValue({
        setlists: [{ id: "s1", name: "Old Set", songCount: 2, updatedAt: "2026-01-01T00:00:00Z" }],
      });
      mockArchive.mockResolvedValue({ setlist: { id: "s1" } });
      renderPage();
      await waitFor(() => screen.getByText("Old Set"));

      fireEvent.click(screen.getByTitle("Archive"));

      await waitFor(() => {
        expect(mockArchive).toHaveBeenCalledWith("s1");
        expect(screen.queryByText("Old Set")).not.toBeInTheDocument();
      });
    });

    it("opens the archived panel and lists archived setlists", async () => {
      mockList.mockImplementation((params?: { view?: string }) => {
        if (params?.view === "archived") {
          return Promise.resolve({
            setlists: [
              { id: "a1", name: "Archived Set", songCount: 4, archivedAt: new Date().toISOString() },
            ],
          });
        }
        return Promise.resolve({ setlists: [] });
      });
      renderPage();
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: /^archive$/i }));

      expect(await screen.findByText("Archived Set")).toBeInTheDocument();
      expect(screen.getByText("Today")).toBeInTheDocument();
      expect(mockList).toHaveBeenCalledWith({ view: "archived" });
    });

    it("opens create modal on New Setlist click", async () => {
      renderPage();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /new setlist/i }));
      expect(screen.getByText("New Setlist", { selector: "h3" })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/sunday morning/i)).toBeInTheDocument();
    });

    it("creates setlist and navigates", async () => {
      mockCreate.mockResolvedValue({ setlist: { id: "new-1" } });
      renderPage();
      const user = userEvent.setup();
      await user.click(screen.getAllByRole("button", { name: /new setlist|create setlist/i })[0]);

      await user.type(screen.getByPlaceholderText(/sunday morning/i), "Easter Service");
      await user.click(screen.getByRole("button", { name: /^create$/i }));

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith("/setlists/new-1");
      });
    });
  });

  // ===================== NEGATIVE =====================

  describe("negative", () => {
    it("shows empty state when no setlists", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/no setlists yet/i)).toBeInTheDocument();
      });
    });

    it("shows loading state", () => {
      mockList.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(document.querySelector(".spinner")).toBeInTheDocument();
    });

    it("handles API error gracefully", async () => {
      mockList.mockRejectedValue(new Error("Server down"));
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/no setlists yet/i)).toBeInTheDocument();
      });
    });

    it("moves a setlist to trash on delete", async () => {
      mockList.mockResolvedValue({
        setlists: [{ id: "s1", name: "ToDelete", songCount: 0, updatedAt: "2026-01-01T00:00:00Z" }],
      });
      mockDeleteSetlist.mockResolvedValue({ message: "ok" });
      renderPage();

      await waitFor(() => screen.getByText("ToDelete"));

      fireEvent.click(screen.getByTitle("Move to trash"));

      await waitFor(() => {
        expect(mockDeleteSetlist).toHaveBeenCalledWith("s1");
        expect(screen.queryByText("ToDelete")).not.toBeInTheDocument();
      });
    });

    it("shows error toast on delete failure", async () => {
      const { toast } = await import("sonner");
      mockList.mockResolvedValue({
        setlists: [{ id: "s1", name: "Keep", songCount: 0, updatedAt: "2026-01-01T00:00:00Z" }],
      });
      mockDeleteSetlist.mockRejectedValue(new Error("Forbidden"));
      renderPage();

      await waitFor(() => screen.getByText("Keep"));

      fireEvent.click(screen.getByTitle("Move to trash"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Forbidden");
      });
    });

    it("hides edit actions from observers", async () => {
      mockAuthValue = {
        user: { id: "u1", email: "obs@test.com", displayName: "Obs", role: "member" },
        activeOrg: { id: "org1", name: "Test Church", role: "observer" },
      };
      mockList.mockResolvedValue({
        setlists: [{ id: "s1", name: "ReadOnly Set", songCount: 1, updatedAt: "2026-01-01T00:00:00Z" }],
      });
      renderPage();
      await waitFor(() => screen.getByText("ReadOnly Set"));

      expect(screen.queryByRole("button", { name: /new setlist/i })).not.toBeInTheDocument();
      expect(screen.queryByTitle("Archive")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Move to trash")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^trash$/i })).not.toBeInTheDocument();
    });

    it("closes create modal on cancel", async () => {
      renderPage();
      const user = userEvent.setup();
      await user.click(screen.getAllByRole("button", { name: /new setlist|create setlist/i })[0]);
      expect(screen.getByText("New Setlist", { selector: "h3" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /cancel/i }));
      expect(screen.queryByText("New Setlist", { selector: "h3" })).not.toBeInTheDocument();
    });
  });
});
