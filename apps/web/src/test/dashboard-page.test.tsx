import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "@/pages/DashboardPage";

// ---------- Mocks ----------
const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockSongsList = vi.fn();
const mockSetlistsList = vi.fn();
const mockEventsList = vi.fn();
const mockMostUsed = vi.fn();
const mockOrgMembers = vi.fn();
const mockEventCreate = vi.fn();
const mockEventUpdate = vi.fn();
vi.mock("@/lib/api-client", () => ({
  songsApi: { list: (...args: any[]) => mockSongsList(...args) },
  setlistsApi: { list: (...args: any[]) => mockSetlistsList(...args) },
  eventsApi: {
    list: (...args: any[]) => mockEventsList(...args),
    create: (...args: any[]) => mockEventCreate(...args),
    update: (...args: any[]) => mockEventUpdate(...args),
  },
  songUsageApi: { mostUsed: (...args: any[]) => mockMostUsed(...args) },
  orgsApi: { members: (...args: any[]) => mockOrgMembers(...args) },
  rehearsalsApi: { list: vi.fn().mockResolvedValue({ rehearsals: [] }) },
  usageReportApi: { get: vi.fn().mockResolvedValue({ songs: [] }) },
}));

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { displayName: "John", email: "john@test.com", role: "owner" },
      activeOrg: { id: "org1", name: "Test Church", role: "admin" },
    });
    mockEventsList.mockResolvedValue({ events: [] });
    mockMostUsed.mockResolvedValue({ songs: [] });
    mockOrgMembers.mockResolvedValue({ members: [] });
  });

  // ===================== POSITIVE =====================

  describe("positive", () => {
    it("shows personalized greeting", async () => {
      mockSongsList.mockResolvedValue({ songs: [], total: 0 });
      mockSetlistsList.mockResolvedValue({ setlists: [] });
      renderDashboard();
      expect(screen.getByText("Welcome, John")).toBeInTheDocument();
    });

    it("shows overview description", async () => {
      mockSongsList.mockResolvedValue({ songs: [], total: 0 });
      mockSetlistsList.mockResolvedValue({ setlists: [] });
      renderDashboard();
      expect(screen.getByText(/overview of your library/i)).toBeInTheDocument();
    });

    it("renders quick action links", async () => {
      mockSongsList.mockResolvedValue({ songs: [], total: 0 });
      mockSetlistsList.mockResolvedValue({ setlists: [] });
      renderDashboard();
      expect(screen.getByRole("link", { name: /new song/i })).toHaveAttribute("href", "/songs/new");
      expect(screen.getByRole("link", { name: /new setlist/i })).toHaveAttribute("href", "/setlists/new");
      expect(screen.getByRole("link", { name: /browse songs/i })).toHaveAttribute("href", "/songs");
    });

    it("renders recent songs when available", async () => {
      mockSongsList.mockResolvedValue({
        songs: [
          { id: "1", title: "Amazing Grace", key: "G", tempo: 72, artist: "Newton" },
          { id: "2", title: "How Great", key: "C", tempo: 120, artist: null },
        ],
        total: 2,
      });
      mockSetlistsList.mockResolvedValue({ setlists: [] });
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
        expect(screen.getByText("How Great")).toBeInTheDocument();
      });
    });

    it("renders 'View all' links for songs and setlists", async () => {
      mockSongsList.mockResolvedValue({ songs: [], total: 0 });
      mockSetlistsList.mockResolvedValue({ setlists: [] });
      renderDashboard();
      const viewAlls = screen.getAllByText("View all");
      expect(viewAlls.length).toBeGreaterThanOrEqual(2);
    });

    it("renders setlists when available", async () => {
      mockSongsList.mockResolvedValue({ songs: [], total: 0 });
      mockSetlistsList.mockResolvedValue({
        setlists: [
          { id: "s1", name: "Sunday Service", songCount: 5, category: "worship" },
        ],
      });
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("Sunday Service")).toBeInTheDocument();
      });
    });

    it("shows song metadata (key, tempo, artist)", async () => {
      mockSongsList.mockResolvedValue({
        songs: [{ id: "1", title: "Song A", key: "D", tempo: 90, artist: "Artist X" }],
        total: 1,
      });
      mockSetlistsList.mockResolvedValue({ setlists: [] });
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("D")).toBeInTheDocument();
        expect(screen.getByText("90 BPM")).toBeInTheDocument();
        expect(screen.getByText("Artist X")).toBeInTheDocument();
      });
    });
  });

  // ===================== NEGATIVE =====================

  describe("negative", () => {
    it("shows empty state for songs when none exist", async () => {
      mockSongsList.mockResolvedValue({ songs: [], total: 0 });
      mockSetlistsList.mockResolvedValue({ setlists: [] });
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText(/no songs yet/i)).toBeInTheDocument();
      });
    });

    it("shows empty state for setlists when none exist", async () => {
      mockSongsList.mockResolvedValue({ songs: [], total: 0 });
      mockSetlistsList.mockResolvedValue({ setlists: [] });
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText(/no setlists yet/i)).toBeInTheDocument();
      });
    });

    it("shows loading state initially", () => {
      mockSongsList.mockReturnValue(new Promise(() => {})); // never resolves
      mockSetlistsList.mockReturnValue(new Promise(() => {}));
      renderDashboard();
      const loadingEls = screen.getAllByText("Loading...");
      expect(loadingEls.length).toBeGreaterThanOrEqual(1);
    });

    it("handles API errors gracefully", async () => {
      mockSongsList.mockRejectedValue(new Error("Server error"));
      mockSetlistsList.mockRejectedValue(new Error("Server error"));
      renderDashboard();
      // Should show empty states, not crash
      await waitFor(() => {
        expect(screen.getByText(/no songs yet/i)).toBeInTheDocument();
      });
    });

    it("still shows setlists when only the songs request fails", async () => {
      // Regression guard: one flaky endpoint (a timeout, a network blip)
      // must not blank out sections whose own requests actually succeeded.
      mockSongsList.mockRejectedValue(new Error("Timeout"));
      mockSetlistsList.mockResolvedValue({
        setlists: [{ id: "sl-1", name: "Sunday Service", songCount: 5 }],
      });
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("Sunday Service")).toBeInTheDocument();
      });
      // The songs section independently falls back to its own empty state
      expect(screen.getByText(/no songs yet/i)).toBeInTheDocument();
    });

    it("still shows recent songs when only the setlists request fails", async () => {
      mockSongsList.mockResolvedValue({
        songs: [{ id: "1", title: "Amazing Grace", key: "G", tempo: 72, artist: "Newton" }],
        total: 1,
      });
      mockSetlistsList.mockRejectedValue(new Error("Timeout"));
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
      });
      expect(screen.getByText(/no setlists yet/i)).toBeInTheDocument();
    });

    it("shows greeting without name when displayName is empty", () => {
      mockUseAuth.mockReturnValue({ user: { displayName: "", email: "a@b.com" } });
      mockSongsList.mockResolvedValue({ songs: [], total: 0 });
      mockSetlistsList.mockResolvedValue({ setlists: [] });
      renderDashboard();
      expect(screen.getByText("Welcome")).toBeInTheDocument();
    });

    it("shows greeting without name when user is null", () => {
      mockUseAuth.mockReturnValue({ user: null });
      mockSongsList.mockResolvedValue({ songs: [], total: 0 });
      mockSetlistsList.mockResolvedValue({ setlists: [] });
      renderDashboard();
      expect(screen.getByText("Welcome")).toBeInTheDocument();
    });
  });

  // ===================== EVENTS =====================

  describe("upcoming events", () => {
    it("renders upcoming events section heading", async () => {
      mockSongsList.mockResolvedValue({ songs: [], total: 0 });
      mockSetlistsList.mockResolvedValue({ setlists: [] });
      mockEventsList.mockResolvedValue({ events: [] });
      renderDashboard();
      expect(screen.getByText("Upcoming Events")).toBeInTheDocument();
    });

    it("shows empty state when no events", async () => {
      mockSongsList.mockResolvedValue({ songs: [], total: 0 });
      mockSetlistsList.mockResolvedValue({ setlists: [] });
      mockEventsList.mockResolvedValue({ events: [] });
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("No upcoming events")).toBeInTheDocument();
      });
    });

    it("renders event cards with title and date", async () => {
      mockSongsList.mockResolvedValue({ songs: [], total: 0 });
      mockSetlistsList.mockResolvedValue({ setlists: [] });
      mockEventsList.mockResolvedValue({
        events: [
          {
            id: "e1",
            title: "Sunday Morning Worship",
            date: "2025-08-10T10:00:00.000Z",
            location: "Main Sanctuary",
            setlistId: null,
            setlistName: null,
          },
        ],
      });
      renderDashboard();
      await waitFor(() => {
        // Title/location can also appear in the Next Performance hero
        expect(screen.getAllByText("Sunday Morning Worship").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Main Sanctuary").length).toBeGreaterThan(0);
      });
    });

    it("shows linked setlist name on event card", async () => {
      mockSongsList.mockResolvedValue({ songs: [], total: 0 });
      mockSetlistsList.mockResolvedValue({ setlists: [] });
      mockEventsList.mockResolvedValue({
        events: [
          {
            id: "e2",
            title: "Youth Night",
            date: "2025-08-15T18:30:00.000Z",
            location: null,
            setlistId: "sl1",
            setlistName: "Youth Set",
          },
        ],
      });
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("Youth Set")).toBeInTheDocument();
        expect(screen.getByText("Youth Set").closest("a")).toHaveAttribute("href", "/setlists/sl1");
      });
    });

    it("fetches events with upcoming=true", async () => {
      mockSongsList.mockResolvedValue({ songs: [], total: 0 });
      mockSetlistsList.mockResolvedValue({ setlists: [] });
      mockEventsList.mockResolvedValue({ events: [] });
      renderDashboard();
      await waitFor(() => {
        expect(mockEventsList).toHaveBeenCalledWith({ upcoming: true });
      });
    });
  });

  // ===================== NEXT PERFORMANCE / PLAN MODAL =====================

  describe("next performance hero", () => {
    const heroEvent = {
      id: "e1",
      title: "Sunday Morning Worship",
      date: "2099-08-10T10:00:00.000Z",
      location: "Main Sanctuary",
      theme: "Gratitude",
      preparedByName: "Sam Carter",
      team: [{ name: "Alex", role: "Drums" }],
      setlistId: "sl1",
      setlistName: "Sunday Set",
      setlistStatus: "draft",
      songCount: 5,
    };

    it("spotlights the first upcoming event", async () => {
      mockSongsList.mockResolvedValue({ songs: [], total: 0 });
      mockSetlistsList.mockResolvedValue({ setlists: [] });
      mockEventsList.mockResolvedValue({ events: [heroEvent] });
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("Next Performance")).toBeInTheDocument();
        expect(screen.getByText("5 songs")).toBeInTheDocument();
      });
    });

    it("opens the service plan modal from the hero", async () => {
      mockSongsList.mockResolvedValue({ songs: [], total: 0 });
      mockSetlistsList.mockResolvedValue({ setlists: [] });
      mockEventsList.mockResolvedValue({ events: [heroEvent] });
      renderDashboard();
      await waitFor(() => screen.getByText("Next Performance"));

      fireEvent.click(screen.getByRole("button", { name: /view plan/i }));

      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveTextContent("Prepared By");
      expect(dialog).toHaveTextContent("Sam Carter");
      expect(dialog).toHaveTextContent("Alex");
      expect(dialog).toHaveTextContent("Drums");
    });

    it("hides New plan / Edit actions from observers", async () => {
      mockUseAuth.mockReturnValue({
        user: { displayName: "John", email: "john@test.com", role: "member" },
        activeOrg: { id: "org1", name: "Test Church", role: "observer" },
      });
      mockSongsList.mockResolvedValue({ songs: [], total: 0 });
      mockSetlistsList.mockResolvedValue({ setlists: [] });
      mockEventsList.mockResolvedValue({ events: [heroEvent] });
      renderDashboard();
      await waitFor(() => screen.getByText("Next Performance"));

      expect(screen.queryByText(/new plan/i)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /view plan/i }));
      const dialog = await screen.findByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /edit plan/i })).not.toBeInTheDocument();
    });

    it("opens the New Plan dialog for editors", async () => {
      mockSongsList.mockResolvedValue({ songs: [], total: 0 });
      mockSetlistsList.mockResolvedValue({ setlists: [] });
      mockEventsList.mockResolvedValue({ events: [] });
      renderDashboard();
      await waitFor(() => expect(mockEventsList).toHaveBeenCalled());

      // "New Plan" appears both in quick actions and the events section header
      fireEvent.click(screen.getAllByRole("button", { name: /new plan/i })[0]);
      expect(await screen.findByRole("dialog", { name: /new plan/i })).toBeInTheDocument();
    });
  });
});
