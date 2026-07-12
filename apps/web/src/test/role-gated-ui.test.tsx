import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SongListPage } from "@/pages/songs/SongListPage";
import { SongViewPage } from "@/pages/songs/SongViewPage";
import { SetlistHubPage } from "@/pages/setlists/SetlistHubPage";
import { SetlistViewPage } from "@/pages/setlists/SetlistViewPage";
import { DashboardPage } from "@/pages/DashboardPage";

// ---------- Shared auth mock ----------
let mockAuthValue: any;

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

// ---------- API mocks ----------
const mockSongsList = vi.fn();
const mockSongsGet = vi.fn();
const mockSongsGetGroups = vi.fn();
const mockSongsGetCategories = vi.fn();
const mockSongsGetTags = vi.fn();
const mockAdminListUsers = vi.fn();
const mockShareListOrganizationTargets = vi.fn();
const mockShareListBatchOrganizationShares = vi.fn();
const mockShareUpdateBatchToOrganizations = vi.fn();
const mockSetlistsList = vi.fn();
const mockSetlistsGet = vi.fn();
const mockEventsList = vi.fn();

vi.mock("@/lib/api-client", () => ({
  songsApi: {
    list: (...args: any[]) => mockSongsList(...args),
    get: (...args: any[]) => mockSongsGet(...args),
    getGroups: (...args: any[]) => mockSongsGetGroups(...args),
    getCategories: (...args: any[]) => mockSongsGetCategories(...args),
    getTags: (...args: any[]) => mockSongsGetTags(...args),
    delete: vi.fn(),
    exportChordPro: vi.fn(),
  },
  adminApi: {
    listUsers: (...args: any[]) => mockAdminListUsers(...args),
  },
  setlistsApi: {
    list: (...args: any[]) => mockSetlistsList(...args),
    get: (...args: any[]) => mockSetlistsGet(...args),
    delete: vi.fn(),
    addSong: vi.fn(),
    removeSong: vi.fn(),
    reorderSongs: vi.fn(),
    create: vi.fn(),
    markComplete: vi.fn(),
    reopen: vi.fn(),
    archive: vi.fn(),
    unarchive: vi.fn(),
    restore: vi.fn(),
    permanentDelete: vi.fn(),
  },
  eventsApi: {
    list: (...args: any[]) => mockEventsList(...args),
    create: vi.fn(),
    update: vi.fn(),
  },
  orgsApi: {
    members: vi.fn().mockResolvedValue({ members: [] }),
  },
  rehearsalsApi: { list: vi.fn().mockResolvedValue({ rehearsals: [] }) },
  usageReportApi: { get: vi.fn().mockResolvedValue({ songs: [] }) },
  shareApi: {
    create: vi.fn(),
    list: vi.fn().mockResolvedValue({ shares: [] }),
    revoke: vi.fn(),
    update: vi.fn(),
    listDirect: vi.fn().mockResolvedValue({ directShares: [] }),
    createDirect: vi.fn(),
    removeDirect: vi.fn(),
    listOrganizationTargets: (...args: any[]) => mockShareListOrganizationTargets(...args),
    listBatchOrganizationShares: (...args: any[]) => mockShareListBatchOrganizationShares(...args),
    updateBatchOrganizationShares: (...args: any[]) => mockShareUpdateBatchToOrganizations(...args),
    getShared: vi.fn(),
  },
  songUsageApi: {
    log: vi.fn(),
    list: vi.fn().mockResolvedValue({ usages: [] }),
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

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@vpc-music/shared", () => ({
  transposeKeyName: (key: string) => key,
  normalizeEnharmonicKey: (key: string | null | undefined) => key,
  composeTranspose: ({ sourceKey = null }: any = {}) => ({ semis: 0, preferFlats: false, displayKey: sourceKey }),
  spellForTarget: (key: string | null | undefined) =>
    key ? { preferFlats: false, targetKey: key } : { preferFlats: undefined, targetKey: null },
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

vi.mock("@/hooks/useConductor", () => ({
  useConductor: () => ({
    connected: false,
    roomState: { conductor: null, members: [], currentSong: 0, currentSection: null },
    currentSong: 0,
    currentSection: null,
    scrollTop: 0,
    goToSong: vi.fn(),
    broadcastScroll: vi.fn(),
    leave: vi.fn(),
    isConductor: false,
  }),
}));

vi.mock("@/components/songs/ChordProRenderer", () => ({
  ChordProRenderer: ({ content }: { content: string }) => (
    <div data-testid="chordpro-renderer">{content}</div>
  ),
  AutoScroll: () => <div data-testid="auto-scroll">AutoScroll</div>,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// ---------- Auth presets ----------
const musicianAuth = {
  user: { id: "u1", email: "musician@test.com", displayName: "Musician", role: "member" },
  activeOrg: { id: "org1", name: "Test Church", role: "musician" },
};

const observerAuth = {
  user: { id: "u2", email: "observer@test.com", displayName: "Observer", role: "member" },
  activeOrg: { id: "org1", name: "Test Church", role: "observer" },
};

const adminAuth = {
  user: { id: "u3", email: "admin@test.com", displayName: "Admin", role: "member" },
  activeOrg: { id: "org1", name: "Test Church", role: "admin" },
};

const ownerAuth = {
  user: { id: "u4", email: "owner@test.com", displayName: "Owner", role: "owner" },
  activeOrg: { id: "org1", name: "Test Church", role: "admin" },
};

// ---------- Mock data ----------
const mockSong = {
  id: "song-1",
  title: "Amazing Grace",
  key: "G",
  tempo: 72,
  artist: "Newton",
  tags: "hymn",
  content: "[G]Amazing grace",
  isDraft: false,
  defaultVariationId: null,
};

const mockSetlist = { id: "sl-1", name: "Sunday Service", status: "draft", category: "worship", notes: "" };
const mockSetlistSongs = [
  { id: "item-1", songId: "s1", position: 0, songTitle: "Song A", songKey: "G", songArtist: "Artist", songTempo: 120, key: null, notes: null, variationId: null, variationName: null },
];

// ---------- Helpers ----------
function renderSongList() {
  return render(
    <MemoryRouter>
      <SongListPage />
    </MemoryRouter>,
  );
}

function renderSongView() {
  return render(
    <MemoryRouter initialEntries={["/songs/song-1"]}>
      <Routes>
        <Route path="/songs/:id" element={<SongViewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderSetlistsList() {
  return render(
    <MemoryRouter initialEntries={["/setlists"]}>
      <SetlistHubPage />
    </MemoryRouter>,
  );
}

function renderSetlistView() {
  return render(
    <MemoryRouter initialEntries={["/setlists/sl-1"]}>
      <Routes>
        <Route path="/setlists/:id" element={<SetlistViewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

// ====================================================================
describe("Role-gated UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSongsList.mockResolvedValue({ songs: [mockSong], total: 1 });
    mockSongsGet.mockResolvedValue({ song: mockSong, variations: [] });
    mockSongsGetGroups.mockResolvedValue({ groups: [{ id: "group-1", name: "Wedding Songs", songCount: 1, canManage: true, managerUserIds: [], managerNames: [] }] });
    mockSongsGetCategories.mockResolvedValue({ categories: ["Church", "Wedding"] });
    mockSongsGetTags.mockResolvedValue({ tags: ["hymn", "worship"] });
    mockAdminListUsers.mockResolvedValue({ users: [] });
    mockShareListOrganizationTargets.mockResolvedValue({ organizations: [{ id: "org-2", name: "Mercy Chapel" }] });
    mockShareListBatchOrganizationShares.mockResolvedValue({ shares: [] });
    mockShareUpdateBatchToOrganizations.mockResolvedValue({ sharedSongs: 1, createdShares: 1, removedShares: 0, skippedShares: 0 });
    mockSetlistsList.mockResolvedValue({ setlists: [{ id: "sl-1", name: "Sunday", songCount: 2, category: "worship" }] });
    mockSetlistsGet.mockResolvedValue({ setlist: mockSetlist, songs: mockSetlistSongs });
    mockEventsList.mockResolvedValue({ events: [] });
  });

  // ── SongListPage ──────────────────────────────────
  describe("SongListPage", () => {
    it("musician sees New Song button", async () => {
      mockAuthValue = musicianAuth;
      renderSongList();
      await waitFor(() => expect(screen.getByText("Amazing Grace")).toBeInTheDocument());
      expect(screen.getByRole("link", { name: /new song/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /share to organizations/i })).not.toBeInTheDocument();
    });

    it("observer does NOT see New Song button", async () => {
      mockAuthValue = observerAuth;
      mockSongsGetGroups.mockResolvedValue({ groups: [{ id: "group-1", name: "Wedding Songs", songCount: 1, canManage: false, managerUserIds: [], managerNames: [] }] });
      renderSongList();
      await waitFor(() => expect(screen.getByText("Amazing Grace")).toBeInTheDocument());
      expect(screen.queryByRole("link", { name: /new song/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /groups/i })).not.toBeInTheDocument();
    });

    it("observer sees Groups button when delegated to manage a group", async () => {
      mockAuthValue = observerAuth;
      mockSongsGetGroups.mockResolvedValue({ groups: [{ id: "group-1", name: "Wedding Songs", songCount: 1, canManage: true, managerUserIds: ["u2"], managerNames: ["Observer"] }] });
      renderSongList();
      await waitFor(() => expect(screen.getByText("Amazing Grace")).toBeInTheDocument());
      expect(screen.getByRole("button", { name: /groups/i })).toBeInTheDocument();
    });

    it("owner sees New Song button", async () => {
      mockAuthValue = ownerAuth;
      renderSongList();
      await waitFor(() => expect(screen.getByText("Amazing Grace")).toBeInTheDocument());
      expect(screen.getByRole("link", { name: /new song/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /groups/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /share to organizations/i })).toBeInTheDocument();
    });

    it("admin sees Share to Organizations button", async () => {
      mockAuthValue = adminAuth;
      renderSongList();
      await waitFor(() => expect(screen.getByText("Amazing Grace")).toBeInTheDocument());
      expect(screen.getByRole("button", { name: /share to organizations/i })).toBeInTheDocument();
    });
  });

  // ── SongViewPage ──────────────────────────────────
  describe("SongViewPage", () => {
    it("musician sees Edit, Delete, Share, Log Usage buttons", async () => {
      mockAuthValue = musicianAuth;
      renderSongView();
      await waitFor(() => expect(screen.getByText("Amazing Grace")).toBeInTheDocument());
      expect(screen.getByRole("link", { name: /edit/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /log usage/i })).toBeInTheDocument();
    });

    it("observer does NOT see Edit, Delete, Share, Log Usage buttons", async () => {
      mockAuthValue = observerAuth;
      renderSongView();
      await waitFor(() => expect(screen.getByText("Amazing Grace")).toBeInTheDocument());
      expect(screen.queryByRole("link", { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /share/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /log usage/i })).not.toBeInTheDocument();
    });

    it("observer can still see song content", async () => {
      mockAuthValue = observerAuth;
      renderSongView();
      await waitFor(() => expect(screen.getByText("Amazing Grace")).toBeInTheDocument());
      expect(screen.getByTestId("chordpro-renderer")).toBeInTheDocument();
    });

    it("observer does NOT see Add Note button", async () => {
      mockAuthValue = observerAuth;
      renderSongView();
      await waitFor(() => expect(screen.getByText("Amazing Grace")).toBeInTheDocument());
      expect(screen.queryByRole("button", { name: /add note/i })).not.toBeInTheDocument();
    });

    it("musician sees Add Note button", async () => {
      mockAuthValue = musicianAuth;
      renderSongView();
      await waitFor(() => expect(screen.getByText("Amazing Grace")).toBeInTheDocument());
      expect(screen.getByRole("button", { name: /add note/i })).toBeInTheDocument();
    });

    it("observer still sees Print and Export buttons", async () => {
      mockAuthValue = observerAuth;
      renderSongView();
      await waitFor(() => expect(screen.getByText("Amazing Grace")).toBeInTheDocument());
      expect(screen.getByRole("button", { name: /print/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
    });
  });

  // ── SetlistHubPage ────────────────────────────────
  describe("SetlistHubPage", () => {
    it("musician sees New Setlist button", async () => {
      mockAuthValue = musicianAuth;
      renderSetlistsList();
      await waitFor(() => expect(screen.getByText("Sunday")).toBeInTheDocument());
      expect(screen.getByRole("button", { name: /new setlist/i })).toBeInTheDocument();
    });

    it("observer does NOT see New Setlist button", async () => {
      mockAuthValue = observerAuth;
      renderSetlistsList();
      await waitFor(() => expect(screen.getByText("Sunday")).toBeInTheDocument());
      expect(screen.queryByRole("button", { name: /new setlist/i })).not.toBeInTheDocument();
    });

    it("observer does NOT see archive/trash buttons on setlist cards", async () => {
      mockAuthValue = observerAuth;
      renderSetlistsList();
      await waitFor(() => expect(screen.getByText("Sunday")).toBeInTheDocument());
      expect(screen.queryByTitle("Archive")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Move to trash")).not.toBeInTheDocument();
    });

    it("musician sees archive/trash buttons on setlist cards", async () => {
      mockAuthValue = musicianAuth;
      renderSetlistsList();
      await waitFor(() => expect(screen.getByText("Sunday")).toBeInTheDocument());
      expect(screen.getByTitle("Archive")).toBeInTheDocument();
      expect(screen.getByTitle("Move to trash")).toBeInTheDocument();
    });
  });

  // ── SetlistViewPage ───────────────────────────────
  describe("SetlistViewPage", () => {
    it("musician sees Mark Complete, Delete, Add Song buttons", async () => {
      mockAuthValue = musicianAuth;
      renderSetlistView();
      await waitFor(() => expect(screen.getByText("Sunday Service")).toBeInTheDocument());
      expect(screen.getByRole("button", { name: /mark complete/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /add song/i })).toBeInTheDocument();
    });

    it("observer does NOT see Mark Complete, Delete, Add Song buttons", async () => {
      mockAuthValue = observerAuth;
      renderSetlistView();
      await waitFor(() => expect(screen.getByText("Sunday Service")).toBeInTheDocument());
      expect(screen.queryByRole("button", { name: /mark complete/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /add song/i })).not.toBeInTheDocument();
    });

    it("observer does NOT see reorder or remove controls", async () => {
      mockAuthValue = observerAuth;
      renderSetlistView();
      await waitFor(() => expect(screen.getByText("Sunday Service")).toBeInTheDocument());
      expect(screen.queryByTitle("Move up")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Move down")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Remove from setlist")).not.toBeInTheDocument();
    });

    it("musician sees reorder and remove controls", async () => {
      mockAuthValue = musicianAuth;
      renderSetlistView();
      await waitFor(() => expect(screen.getByText("Sunday Service")).toBeInTheDocument());
      expect(screen.getByTitle("Move up")).toBeInTheDocument();
      expect(screen.getByTitle("Move down")).toBeInTheDocument();
      expect(screen.getByTitle("Remove from setlist")).toBeInTheDocument();
    });

    it("observer can still see song list and Live Mode panel", async () => {
      mockAuthValue = observerAuth;
      renderSetlistView();
      await waitFor(() => expect(screen.getByText("Sunday Service")).toBeInTheDocument());
      expect(screen.getByText("Song A")).toBeInTheDocument();
      expect(screen.getByText("Live Mode")).toBeInTheDocument();
    });
  });

  // ── DashboardPage ─────────────────────────────────
  describe("DashboardPage", () => {
    it("musician sees New Song and New Setlist quick actions", async () => {
      mockAuthValue = musicianAuth;
      renderDashboard();
      await waitFor(() => expect(screen.getByText(/welcome/i)).toBeInTheDocument());
      expect(screen.getByRole("link", { name: /new song/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /new setlist/i })).toBeInTheDocument();
    });

    it("observer does NOT see New Song and New Setlist quick actions", async () => {
      mockAuthValue = observerAuth;
      renderDashboard();
      await waitFor(() => expect(screen.getByText(/welcome/i)).toBeInTheDocument());
      expect(screen.queryByRole("link", { name: /new song/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /new setlist/i })).not.toBeInTheDocument();
    });

    it("observer still sees Browse Songs link", async () => {
      mockAuthValue = observerAuth;
      renderDashboard();
      await waitFor(() => expect(screen.getByText(/welcome/i)).toBeInTheDocument());
      expect(screen.getByRole("link", { name: /browse songs/i })).toBeInTheDocument();
    });

    it("admin sees New Song and New Setlist quick actions", async () => {
      mockAuthValue = adminAuth;
      renderDashboard();
      await waitFor(() => expect(screen.getByText(/welcome/i)).toBeInTheDocument());
      expect(screen.getByRole("link", { name: /new song/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /new setlist/i })).toBeInTheDocument();
    });
  });
});
