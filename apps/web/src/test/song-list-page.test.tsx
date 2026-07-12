import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SongListPage } from "@/pages/songs/SongListPage";

// ---------- Mocks ----------
const mockList = vi.fn();
const mockExportZip = vi.fn();
const mockGetGroups = vi.fn();
const mockGetCategories = vi.fn();
const mockGetTags = vi.fn();
const mockCreateGroup = vi.fn();
const mockUpdateGroup = vi.fn();
const mockDeleteGroup = vi.fn();
const mockUpdateGroupManagers = vi.fn();
const mockAddSongsToGroup = vi.fn();
const mockListUsers = vi.fn();
const mockListOrganizationTargets = vi.fn();
const mockListBatchOrganizationShares = vi.fn();
const mockUpdateBatchOrganizationShares = vi.fn();
vi.mock("@/lib/api-client", () => ({
  adminApi: {
    listUsers: (...args: any[]) => mockListUsers(...args),
  },
  shareApi: {
    listOrganizationTargets: (...args: any[]) => mockListOrganizationTargets(...args),
    listBatchOrganizationShares: (...args: any[]) => mockListBatchOrganizationShares(...args),
    updateBatchOrganizationShares: (...args: any[]) => mockUpdateBatchOrganizationShares(...args),
  },
  songsApi: {
    list: (...args: any[]) => mockList(...args),
    getGroups: (...args: any[]) => mockGetGroups(...args),
    getCategories: (...args: any[]) => mockGetCategories(...args),
    getTags: (...args: any[]) => mockGetTags(...args),
    createGroup: (...args: any[]) => mockCreateGroup(...args),
    updateGroup: (...args: any[]) => mockUpdateGroup(...args),
    deleteGroup: (...args: any[]) => mockDeleteGroup(...args),
    updateGroupManagers: (...args: any[]) => mockUpdateGroupManagers(...args),
    addSongsToGroup: (...args: any[]) => mockAddSongsToGroup(...args),
    exportZip: (...args: any[]) => mockExportZip(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@vpc-music/shared", () => ({
  transposeKeyName: (key: string) => key,
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

function renderPage() {
  return render(
    <MemoryRouter>
      <SongListPage />
    </MemoryRouter>,
  );
}

// Group/Category/Key/Tag/BPM live inside the collapsed "Advanced Filters"
// panel by default (80/20 toolbar redesign) — open it before interacting.
async function openAdvancedFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /advanced filters/i }));
}

describe("SongListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockGetGroups.mockResolvedValue({ groups: [{ id: "group-1", name: "Wedding Songs", songCount: 2, canManage: true, managerUserIds: [], managerNames: [] }] });
    mockGetCategories.mockResolvedValue({ categories: ["Church", "Wedding"] });
    mockGetTags.mockResolvedValue({ tags: ["hymn", "worship", "christmas"] });
    mockCreateGroup.mockResolvedValue({ group: { id: "group-2", name: "Choir Rehearsal", songCount: 0 } });
    mockUpdateGroup.mockResolvedValue({ group: { id: "group-1", name: "Sunday Opener" } });
    mockDeleteGroup.mockResolvedValue({ message: "Song group deleted" });
    mockUpdateGroupManagers.mockResolvedValue({ groupId: "group-1", managerUserIds: ["u2"], managerNames: ["Band Member"] });
    mockAddSongsToGroup.mockResolvedValue({ addedSongIds: ["1"], skippedSongIds: [] });
    mockListOrganizationTargets.mockResolvedValue({ organizations: [{ id: "org-2", name: "Mercy Chapel" }, { id: "org-3", name: "River City Worship" }] });
    mockListBatchOrganizationShares.mockResolvedValue({ shares: [] });
    mockUpdateBatchOrganizationShares.mockResolvedValue({ sharedSongs: 1, createdShares: 1, removedShares: 0, skippedShares: 0 });
    mockListUsers.mockResolvedValue({
      users: [
        { id: "u1", email: "test@test.com", displayName: "Test", orgRole: "admin", globalRole: "owner", hasPassword: true, createdAt: "2026-01-01T00:00:00Z" },
        { id: "u2", email: "band@test.com", displayName: "Band Member", orgRole: "observer", globalRole: "member", hasPassword: true, createdAt: "2026-01-01T00:00:00Z" },
      ],
    });
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
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      const element = realCreateElement(tagName, options);
      if (tagName.toLowerCase() === "a") {
        Object.defineProperty(element, "click", {
          configurable: true,
          writable: true,
          value: vi.fn(),
        });
      }
      return element;
    }) as typeof document.createElement);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ===================== POSITIVE =====================

  describe("positive", () => {
    it("renders heading and new song link", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      expect(screen.getByText("Songs")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /new song/i })).toHaveAttribute("href", "/songs/new");
    });

    it("renders only the 5 primary controls by default", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      expect(screen.getByPlaceholderText(/search songs/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/song scope/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/sort songs/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /advanced filters/i })).toBeInTheDocument();
      // Secondary filters are tucked away until requested
      expect(screen.queryByLabelText(/filter by group/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/filter by category/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/filter by tag/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/minimum bpm/i)).not.toBeInTheDocument();
    });

    it("reveals group, category, key, tag, and BPM filters inside Advanced Filters", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await openAdvancedFilters(user);

      expect(screen.getByLabelText(/filter by group/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by category/i)).toBeInTheDocument();
      expect(screen.getByText("All keys")).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by tag/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/minimum bpm/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/maximum bpm/i)).toBeInTheDocument();
    });

    it("renders songs list when available", async () => {
      mockList.mockResolvedValue({
        songs: [
          { id: "1", title: "Amazing Grace", aka: "Grace Song, Old Hymn", category: "Church", key: "G", tempo: 72, artist: "Newton", tags: "hymn" },
          { id: "2", title: "How Great", key: "C", tempo: 120, artist: "Tomlin", tags: "" },
        ],
        total: 2,
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
        expect(screen.getByText("How Great")).toBeInTheDocument();
        expect(screen.getByText(/Category: Church/)).toBeInTheDocument();
        expect(screen.getByText(/AKA: Grace Song, Old Hymn/)).toBeInTheDocument();
      });
    });

    it("renders available song categories in the category filter dropdown", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await openAdvancedFilters(user);

      const categorySelect = await screen.findByLabelText(/filter by category/i);
      expect(categorySelect.querySelectorAll("option").length).toBe(3);
      expect(screen.getByRole("option", { name: "Church" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Wedding" })).toBeInTheDocument();
    });

    it("renders available song groups in the group filter dropdown", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await openAdvancedFilters(user);

      const groupSelect = await screen.findByLabelText(/filter by group/i);
      expect(groupSelect.querySelectorAll("option").length).toBe(2);
      expect(screen.getByRole("option", { name: "Wedding Songs" })).toBeInTheDocument();
    });

    it("requests songs with the selected category filter", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await openAdvancedFilters(user);

      await screen.findByLabelText(/filter by category/i);
      await user.selectOptions(screen.getByLabelText(/filter by category/i), "Church");

      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith({
          q: undefined,
          scope: undefined,
          groupId: undefined,
          category: "Church",
          key: undefined,
          tag: undefined,
          sort: "lastEdited",
          limit: 50,
          offset: 0,
        });
      });
    });

    it("requests songs with the selected group filter", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await openAdvancedFilters(user);

      await screen.findByLabelText(/filter by group/i);
      await user.selectOptions(screen.getByLabelText(/filter by group/i), "group-1");

      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith({
          q: undefined,
          scope: undefined,
          groupId: "group-1",
          category: undefined,
          key: undefined,
          tag: undefined,
          sort: "lastEdited",
          limit: 50,
          offset: 0,
        });
      });
    });

    it("requests shared songs when the shared scope is selected", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await screen.findByLabelText(/song scope/i);
      await user.selectOptions(screen.getByLabelText(/song scope/i), "shared");

      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith({
          q: undefined,
          scope: "shared",
          groupId: undefined,
          category: undefined,
          key: undefined,
          tag: undefined,
          sort: "lastEdited",
          limit: 50,
          offset: 0,
        });
      });

      await openAdvancedFilters(user);
      expect(screen.getByLabelText(/filter by group/i)).toBeDisabled();
    });

    it("shows song count", async () => {
      mockList.mockResolvedValue({
        songs: [{ id: "1", title: "Song A", key: "C", content: "" }],
        total: 1,
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/1 song\b/)).toBeInTheDocument();
      });
    });

    it("pluralizes song count correctly", async () => {
      mockList.mockResolvedValue({
        songs: [
          { id: "1", title: "A" },
          { id: "2", title: "B" },
        ],
        total: 2,
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/2 songs/)).toBeInTheDocument();
      });
    });

    it("shows the source organization for directly shared songs", async () => {
      mockList.mockResolvedValue({
        songs: [{ id: "1", title: "Shared Song", artist: "Leader", sharedWithMe: true, organizationName: "Grace Church" }],
        total: 1,
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Shared from: Grace Church/)).toBeInTheDocument();
      });
    });

    it("allows admins to batch share selected songs with other organizations", async () => {
      mockAuthValue = {
        user: { id: "u1", email: "test@test.com", displayName: "Test", role: "member" },
        activeOrg: { id: "org1", name: "Test Church", role: "admin" },
      };
      mockList.mockResolvedValue({
        songs: [{ id: "1", title: "Amazing Grace", key: "G", content: "" }],
        total: 1,
      });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await screen.findByText("Amazing Grace");
      await user.click(screen.getByLabelText(/select amazing grace/i));
      await user.click(screen.getByRole("button", { name: /share to organizations/i }));

      expect(mockListOrganizationTargets).toHaveBeenCalledTimes(1);
      expect(mockListBatchOrganizationShares).toHaveBeenCalledWith(["1"]);
      await user.click(await screen.findByRole("button", { name: /share selected songs with mercy chapel/i }));
      await user.click(screen.getByRole("button", { name: /save share changes/i }));

      await waitFor(() => {
        expect(mockUpdateBatchOrganizationShares).toHaveBeenCalledWith({
          songIds: ["1"],
          addOrganizationIds: ["org-2"],
          removeOrganizationIds: [],
        });
      });
    });

    it("renders key filter options from ALL_KEYS", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await openAdvancedFilters(user);

      const select = screen.getByDisplayValue("All keys");
      expect(select).toBeInTheDocument();
      // Check some key options exist
      expect(select.querySelectorAll("option").length).toBeGreaterThan(1);
    });

    it("renders available song tags in the tag filter dropdown", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await openAdvancedFilters(user);

      const tagSelect = await screen.findByLabelText(/filter by tag/i);
      expect(tagSelect.querySelectorAll("option").length).toBe(4);
      expect(screen.getByRole("option", { name: "hymn" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "worship" })).toBeInTheDocument();
    });

    it("requests songs with the selected tag filter", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await openAdvancedFilters(user);

      await screen.findByLabelText(/filter by tag/i);
      await user.selectOptions(screen.getByLabelText(/filter by tag/i), "worship");

      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith({
          q: undefined,
          scope: undefined,
          groupId: undefined,
          category: undefined,
          key: undefined,
          tag: "worship",
          sort: "lastEdited",
          limit: 50,
          offset: 0,
        });
      });
    });

    it("requests songs with the selected tempo range", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await openAdvancedFilters(user);

      fireEvent.change(screen.getByLabelText(/minimum bpm/i), { target: { value: "70" } });
      fireEvent.change(screen.getByLabelText(/maximum bpm/i), { target: { value: "90" } });

      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith({
          q: undefined,
          scope: undefined,
          groupId: undefined,
          category: undefined,
          key: undefined,
          tag: undefined,
          tempoMin: 70,
          tempoMax: 90,
          sort: "lastEdited",
          limit: 50,
          offset: 0,
        });
      });
    });

    it("requests songs with the selected sort option", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.selectOptions(screen.getByLabelText(/sort songs/i), "mostUsed");

      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith({
          q: undefined,
          scope: undefined,
          groupId: undefined,
          category: undefined,
          key: undefined,
          tag: undefined,
          sort: "mostUsed",
          limit: 50,
          offset: 0,
        });
      });
    });

    // ── Status consolidation: one dropdown replaces status + Favorites + Archived ──
    it("requests songs with the selected status", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.selectOptions(screen.getByLabelText(/filter by status/i), "status:ready");

      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith({
          q: undefined,
          scope: undefined,
          groupId: undefined,
          category: undefined,
          key: undefined,
          tag: undefined,
          status: "ready",
          sort: "lastEdited",
          limit: 50,
          offset: 0,
        });
      });
    });

    it("requests favorites-only songs from the status dropdown", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.selectOptions(screen.getByLabelText(/filter by status/i), "meta:favorites");

      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith({
          q: undefined,
          scope: undefined,
          groupId: undefined,
          category: undefined,
          key: undefined,
          tag: undefined,
          favorites: true,
          sort: "lastEdited",
          limit: 50,
          offset: 0,
        });
      });
    });

    it("requests archived songs from the status dropdown, replacing any prior status pick", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.selectOptions(screen.getByLabelText(/filter by status/i), "status:ready");
      await user.selectOptions(screen.getByLabelText(/filter by status/i), "meta:archived");

      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith({
          q: undefined,
          scope: undefined,
          groupId: undefined,
          category: undefined,
          key: undefined,
          tag: undefined,
          archived: true,
          sort: "lastEdited",
          limit: 50,
          offset: 0,
        });
      });
    });

    // ── Active filter chips ──
    it("shows a removable chip for an applied advanced filter and clears it independently", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await openAdvancedFilters(user);
      await user.selectOptions(screen.getByLabelText(/filter by category/i), "Church");

      const chip = await screen.findByTestId("filter-chip-category");
      expect(chip).toHaveTextContent("Category: Church");

      await user.click(screen.getByRole("button", { name: /remove category: church filter/i }));

      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith({
          q: undefined,
          scope: undefined,
          groupId: undefined,
          category: undefined,
          key: undefined,
          tag: undefined,
          sort: "lastEdited",
          limit: 50,
          offset: 0,
        });
      });
      expect(screen.queryByTestId("filter-chip-category")).not.toBeInTheDocument();
    });

    it("shows a combined BPM range chip and a status chip for Favorites", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.selectOptions(screen.getByLabelText(/filter by status/i), "meta:favorites");
      await openAdvancedFilters(user);
      fireEvent.change(screen.getByLabelText(/minimum bpm/i), { target: { value: "70" } });
      fireEvent.change(screen.getByLabelText(/maximum bpm/i), { target: { value: "90" } });

      expect(await screen.findByTestId("filter-chip-status")).toHaveTextContent("Status: Favorites");
      expect(screen.getByTestId("filter-chip-bpm")).toHaveTextContent("BPM: 70–90");
    });

    it("Clear All removes every active filter and returns to the default state", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.type(screen.getByPlaceholderText(/search songs/i), "acoustic");
      vi.advanceTimersByTime(350);
      await user.selectOptions(screen.getByLabelText(/filter by status/i), "meta:favorites");
      await openAdvancedFilters(user);
      await user.selectOptions(screen.getByLabelText(/filter by category/i), "Church");

      await screen.findByTestId("filter-chip-category");
      await user.click(screen.getByRole("button", { name: /clear all/i }));

      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith({
          q: undefined,
          scope: undefined,
          groupId: undefined,
          category: undefined,
          key: undefined,
          tag: undefined,
          sort: "lastEdited",
          limit: 50,
          offset: 0,
        });
      });
      expect(screen.getByPlaceholderText(/search songs/i)).toHaveValue("");
      expect(screen.queryByTestId("filter-chip-category")).not.toBeInTheDocument();
      expect(screen.queryByTestId("filter-chip-status")).not.toBeInTheDocument();
    });

    it("Reset Filters inside the panel clears only group/category/key/tag/BPM, not the primary status pick", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.selectOptions(screen.getByLabelText(/filter by status/i), "meta:favorites");
      await openAdvancedFilters(user);
      await user.selectOptions(screen.getByLabelText(/filter by category/i), "Church");
      await screen.findByTestId("filter-chip-category");

      await user.click(screen.getByRole("button", { name: /^reset filters$/i }));

      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith({
          q: undefined,
          scope: undefined,
          groupId: undefined,
          category: undefined,
          key: undefined,
          tag: undefined,
          favorites: true,
          sort: "lastEdited",
          limit: 50,
          offset: 0,
        });
      });
      expect(screen.queryByTestId("filter-chip-category")).not.toBeInTheDocument();
      expect(screen.getByTestId("filter-chip-status")).toHaveTextContent("Status: Favorites");
    });

    it("shows a count badge on Advanced Filters while it's collapsed", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await openAdvancedFilters(user);
      await user.selectOptions(screen.getByLabelText(/filter by category/i), "Church");
      await user.selectOptions(screen.getByLabelText(/filter by tag/i), "worship");
      await user.click(screen.getByRole("button", { name: /^apply filters$/i }));

      expect(screen.queryByLabelText(/filter by category/i)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /advanced filters/i })).toHaveTextContent("2");
    });

    it("carries the selected key into song links", async () => {
      mockList.mockResolvedValue({
        songs: [{ id: "1", title: "Amazing Grace", key: "G", content: "" }],
        total: 1,
      });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await openAdvancedFilters(user);

      await user.selectOptions(screen.getByDisplayValue("All keys"), "C");

      await waitFor(() => {
        expect(screen.getByRole("link", { name: /amazing grace/i })).toHaveAttribute("href", "/songs/1?key=C");
      });
    });

    it("shows pagination controls and requests the next page", async () => {
      mockList
        .mockResolvedValueOnce({
          songs: Array.from({ length: 50 }, (_, index) => ({ id: String(index + 1), title: `Song ${index + 1}` })),
          total: 75,
        })
        .mockResolvedValueOnce({
          songs: Array.from({ length: 25 }, (_, index) => ({ id: String(index + 51), title: `Song ${index + 51}` })),
          total: 75,
        });

      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();
        expect(screen.getByText(/showing 1-50/i)).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith({
          q: undefined,
          scope: undefined,
          groupId: undefined,
          category: undefined,
          key: undefined,
          tag: undefined,
          sort: "lastEdited",
          limit: 50,
          offset: 50,
        });
        expect(screen.getByText(/page 2 of 2/i)).toBeInTheDocument();
        expect(screen.getByText(/showing 51-75/i)).toBeInTheDocument();
      });
    });

    it("resets to the first page when filters change", async () => {
      mockList
        .mockResolvedValueOnce({
          songs: Array.from({ length: 50 }, (_, index) => ({ id: String(index + 1), title: `Song ${index + 1}` })),
          total: 75,
        })
        .mockResolvedValueOnce({
          songs: Array.from({ length: 25 }, (_, index) => ({ id: String(index + 51), title: `Song ${index + 51}` })),
          total: 75,
        })
        .mockResolvedValue({ songs: [], total: 0 });

      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/page 2 of 2/i)).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText(/search songs/i), "reset");
      vi.advanceTimersByTime(350);

      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith({
          q: "reset",
          scope: undefined,
          groupId: undefined,
          category: undefined,
          key: undefined,
          tag: undefined,
          sort: "lastEdited",
          limit: 50,
          offset: 0,
        });
      });
    });

    it("exports selected songs as a chordpro zip", async () => {
      mockList.mockResolvedValue({
        songs: [
          { id: "1", title: "Amazing Grace", key: "G", tempo: 72, artist: "Newton", tags: "hymn" },
          { id: "2", title: "How Great", key: "C", tempo: 120, artist: "Tomlin", tags: "worship" },
        ],
        total: 2,
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("checkbox", { name: /select amazing grace/i }));
      fireEvent.click(screen.getByRole("checkbox", { name: /select how great/i }));
      fireEvent.click(screen.getByRole("button", { name: /export zip/i }));
      fireEvent.click(screen.getByText("ChordPro ZIP (.zip)"));

      await waitFor(() => {
        expect(mockExportZip).toHaveBeenCalledWith(["1", "2"], "chordpro");
      });
    });

    it("selects all visible songs from the select-all control", async () => {
      mockList.mockResolvedValue({
        songs: [
          { id: "1", title: "Amazing Grace", key: "G", content: "" },
          { id: "2", title: "How Great", key: "C", content: "" },
        ],
        total: 2,
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole("checkbox", { name: /select all visible songs/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("checkbox", { name: /select all visible songs/i }));

      expect(screen.getByRole("checkbox", { name: /select amazing grace/i })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: /select how great/i })).toBeChecked();
    });

    it("creates a group and adds selected songs from the groups modal", async () => {
      mockList.mockResolvedValue({
        songs: [{ id: "1", title: "Amazing Grace", key: "G", content: "" }],
        total: 1,
      });
      mockGetGroups
        .mockResolvedValueOnce({ groups: [] })
        .mockResolvedValueOnce({ groups: [{ id: "group-2", name: "Choir Rehearsal", songCount: 1 }] });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await waitFor(() => {
        expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("checkbox", { name: /select amazing grace/i }));
      await user.click(screen.getByRole("button", { name: /groups/i }));
      await user.type(screen.getByPlaceholderText(/wedding set, youth night, choir rehearsal/i), "Choir Rehearsal");
      await user.click(screen.getByRole("button", { name: /create group/i }));

      await waitFor(() => {
        expect(mockCreateGroup).toHaveBeenCalledWith({ name: "Choir Rehearsal" });
        expect(mockAddSongsToGroup).toHaveBeenCalledWith("group-2", ["1"]);
      });
    });

    it("updates delegated group managers from the groups modal", async () => {
      mockList.mockResolvedValue({
        songs: [{ id: "1", title: "Amazing Grace", key: "G", content: "" }],
        total: 1,
      });
      mockGetGroups.mockResolvedValue({
        groups: [{ id: "group-1", name: "Wedding Songs", songCount: 2, canManage: true, managerUserIds: [], managerNames: [] }],
      });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await waitFor(() => {
        expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /groups/i }));

      const managerSelect = screen.getByLabelText(/delegated managers for wedding songs/i);
      await user.selectOptions(managerSelect, "u2");
      await user.click(screen.getByRole("button", { name: /save managers/i }));

      await waitFor(() => {
        expect(mockUpdateGroupManagers).toHaveBeenCalledWith("group-1", ["u2"]);
      });
    });

    it("renames an existing group from the groups modal", async () => {
      mockList.mockResolvedValue({
        songs: [{ id: "1", title: "Amazing Grace", key: "G", content: "" }],
        total: 1,
      });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await waitFor(() => {
        expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /groups/i }));
      await user.click(screen.getByRole("button", { name: /rename wedding songs/i }));

      const renameInput = screen.getByLabelText(/rename wedding songs/i);
      await user.clear(renameInput);
      await user.type(renameInput, "Sunday Opener");
      await user.click(screen.getByRole("button", { name: /^save$/i }));

      await waitFor(() => {
        expect(mockUpdateGroup).toHaveBeenCalledWith("group-1", { name: "Sunday Opener" });
      });
    });

    it("deletes a group from the groups modal", async () => {
      mockList.mockResolvedValue({
        songs: [{ id: "1", title: "Amazing Grace", key: "G", content: "" }],
        total: 1,
      });
      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await waitFor(() => {
        expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /groups/i }));
      await user.click(screen.getByRole("button", { name: /delete wedding songs/i }));
      await user.click(screen.getByRole("button", { name: /delete group/i }));

      await waitFor(() => {
        expect(mockDeleteGroup).toHaveBeenCalledWith("group-1");
      });
    });
  });

  // ===================== NEGATIVE =====================

  describe("negative", () => {
    it("shows empty state when no songs", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/no songs yet/i)).toBeInTheDocument();
      });
    });

    it("shows no-match message when search yields nothing", async () => {
      // First call returns results, second (after search) returns nothing
      mockList
        .mockResolvedValueOnce({ songs: [{ id: "1", title: "X" }], total: 1 })
        .mockResolvedValueOnce({ songs: [], total: 0 });

      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await waitFor(() => {
        expect(screen.getByText("X")).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText(/search songs/i), "zzzzz");
      vi.advanceTimersByTime(350); // exceed debounce

      await waitFor(() => {
        expect(screen.getByText(/no songs match your search/i)).toBeInTheDocument();
      });
    });

    it("shows no-match message when a tag filter yields nothing", async () => {
      mockList
        .mockResolvedValueOnce({ songs: [{ id: "1", title: "X" }], total: 1 })
        .mockResolvedValueOnce({ songs: [], total: 0 });

      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await waitFor(() => {
        expect(screen.getByText("X")).toBeInTheDocument();
      });

      await openAdvancedFilters(user);
      await user.selectOptions(screen.getByLabelText(/filter by tag/i), "worship");

      await waitFor(() => {
        expect(screen.getByText(/no songs match your search/i)).toBeInTheDocument();
      });
    });

    it("shows no-match message when a tempo range yields nothing", async () => {
      mockList
        .mockResolvedValueOnce({ songs: [{ id: "1", title: "X" }], total: 1 })
        .mockResolvedValueOnce({ songs: [], total: 0 });

      renderPage();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await waitFor(() => {
        expect(screen.getByText("X")).toBeInTheDocument();
      });

      await openAdvancedFilters(user);
      fireEvent.change(screen.getByLabelText(/minimum bpm/i), { target: { value: "200" } });

      await waitFor(() => {
        expect(screen.getByText(/no songs match your search/i)).toBeInTheDocument();
      });
    });

    it("shows loading state initially", () => {
      mockList.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(document.querySelector(".spinner")).toBeInTheDocument();
    });

    it("handles API errors gracefully", async () => {
      mockList.mockRejectedValue(new Error("Server down"));
      renderPage();
      await waitFor(() => {
        // Should show empty state, not crash
        expect(screen.getByText(/no songs yet/i)).toBeInTheDocument();
      });
    });

    it("shows Create Song link in empty state", async () => {
      mockList.mockResolvedValue({ songs: [], total: 0 });
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole("link", { name: /create song/i })).toHaveAttribute("href", "/songs/new");
      });
    });
  });
});
